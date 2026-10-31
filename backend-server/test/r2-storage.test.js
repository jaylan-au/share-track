import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
} from '@aws-sdk/client-s3';
import { createR2Storage } from '../src/r2-storage.js';

class MemoryR2Client {
	objects = new Map();
	lastModified = 1_700_000_000_000;

	async send(command) {
		if (command instanceof PutObjectCommand) {
			this.objects.set(command.input.Key, {
				body: command.input.Body,
				lastModified: new Date(this.lastModified++),
			});
			return {};
		}
		if (command instanceof ListObjectsV2Command) {
			const contents = [...this.objects.entries()]
				.filter(([key]) => key.startsWith(command.input.Prefix))
				.map(([Key, value]) => ({ Key, LastModified: value.lastModified }));
			return { Contents: contents, IsTruncated: false };
		}
		if (command instanceof GetObjectCommand) {
			const stored = this.objects.get(command.input.Key);
			if (!stored) {
				throw new Error('Object not found');
			}
			return { Body: { transformToString: async () => stored.body } };
		}
		throw new Error(`Unexpected R2 command: ${command.constructor.name}`);
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
		const client = new MemoryR2Client();
		const storage = createR2Storage(client, 'share-track');
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
		assert.equal(client.objects.size, 2);
		assert.ok([...client.objects.keys()].every((key) => !key.includes('user/a') && !key.includes('my portfolio')));

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