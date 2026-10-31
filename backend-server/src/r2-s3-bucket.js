import {
	DeleteObjectsCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';

/**
 * Node-only adapter that exposes an R2 bucket through the S3 API with the
 * same `put`/`get`/`delete`/`list` shape as the Workers R2 binding.
 */
export function createS3R2Bucket(client, bucketName) {
	return {
		async put(key, body, options = {}) {
			await client.send(new PutObjectCommand({
				Bucket: bucketName,
				Key: key,
				Body: body,
				ContentType: options.httpMetadata?.contentType,
			}));
		},

		async delete(keys) {
			const keyList = Array.isArray(keys) ? keys : [keys];
			if (keyList.length === 0) {
				return;
			}
			await client.send(new DeleteObjectsCommand({
				Bucket: bucketName,
				Delete: { Objects: keyList.map((key) => ({ Key: key })), Quiet: true },
			}));
		},

		async get(key) {
			try {
				const result = await client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
				return { text: () => result.Body.transformToString() };
			} catch (error) {
				if (error?.name === 'NoSuchKey') {
					return null;
				}
				throw error;
			}
		},

		async list({ prefix, cursor }) {
			const result = await client.send(new ListObjectsV2Command({
				Bucket: bucketName,
				Prefix: prefix,
				ContinuationToken: cursor,
			}));
			return {
				objects: (result.Contents ?? []).map((object) => ({ key: object.Key, uploaded: object.LastModified })),
				truncated: Boolean(result.IsTruncated),
				cursor: result.NextContinuationToken,
			};
		},
	};
}

export function createS3R2BucketFromEnv(env = process.env) {
	const { CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = env;
	if (!CLOUDFLARE_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
		return null;
	}
	const client = new S3Client({
		region: 'auto',
		endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: R2_ACCESS_KEY_ID,
			secretAccessKey: R2_SECRET_ACCESS_KEY,
		},
	});
	return createS3R2Bucket(client, R2_BUCKET_NAME);
}
