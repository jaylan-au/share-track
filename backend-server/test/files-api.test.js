import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { createApp } from '../src/app.js';

const teamDomain = 'test-team.cloudflareaccess.com';
const audience = 'test-access-audience-tag';
const { publicKey, privateKey } = await generateKeyPair('RS256');
const keySet = createLocalJWKSet({
	keys: [{ ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' }],
});
const access = { teamDomain, audience, keySet };
const payload = {
	ShareSecurities: [],
	HoldingEntities: [],
	ShareLots: [],
	ShareTransactions: [],
	ShareLotTransactions: [],
	ShareSecurityPriceRecords: [],
};
const records = new Map();
let app;

function summarize([id, record]) {
	return {
		id,
		fileName: record.fileName,
		latestVersionId: record.versions.at(-1).versionId,
		updatedAt: record.versions.at(-1).createdAt,
		versionCount: record.versions.length,
	};
}

const storage = {
	async listFiles(userId) {
		return [...records.entries()]
			.filter(([, record]) => record.userId === userId && !record.trashedAt)
			.map(summarize);
	},
	async listTrash(userId) {
		return [...records.entries()]
			.filter(([, record]) => record.userId === userId && record.trashedAt)
			.map(([id, record]) => ({ ...summarize([id, record]), trashedAt: record.trashedAt }));
	},
	async isTrashed(userId, fileId) {
		const record = records.get(fileId);
		return Boolean(record && record.userId === userId && record.trashedAt);
	},
	async trashFile(userId, fileId) {
		const record = records.get(fileId);
		record.trashedAt = new Date(1_700_000_100_000).toISOString();
		return record.trashedAt;
	},
	async restoreFile(userId, fileId) {
		delete records.get(fileId).trashedAt;
	},
	async deleteFile(userId, fileId) {
		records.delete(fileId);
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

async function tokenFor(userID, { audience: tokenAudience = audience, issuer = `https://${teamDomain}` } = {}) {
	return new SignJWT({ email: `${userID}@example.com` })
		.setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
		.setSubject(userID)
		.setIssuer(issuer)
		.setAudience(tokenAudience)
		.setIssuedAt()
		.setExpirationTime('5m')
		.sign(privateKey);
}

async function request(path, { userID = 'user-a', token, assertion, ...options } = {}) {
	const headers = new Headers(options.headers);
	if (assertion !== undefined) {
		headers.set('Cf-Access-Jwt-Assertion', assertion);
	} else if (token !== false) {
		headers.set('Cf-Access-Jwt-Assertion', await tokenFor(userID));
	}
	if (options.body && typeof options.body !== 'string') {
		headers.set('Content-Type', 'application/json');
		options.body = JSON.stringify(options.body);
	}
	return app.request(path, { ...options, headers });
}

beforeEach(() => {
	records.clear();
	app = createApp({ storage, access, allowedOrigins: ['http://localhost:5173'] });
});

describe('files API', () => {
	it('requires a Cloudflare Access token', async () => {
		const response = await request('/api/files', { token: false });
		assert.equal(response.status, 401);
	});

	it('rejects tokens with the wrong audience or issuer', async () => {
		const wrongAudience = await request('/api/files', {
			assertion: await tokenFor('user-a', { audience: 'other-app' }),
		});
		assert.equal(wrongAudience.status, 401);
		const wrongIssuer = await request('/api/files', {
			assertion: await tokenFor('user-a', { issuer: 'https://attacker.cloudflareaccess.com' }),
		});
		assert.equal(wrongIssuer.status, 401);
		const garbage = await request('/api/files', { assertion: 'not-a-jwt' });
		assert.equal(garbage.status, 401);
	});

	it('returns 503 when Cloudflare Access settings are missing', async () => {
		app = createApp({ storage, access: {}, allowedOrigins: [] });
		const response = await request('/api/files');
		assert.equal(response.status, 503);
	});

	it('does not require authentication for health checks or CORS preflight', async () => {
		const health = await request('/health', { token: false });
		assert.equal(health.status, 200);
		const preflight = await request('/api/files', {
			method: 'OPTIONS',
			token: false,
			headers: { Origin: 'http://localhost:5173' },
		});
		assert.equal(preflight.status, 204);
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

	it('moves a portfolio to trash, hides it from the list, and restores it', async () => {
		const created = await (await request('/api/files', {
			method: 'POST',
			body: { fileName: 'portfolio.json', data: payload },
		})).json();

		const trashResponse = await request(`/api/files/${created.id}/trash`, { method: 'POST' });
		assert.equal(trashResponse.status, 200);
		assert.ok((await trashResponse.json()).trashedAt);

		const { files } = await (await request('/api/files')).json();
		assert.equal(files.length, 0);
		const { files: trashed } = await (await request('/api/trash')).json();
		assert.equal(trashed.length, 1);
		assert.equal(trashed[0].id, created.id);

		const saveResponse = await request('/api/files', {
			method: 'POST',
			body: { fileId: created.id, fileName: 'portfolio.json', data: payload },
		});
		assert.equal(saveResponse.status, 409);

		const restoreResponse = await request(`/api/files/${created.id}/restore`, { method: 'POST' });
		assert.equal(restoreResponse.status, 200);
		const restoredList = await (await request('/api/files')).json();
		assert.equal(restoredList.files.length, 1);
	});

	it('only permanently deletes portfolios that are already in trash', async () => {
		const created = await (await request('/api/files', {
			method: 'POST',
			body: { fileName: 'portfolio.json', data: payload },
		})).json();

		const activeDelete = await request(`/api/files/${created.id}`, { method: 'DELETE' });
		assert.equal(activeDelete.status, 409);
		assert.equal(records.size, 1);

		await request(`/api/files/${created.id}/trash`, { method: 'POST' });
		const deleteResponse = await request(`/api/files/${created.id}`, { method: 'DELETE' });
		assert.equal(deleteResponse.status, 204);
		assert.equal(records.size, 0);
	});

	it('returns 404 for trash actions on unknown or other users\' portfolios', async () => {
		const created = await (await request('/api/files', {
			method: 'POST',
			body: { fileName: 'portfolio.json', data: payload },
		})).json();

		const missing = await request(`/api/files/${crypto.randomUUID()}/trash`, { method: 'POST' });
		assert.equal(missing.status, 404);
		const otherUser = await request(`/api/files/${created.id}/trash`, { method: 'POST', userID: 'user-b' });
		assert.equal(otherUser.status, 404);
		assert.equal(records.get(created.id).trashedAt, undefined);
	});
});

describe('local dev auth', () => {
	it('uses the configured dev user without a Cloudflare Access token', async () => {
		app = createApp({ storage, access: {}, allowedOrigins: [], devUserId: 'local-dev-user' });
		const saved = await app.request('/api/files', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ fileName: 'portfolio.json', data: payload }),
		});
		assert.equal(saved.status, 201);
		const listed = await (await app.request('/api/files')).json();
		assert.equal(listed.files.length, 1);
		assert.equal(records.get(listed.files[0].id).userId, 'local-dev-user');
	});
});