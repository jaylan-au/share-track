import express from 'express';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { jwtVerify } from 'jose';
import { createR2StorageFromEnv } from './r2-storage.js';
import { validateShareTrackPayload } from './validation.js';

const FILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION_ID_PATTERN = /^\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_FILE_NAME_LENGTH = 120;

export function createApp({ storage, jwtSecret, allowedOrigins = [] }) {
	const app = express();
	const auth = createAuthMiddleware(jwtSecret);
	const allowedOriginSet = new Set(allowedOrigins);

	app.disable('x-powered-by');
	app.use((request, response, next) => {
		const origin = request.get('origin');
		if (origin) {
			if (!allowedOriginSet.has(origin)) {
				return response.sendStatus(403);
			}
			response.setHeader('Access-Control-Allow-Origin', origin);
			response.setHeader('Vary', 'Origin');
			response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
			response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
		}
		if (request.method === 'OPTIONS') {
			return response.sendStatus(204);
		}
		next();
	});
	app.use(express.json({ limit: '5mb', strict: true }));

	app.get('/health', (_request, response) => response.json({ status: 'ok' }));

	app.get('/api/files', auth, asyncRoute(async (request, response) => {
		if (!storage) {
			return response.status(503).json({ error: 'File storage is not configured.' });
		}
		response.json({ files: await storage.listFiles(request.userId) });
	}));

	app.post('/api/files', auth, asyncRoute(async (request, response) => {
		if (!storage) {
			return response.status(503).json({ error: 'File storage is not configured.' });
		}
		if (!isPlainObject(request.body) || Object.keys(request.body).some((key) => !['fileId', 'fileName', 'data'].includes(key))) {
			return response.status(400).json({ error: 'Expected fileName, data, and optional fileId.' });
		}
		const { fileId, fileName, data } = request.body;
		if (typeof fileName !== 'string' || fileName.trim().length === 0 || fileName.trim().length > MAX_FILE_NAME_LENGTH || /[\u0000-\u001f\u007f]/.test(fileName)) {
			return response.status(400).json({ error: 'fileName must be a non-empty name of at most 120 characters.' });
		}
		if (fileId !== undefined && (typeof fileId !== 'string' || !FILE_ID_PATTERN.test(fileId))) {
			return response.status(400).json({ error: 'fileId must be a valid file ID.' });
		}
		const validationError = validateShareTrackPayload(data);
		if (validationError) {
			return response.status(400).json({ error: validationError });
		}

		const id = fileId ?? randomUUID();
		const existingVersions = fileId ? await storage.listVersions(request.userId, id) : [];
		if (fileId && existingVersions.length === 0) {
			return response.sendStatus(404);
		}
		if (existingVersions.length > 0 && existingVersions[0].fileName !== fileName.trim()) {
			return response.status(409).json({ error: 'A file name cannot be changed when saving a new version.' });
		}

		const savedVersion = await storage.putVersion({
			userId: request.userId,
			fileId: id,
			fileName: fileName.trim(),
			data,
		});
		response.status(201).json({ id, ...savedVersion });
	}));

	app.get('/api/files/:fileId/versions', auth, asyncRoute(async (request, response) => {
		if (!storage) {
			return response.status(503).json({ error: 'File storage is not configured.' });
		}
		if (!FILE_ID_PATTERN.test(request.params.fileId)) {
			return response.status(400).json({ error: 'Invalid file ID.' });
		}
		const versions = await storage.listVersions(request.userId, request.params.fileId);
		if (versions.length === 0) {
			return response.sendStatus(404);
		}
		response.json({ versions });
	}));

	app.get('/api/files/:fileId', auth, asyncRoute(async (request, response) => {
		if (!storage) {
			return response.status(503).json({ error: 'File storage is not configured.' });
		}
		const { fileId } = request.params;
		const { versionId } = request.query;
		if (!FILE_ID_PATTERN.test(fileId) || (versionId !== undefined && (typeof versionId !== 'string' || !VERSION_ID_PATTERN.test(versionId)))) {
			return response.status(400).json({ error: 'Invalid file or version ID.' });
		}
		const savedVersion = await storage.getVersion(request.userId, fileId, versionId);
		if (!savedVersion) {
			return response.sendStatus(404);
		}
		const validationError = validateShareTrackPayload(savedVersion.data);
		if (validationError) {
			return response.status(502).json({ error: 'Stored file failed validation.' });
		}
		response.setHeader('X-File-Version', savedVersion.versionId);
		response.type('application/json').send(JSON.stringify(savedVersion.data));
	}));

	app.use((error, _request, response, _next) => {
		if (error?.type === 'entity.parse.failed') {
			return response.status(400).json({ error: 'Request body must contain valid JSON.' });
		}
		if (error?.type === 'entity.too.large') {
			return response.status(413).json({ error: 'Request body exceeds the 5 MB limit.' });
		}
		if (error?.code === 'INVALID_STORED_JSON') {
			return response.status(502).json({ error: 'Stored file could not be parsed.' });
		}
		console.error('API request failed:', error);
		response.status(500).json({ error: 'Internal server error.' });
	});

	return app;
}

function createAuthMiddleware(jwtSecret) {
	return async (request, response, next) => {
		if (typeof jwtSecret !== 'string' || Buffer.byteLength(jwtSecret) < 32) {
			return response.status(503).json({ error: 'JWT authentication is not configured.' });
		}
		const match = /^Bearer (.+)$/i.exec(request.get('authorization') ?? '');
		if (!match) {
			return response.status(401).json({ error: 'A bearer token is required.' });
		}
		try {
			const { payload } = await jwtVerify(match[1], new TextEncoder().encode(jwtSecret), { algorithms: ['HS256'] });
			if (typeof payload.userID !== 'string' || payload.userID.trim().length === 0 || payload.userID.length > 256) {
				return response.status(401).json({ error: 'The token must contain a valid userID claim.' });
			}
			request.userId = payload.userID;
			next();
		} catch {
			response.status(401).json({ error: 'The bearer token is invalid or expired.' });
		}
	};
}

function asyncRoute(handler) {
	return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

const storage = createR2StorageFromEnv();
const app = createApp({
	storage,
	jwtSecret: process.env.JWT_SECRET,
	allowedOrigins: (process.env.WEB_APP_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
});
const port = Number(process.env.PORT ?? 3000);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	app.listen(port, () => {
	console.log(`Backend server listening on port ${port}`);
});
}