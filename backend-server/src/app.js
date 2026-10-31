import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { validateShareTrackPayload } from './validation.js';

const FILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION_ID_PATTERN = /^\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_FILE_NAME_LENGTH = 120;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const INVALID_JSON = Symbol('invalid JSON');

/**
 * `access` holds the Cloudflare Access settings: `teamDomain` (for example
 * `your-team.cloudflareaccess.com`) and `audience` (the application AUD tag).
 * `keySet` is optional and only used by tests to supply a local JWKS.
 * `devUserId`, when set, bypasses Access for local development only; config
 * never sets it when an Access team domain is configured.
 */
export function createApp({ storage, access, allowedOrigins = [], devUserId = null }) {
	const app = new Hono();
	const auth = devUserId ? createDevAuthMiddleware(devUserId) : createAccessAuthMiddleware(access);
	const allowedOriginSet = new Set(allowedOrigins);
	const notConfigured = (c) => c.json({ error: 'File storage is not configured.' }, 503);

	app.use('*', async (c, next) => {
		const origin = c.req.header('origin');
		if (origin) {
			if (!allowedOriginSet.has(origin)) {
				return c.body(null, 403);
			}
			c.header('Access-Control-Allow-Origin', origin);
			c.header('Vary', 'Origin');
			c.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
			c.header('Access-Control-Allow-Headers', 'Content-Type');
			c.header('Access-Control-Allow-Credentials', 'true');
		}
		if (c.req.method === 'OPTIONS') {
			return c.body(null, 204);
		}
		await next();
	});

	app.use('/api/files', bodyLimit({
		maxSize: MAX_BODY_BYTES,
		onError: (c) => c.json({ error: 'Request body exceeds the 5 MB limit.' }, 413),
	}));

	app.get('/health', (c) => c.json({ status: 'ok' }));

	app.get('/api/files', auth, async (c) => {
		if (!storage) {
			return notConfigured(c);
		}
		return c.json({ files: await storage.listFiles(c.get('userId')) });
	});

	app.post('/api/files', auth, async (c) => {
		if (!storage) {
			return notConfigured(c);
		}
		const body = await c.req.json().catch(() => INVALID_JSON);
		if (body === INVALID_JSON) {
			return c.json({ error: 'Request body must contain valid JSON.' }, 400);
		}
		if (!isPlainObject(body) || Object.keys(body).some((key) => !['fileId', 'fileName', 'data'].includes(key))) {
			return c.json({ error: 'Expected fileName, data, and optional fileId.' }, 400);
		}
		const { fileId, fileName, data } = body;
		if (typeof fileName !== 'string' || fileName.trim().length === 0 || fileName.trim().length > MAX_FILE_NAME_LENGTH || /[\u0000-\u001f\u007f]/.test(fileName)) {
			return c.json({ error: 'fileName must be a non-empty name of at most 120 characters.' }, 400);
		}
		if (fileId !== undefined && (typeof fileId !== 'string' || !FILE_ID_PATTERN.test(fileId))) {
			return c.json({ error: 'fileId must be a valid file ID.' }, 400);
		}
		const validationError = validateShareTrackPayload(data);
		if (validationError) {
			return c.json({ error: validationError }, 400);
		}

		const userId = c.get('userId');
		const id = fileId ?? crypto.randomUUID();
		if (fileId && await storage.isTrashed(userId, id)) {
			return c.json({ error: 'This portfolio is in the trash. Restore it before saving.' }, 409);
		}
		const existingVersions = fileId ? await storage.listVersions(userId, id) : [];
		if (fileId && existingVersions.length === 0) {
			return c.body(null, 404);
		}
		if (existingVersions.length > 0 && existingVersions[0].fileName !== fileName.trim()) {
			return c.json({ error: 'A file name cannot be changed when saving a new version.' }, 409);
		}

		const savedVersion = await storage.putVersion({
			userId,
			fileId: id,
			fileName: fileName.trim(),
			data,
		});
		return c.json({ id, ...savedVersion }, 201);
	});

	app.get('/api/trash', auth, async (c) => {
		if (!storage) {
			return notConfigured(c);
		}
		return c.json({ files: await storage.listTrash(c.get('userId')) });
	});

	app.post('/api/files/:fileId/trash', auth, async (c) => {
		const found = await resolveOwnedFile(c, storage);
		if (found.response) {
			return found.response;
		}
		const trashedAt = await storage.trashFile(c.get('userId'), found.fileId);
		return c.json({ id: found.fileId, trashedAt });
	});

	app.post('/api/files/:fileId/restore', auth, async (c) => {
		const found = await resolveOwnedFile(c, storage);
		if (found.response) {
			return found.response;
		}
		if (!(await storage.isTrashed(c.get('userId'), found.fileId))) {
			return c.json({ error: 'This portfolio is not in the trash.' }, 409);
		}
		await storage.restoreFile(c.get('userId'), found.fileId);
		return c.json({ id: found.fileId });
	});

	app.delete('/api/files/:fileId', auth, async (c) => {
		const found = await resolveOwnedFile(c, storage);
		if (found.response) {
			return found.response;
		}
		if (!(await storage.isTrashed(c.get('userId'), found.fileId))) {
			return c.json({ error: 'Move this portfolio to the trash before deleting it permanently.' }, 409);
		}
		await storage.deleteFile(c.get('userId'), found.fileId);
		return c.body(null, 204);
	});

	app.get('/api/files/:fileId/versions', auth, async (c) => {
		if (!storage) {
			return notConfigured(c);
		}
		const fileId = c.req.param('fileId');
		if (!FILE_ID_PATTERN.test(fileId)) {
			return c.json({ error: 'Invalid file ID.' }, 400);
		}
		const versions = await storage.listVersions(c.get('userId'), fileId);
		if (versions.length === 0) {
			return c.body(null, 404);
		}
		return c.json({ versions });
	});

	app.get('/api/files/:fileId', auth, async (c) => {
		if (!storage) {
			return notConfigured(c);
		}
		const fileId = c.req.param('fileId');
		const versionId = c.req.query('versionId');
		if (!FILE_ID_PATTERN.test(fileId) || (versionId !== undefined && !VERSION_ID_PATTERN.test(versionId))) {
			return c.json({ error: 'Invalid file or version ID.' }, 400);
		}
		const savedVersion = await storage.getVersion(c.get('userId'), fileId, versionId);
		if (!savedVersion) {
			return c.body(null, 404);
		}
		const validationError = validateShareTrackPayload(savedVersion.data);
		if (validationError) {
			return c.json({ error: 'Stored file failed validation.' }, 502);
		}
		return c.body(JSON.stringify(savedVersion.data), 200, {
			'Content-Type': 'application/json',
			'X-File-Version': savedVersion.versionId,
		});
	});

	app.onError((error, c) => {
		if (error?.code === 'INVALID_STORED_JSON') {
			return c.json({ error: 'Stored file could not be parsed.' }, 502);
		}
		console.error('API request failed:', error);
		return c.json({ error: 'Internal server error.' }, 500);
	});

	return app;
}

