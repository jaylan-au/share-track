import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
} from '@aws-sdk/client-s3';
import { createS3R2Bucket, createS3R2BucketFromEnv } from '../src/r2-s3-bucket.js';

function fakeClient(handler) {
	const sent = [];
	return {
		sent,
		async send(command) {
			sent.push(command);
			return handler(command);
		},
	};
}

describe('S3 R2 bucket adapter', () => {
	it('maps put to PutObjectCommand with the content type', async () => {
		const client = fakeClient(async () => ({}));
		const bucket = createS3R2Bucket(client, 'share-track');
		await bucket.put('a/key', '{"x":1}', { httpMetadata: { contentType: 'application/json' } });
		const [command] = client.sent;
		assert.ok(command instanceof PutObjectCommand);
		assert.equal(command.input.Bucket, 'share-track');
		assert.equal(command.input.Key, 'a/key');
		assert.equal(command.input.Body, '{"x":1}');
		assert.equal(command.input.ContentType, 'application/json');
	});

	it('returns text for an existing object and null for a missing one', async () => {
		const client = fakeClient(async (command) => {
			if (command.input.Key === 'missing') {
				const error = new Error('no such key');
				error.name = 'NoSuchKey';
				throw error;
			}
			return { Body: { transformToString: async () => 'payload' } };
		});
		const bucket = createS3R2Bucket(client, 'share-track');
		assert.ok(client.sent.length === 0);
		const object = await bucket.get('present');
		assert.ok(client.sent[0] instanceof GetObjectCommand);
		assert.equal(await object.text(), 'payload');
		assert.equal(await bucket.get('missing'), null);
	});

	it('rethrows unexpected errors from get', async () => {
		const client = fakeClient(async () => {
			throw new Error('network down');
		});
		const bucket = createS3R2Bucket(client, 'share-track');
		await assert.rejects(() => bucket.get('any'), /network down/);
	});

	it('maps list results and passes the continuation token through', async () => {
		const client = fakeClient(async () => ({
			Contents: [{ Key: 'u/1', LastModified: new Date(1000) }],
			IsTruncated: true,
			NextContinuationToken: 'next-token',
		}));
		const bucket = createS3R2Bucket(client, 'share-track');
		const page = await bucket.list({ prefix: 'u/', cursor: 'prev-token' });
		const [command] = client.sent;
		assert.ok(command instanceof ListObjectsV2Command);
		assert.equal(command.input.Prefix, 'u/');
		assert.equal(command.input.ContinuationToken, 'prev-token');
		assert.deepEqual(page, {
			objects: [{ key: 'u/1', uploaded: new Date(1000) }],
			truncated: true,
			cursor: 'next-token',
		});
	});

	it('returns null from the env factory unless all R2 settings are present', () => {
		assert.equal(createS3R2BucketFromEnv({}), null);
		assert.equal(createS3R2BucketFromEnv({
			CLOUDFLARE_ACCOUNT_ID: 'acct',
			R2_ACCESS_KEY_ID: 'key',
			R2_SECRET_ACCESS_KEY: 'secret',
		}), null);
		assert.equal(typeof createS3R2BucketFromEnv({
			CLOUDFLARE_ACCOUNT_ID: 'acct',
			R2_ACCESS_KEY_ID: 'key',
			R2_SECRET_ACCESS_KEY: 'secret',
			R2_BUCKET_NAME: 'share-track',
		}).put, 'function');
	});
});
