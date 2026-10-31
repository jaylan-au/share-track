import {
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

let lastVersionMillis = 0;

export function createR2StorageFromEnv(env = process.env) {
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
	return createR2Storage(client, R2_BUCKET_NAME);
}

export function createR2Storage(client, bucketName) {
	return {
		async listFiles(userId) {
			const objects = await listUserObjects(client, bucketName, userId);
			const files = new Map();
			for (const object of objects) {
				const parsed = parseObjectKey(object.Key);
				if (!parsed) {
					continue;
				}
				const versions = files.get(parsed.fileId) ?? [];
				versions.push({
					fileName: parsed.fileName,
					versionId: parsed.versionId,
					createdAt: objectTimestamp(object, parsed.versionId),
				});
				files.set(parsed.fileId, versions);
			}
			return [...files.entries()].map(([id, versions]) => {
				versions.sort(compareVersions);
				return {
					id,
					fileName: versions[0].fileName,
					latestVersionId: versions[0].versionId,
					updatedAt: versions[0].createdAt,
					versionCount: versions.length,
				};
			}).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
		},

		async listVersions(userId, fileId) {
			const objects = await listUserObjects(client, bucketName, userId, fileId);
			return objects
				.map((object) => ({ object, parsed: parseObjectKey(object.Key) }))
				.filter(({ parsed }) => parsed?.fileId === fileId)
				.map(({ object, parsed }) => ({
					fileName: parsed.fileName,
					versionId: parsed.versionId,
					createdAt: objectTimestamp(object, parsed.versionId),
				}))
				.sort(compareVersions);
		},

		async putVersion({ userId, fileId, fileName, data }) {
			lastVersionMillis = Math.max(Date.now(), lastVersionMillis + 1);
			const versionId = `${String(lastVersionMillis).padStart(13, '0')}-${randomUUID()}`;
			const key = createObjectKey(userId, fileId, fileName, versionId);
			await client.send(new PutObjectCommand({
				Bucket: bucketName,
				Key: key,
				Body: JSON.stringify(data),
				ContentType: 'application/json; charset=utf-8',
			}));
			return { fileName, versionId, createdAt: versionTimestamp(versionId) };
		},

		async getVersion(userId, fileId, versionId) {
			const versions = await this.listVersions(userId, fileId);
			const selected = versionId
				? versions.find((version) => version.versionId === versionId)
				: versions[0];
			if (!selected) {
				return null;
			}
			const key = createObjectKey(userId, fileId, selected.fileName, selected.versionId);
			const result = await client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
			const text = await result.Body.transformToString();
			try {
				return { ...selected, data: JSON.parse(text) };
			} catch {
				const error = new Error('Stored object is not valid JSON.');
				error.code = 'INVALID_STORED_JSON';
				throw error;
			}
		},
	};
}

async function listUserObjects(client, bucketName, userId, fileId) {
	const prefix = fileId ? `${userPrefix(userId)}${fileId}/` : userPrefix(userId);
	const objects = [];
	let continuationToken;
	do {
		const result = await client.send(new ListObjectsV2Command({
			Bucket: bucketName,
			Prefix: prefix,
			ContinuationToken: continuationToken,
		}));
		objects.push(...(result.Contents ?? []));
		continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
	} while (continuationToken);
	return objects;
}

function userPrefix(userId) {
	return `users/${encodeBase64Url(userId)}/files/`;
}

function createObjectKey(userId, fileId, fileName, versionId) {
	return `${userPrefix(userId)}${fileId}/${encodeBase64Url(fileName)}/${versionId}.json`;
}

function parseObjectKey(key) {
	if (typeof key !== 'string') {
		return null;
	}
	const parts = key.split('/');
	if (parts.length !== 6 || parts[0] !== 'users' || parts[2] !== 'files' || !parts[5].endsWith('.json')) {
		return null;
	}
	const versionId = parts[5].slice(0, -5);
	if (!/^\d{13}-[0-9a-f-]{36}$/i.test(versionId)) {
		return null;
	}
	try {
		return {
			fileId: parts[3],
			fileName: decodeBase64Url(parts[4]),
			versionId,
		};
	} catch {
		return null;
	}
}

function versionTimestamp(versionId) {
	return new Date(Number(versionId.slice(0, 13))).toISOString();
}

function objectTimestamp(object, versionId) {
	const timestamp = object.LastModified instanceof Date ? object.LastModified : new Date(object.LastModified);
	return Number.isNaN(timestamp.getTime()) ? versionTimestamp(versionId) : timestamp.toISOString();
}

function compareVersions(left, right) {
	return right.createdAt.localeCompare(left.createdAt) || right.versionId.localeCompare(left.versionId);
}

function encodeBase64Url(value) {
	return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value) {
	return Buffer.from(value, 'base64url').toString('utf8');
}