/**
 * Resolves `:fileId` to an existing file owned by the caller. Returns
 * `{ fileId }`, or `{ response }` with the error to send.
 */
async function resolveOwnedFile(c, storage) {
	if (!storage) {
		return { response: c.json({ error: 'File storage is not configured.' }, 503) };
	}
	const fileId = c.req.param('fileId');
	if (!FILE_ID_PATTERN.test(fileId)) {
		return { response: c.json({ error: 'Invalid file ID.' }, 400) };
	}
	const versions = await storage.listVersions(c.get('userId'), fileId);
	if (versions.length === 0) {
		return { response: c.body(null, 404) };
	}
	return { fileId };
}

/**
 * Local development only. Used when no Cloudflare Access team domain is set,
 * so `wrangler dev` and `node` can run without an Access token.
 */
function createDevAuthMiddleware(devUserId) {
	return async (c, next) => {
		c.set('userId', devUserId);
		await next();
	};
}

/**
 * Verifies the Cloudflare Access assertion that Access attaches to requests it
 * has authenticated. The token is RS256-signed by the team's keys, so the
 * Worker checks the signature, issuer and audience before trusting `sub`.
 */
function createAccessAuthMiddleware(access) {
	const teamDomain = access?.teamDomain?.trim();
	const audience = access?.audience?.trim();
	const keySet = access?.keySet ?? (teamDomain
		? createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`))
		: null);
	return async (c, next) => {
		if (!teamDomain || !audience || !keySet) {
			return c.json({ error: 'Cloudflare Access authentication is not configured.' }, 503);
		}
		const token = c.req.header('Cf-Access-Jwt-Assertion');
		if (!token) {
			return c.json({ error: 'A Cloudflare Access token is required.' }, 401);
		}
		try {
			const { payload } = await jwtVerify(token, keySet, {
				issuer: `https://${teamDomain}`,
				audience,
				algorithms: ['RS256'],
			});
			if (typeof payload.sub !== 'string' || payload.sub.trim().length === 0 || payload.sub.length > 256) {
				return c.json({ error: 'The Access token must contain a valid subject claim.' }, 401);
			}
			c.set('userId', payload.sub);
		} catch {
			return c.json({ error: 'The Cloudflare Access token is invalid or expired.' }, 401);
		}
		await next();
	};
}

function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
