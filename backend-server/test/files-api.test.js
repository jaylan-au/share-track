import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';
import { SignJWT } from 'jose';
import { createApp } from '../src/index.js';

const jwtSecret = 'test-signing-secret-with-at-least-32-bytes';
const payload = {
	ShareSecurities: [],
	HoldingEntities: [],
	ShareLots: [],
	ShareTransactions: [],
	ShareLotTransactions: [],
	ShareSecurityPriceRecords: [],
};
const records = new Map();
let baseUrl;
let server;

const storage = {
	async listFiles(userId) {
		return [...records.values()].filter((record) => record.userId === userId).map(({ id, fileName, versions }) => ({
			id,
			fileName,
			latestVersionId: versions.at(-1).versionId,
			updatedAt: versions.at(-1).createdAt,
			versionCount: versions.length,
		}));
	},
	async listVersions(userId, fileId) {
		return records.get(fileId)?.userId === userId ? records.get(fileId).versions : [];
	},
	async putVersion({ userId, fileId, fileName, data }) {
		const record = records.get(fileId) ?? { userId, fileName, versions: [] };
		const version = {
			fileName,
			versionId: `${String(record.versions.length + 1).padStart(13, '0')}-00000000-0000-4000-8000-000000000000`,
			createdAt: new Date(1_700_000_000_000 + record.versions.length).toISOString(),
			data: structuredClone(data),
		};
		record.versions.push(version);
		record.userId = userId;
		record.fileName = fileName;
		records.set(fileId, record);
		return { fileName, versionId: version.versionId, createdAt: version.createdAt };
	},
	async getVersion(userId, fileId, versionId) {
		const record = records.get(fileId);
		if (!record || record.userId !== userId) {
			return null;
		}
		const version = versionId
			? record.versions.find((item) => item.versionId === versionId)
			: record.versions.at(-1);
		return version ? structuredClone(version) : null;
	},
};

async function tokenFor(userID) {
	return new SignJWT({ userID })
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('5m')
		.sign(new TextEncoder().encode(jwtSecret));
}

async function request(path, { userID = 'user-a', token, ...options } = {}) {
	const headers = new Headers(options.headers);
	if (token !== false) {
		headers.set('Authorization', `Bearer ${token ?? await tokenFor(userID)}`);
	}
	if (options.body && typeof options.body !== 'string') {
		headers.set('Content-Type', 'application/json');
		options.body = JSON.stringify(options.body);
	}
	return fetch(`${baseUrl}${path}`, { ...options, headers });
}

before(async () => {
	const app = createApp({ storage, jwtSecret });
	server = createServer(app);
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
	await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

beforeEach(() => records.clear());

describe('files API', () => {
	it('requires a valid JWT', async () => {
		const response = await request('/api/files', { token: false });
		assert.equal(response.status, 401);
	});

	it('rejects invalid JSON syntax before storing', async () => {
		const response = await request('/api/files', {
			method: 'POST',
			body: '{invalid',
			headers: { 'Content-Type': 'application/json' },
		});
		assert.equal(response.status, 400);
		assert.equal(records.size, 0);
	});

	it('rejects unsafe payload keys', async () => {
		const unsafePayload = structuredClone(payload);
		unsafePayload.ShareSecurities.push(JSON.parse('{"__proto__":{"isAdmin":true}}'));
		const response = await request('/api/files', {
			method: 'POST',
			body: { fileName: 'portfolio.json', data: unsafePayload },
		});
		assert.equal(response.status, 400);
		assert.equal(records.size, 0);
	});

	it('saves immutable versions and only lists/returns data for the token user', async () => {
		const firstResponse = await request('/api/files', {
			method: 'POST',
			body: { fileName: 'portfolio.json', data: payload },
		});
		assert.equal(firstResponse.status, 201);
		const first = await firstResponse.json();

		const nextPayload = { ...payload, ShareSecurities: [{ id: 'security-1' }] };
		const secondResponse = await request('/api/files', {
			method: 'POST',
			body: { fileId: first.id, fileName: 'portfolio.json', data: nextPayload },
		});
		assert.equal(secondResponse.status, 201);
		const second = await secondResponse.json();
		assert.notEqual(first.versionId, second.versionId);

		const listResponse = await request('/api/files');
		const { files } = await listResponse.json();
		assert.equal(files.length, 1);
		assert.equal(files[0].versionCount, 2);

		const oldVersionResponse = await request(`/api/files/${first.id}?versionId=${first.versionId}`);
		assert.deepEqual(await oldVersionResponse.json(), payload);
		const otherUserResponse = await request(`/api/files/${first.id}`, { userID: 'user-b' });
		assert.equal(otherUserResponse.status, 404);
	});
});