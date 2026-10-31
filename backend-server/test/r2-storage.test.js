import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createR2Storage } from '../src/r2-storage.js';

class MemoryR2Bucket {
	objects = new Map();
	lastModified = 1_700_000_000_000;

	async put(key, body) {
		this.objects.set(key, { body, uploaded: new Date(this.lastModified++) });
	}

	async get(key) {
		const stored = this.objects.get(key);
		if (!stored) {
			return null;
		}
		return { text: async () => stored.body };
	}

	async list({ prefix = '' } = {}) {
		const objects = [...this.objects.entries()]
			.filter(([key]) => key.startsWith(prefix))
			.map(([key, value]) => ({ key, uploaded: value.uploaded }));
		return { objects, truncated: false, cursor: undefined };
	}

	async delete(keys) {
		for (const key of Array.isArray(keys) ? keys : [keys]) {
			this.objects.delete(key);
		}
	}
}

const emptyPortfolio = {
	ShareSecurities: [],
	HoldingEntities: [],
	ShareLots: [],
	ShareTransactions: [],
	ShareLotTransactions: [],
	ShareSecurityPriceRecords: [],
};

describe('R2 storage', () => {
	it('stores immutable versions under user-specific keys and supports version selection', async () => {
		const bucket = new MemoryR2Bucket();
		const storage = createR2Storage(bucket);
		const first = await storage.putVersion({
			userId: 'user/a',
			fileId: '04ebd6a7-cb9a-4b4c-886e-8488f7145c48',
			fileName: 'my portfolio.json',
			data: emptyPortfolio,
		});
		const updatedPayload = { ...emptyPortfolio, ShareSecurities: [{ id: 'security-1' }] };
		const second = await storage.putVersion({
			userId: 'user/a',
			fileId: '04ebd6a7-cb9a-4b4c-886e-8488f7145c48',
			fileName: 'my portfolio.json',
			data: updatedPayload,
		});

		assert.notEqual(first.versionId, second.versionId);
		assert.equal(bucket.objects.size, 2);
		assert.ok([...bucket.objects.keys()].every((key) => !key.includes('user/a') && !key.includes('my portfolio')));

		const files = await storage.listFiles('user/a');
		assert.equal(files.length, 1);
		assert.equal(files[0].versionCount, 2);
		assert.equal(files[0].latestVersionId, second.versionId);

		const selected = await storage.getVersion('user/a', files[0].id, first.versionId);
		assert.deepEqual(selected.data, emptyPortfolio);
		assert.deepEqual(await storage.listFiles('user-b'), []);
		assert.equal(await storage.getVersion('user-b', files[0].id), null);
	});

	it('trashes, lists, and restores files without touching their versions', async () => {
		const bucket = new MemoryR2Bucket();
		const storage = createR2Storage(bucket);
		const fileId = '04ebd6a7-cb9a-4b4c-886e-8488f7145c48';
		await storage.putVersion({ userId: 'user-a', fileId, fileName: 'a.json', data: emptyPortfolio });

		assert.equal(await storage.isTrashed('user-a', fileId), false);
		await storage.trashFile('user-a', fileId);
		assert.equal(await storage.isTrashed('user-a', fileId), true);
		assert.deepEqual(await storage.listFiles('user-a'), []);

		const trashed = await storage.listTrash('user-a');
		assert.equal(trashed.length, 1);
		assert.equal(trashed[0].id, fileId);
		assert.ok(trashed[0].trashedAt);
		assert.equal((await storage.listTrash('user-b')).length, 0);

		await storage.restoreFile('user-a', fileId);
		assert.equal(await storage.isTrashed('user-a', fileId), false);
		assert.equal((await storage.listFiles('user-a')).length, 1);
	});

	it('permanently deletes every stored object for a file, and nothing else', async () => {
		const bucket = new MemoryR2Bucket();
		const storage = createR2Storage(bucket);
		const fileId = '04ebd6a7-cb9a-4b4c-886e-8488f7145c48';
		const otherId = '1f0e6d2a-3b4c-4d5e-8f60-718293a4b5c6';
		await storage.putVersion({ userId: 'user-a', fileId, fileName: 'a.json', data: emptyPortfolio });
		await storage.putVersion({ userId: 'user-a', fileId, fileName: 'a.json', data: emptyPortfolio });
		await storage.putVersion({ userId: 'user-a', fileId: otherId, fileName: 'b.json', data: emptyPortfolio });
		await storage.trashFile('user-a', fileId);

		await storage.deleteFile('user-a', fileId);

		assert.deepEqual(await storage.listVersions('user-a', fileId), []);
		assert.equal(await storage.isTrashed('user-a', fileId), false);
		const remaining = await storage.listFiles('user-a');
		assert.equal(remaining.length, 1);
		assert.equal(remaining[0].id, otherId);
	});
});