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
});