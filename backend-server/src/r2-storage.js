let lastVersionMillis = 0;
const TRASH_MARKER = '_trash';
const MAX_DELETE_BATCH = 1000;

/**
 * Creates file storage over an R2 bucket binding-shaped object:
 * `put(key, body)`, `get(key)` (resolving to an object with `text()` or null),
 * `delete(keys)` (a key or array of keys), and `list({ prefix, cursor })`
 * (resolving to `{ objects, truncated, cursor }`).
 * Workers pass the native R2 binding; Node passes an S3-backed bucket.
 *
 * Trashing a file writes a marker object (`<fileId>/_trash`) next to its
 * versions instead of moving them, because R2 has no move operation.
 */
export function createR2Storage(bucket) {
	return {
		async listFiles(userId) {
			const { files, trashed } = await readFileIndex(bucket, userId);
			return summarizeFiles(files, (fileId) => !trashed.has(fileId));
		},

		async listTrash(userId) {
			const { files, trashed } = await readFileIndex(bucket, userId);
			return summarizeFiles(files, (fileId) => trashed.has(fileId))
				.map((file) => ({ ...file, trashedAt: trashed.get(file.id) }));
		},

		async isTrashed(userId, fileId) {
			return (await bucket.get(trashMarkerKey(userId, fileId))) !== null;
		},

		async trashFile(userId, fileId) {
			await bucket.put(trashMarkerKey(userId, fileId), '', {
				httpMetadata: { contentType: 'text/plain' },
			});
			return (await readTrashedAt(bucket, userId, fileId)) ?? new Date().toISOString();
		},

		async restoreFile(userId, fileId) {
			await bucket.delete(trashMarkerKey(userId, fileId));
		},

		async deleteFile(userId, fileId) {
			const objects = await listUserObjects(bucket, userId, fileId);
			await deleteKeys(bucket, objects.map((object) => object.key));
		},

		async listVersions(userId, fileId) {
			const objects = await listUserObjects(bucket, userId, fileId);
			return objects
				.map((object) => ({ object, parsed: parseObjectKey(object.key) }))
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
			const versionId = `${String(lastVersionMillis).padStart(13, '0')}-${crypto.randomUUID()}`;
			const key = createObjectKey(userId, fileId, fileName, versionId);
			await bucket.put(key, JSON.stringify(data), {
				httpMetadata: { contentType: 'application/json; charset=utf-8' },
			});
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
			const object = await bucket.get(key);
			if (!object) {
				return null;
			}
			const text = await object.text();
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

async function readFileIndex(bucket, userId) {
	const objects = await listUserObjects(bucket, userId);
	const files = new Map();
	const trashed = new Map();
	for (const object of objects) {
		const trashedFileId = parseTrashMarkerKey(object.key);
		if (trashedFileId) {
			trashed.set(trashedFileId, toIsoString(object.uploaded) ?? new Date(0).toISOString());
			continue;
		}
		const parsed = parseObjectKey(object.key);
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
	return { files, trashed };
}

function summarizeFiles(files, include) {
	return [...files.entries()]
		.filter(([fileId]) => include(fileId))
		.map(([id, versions]) => {
			versions.sort(compareVersions);
			return {
				id,
				fileName: versions[0].fileName,
				latestVersionId: versions[0].versionId,
				updatedAt: versions[0].createdAt,
				versionCount: versions.length,
			};
		})
		.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

async function readTrashedAt(bucket, userId, fileId) {
	const objects = await listUserObjects(bucket, userId, fileId);
	const marker = objects.find((object) => parseTrashMarkerKey(object.key) === fileId);
	return marker ? toIsoString(marker.uploaded) : null;
}

async function deleteKeys(bucket, keys) {
	for (let index = 0; index < keys.length; index += MAX_DELETE_BATCH) {
		await bucket.delete(keys.slice(index, index + MAX_DELETE_BATCH));
	}
}

function trashMarkerKey(userId, fileId) {
	return `${userPrefix(userId)}${fileId}/${TRASH_MARKER}`;
}

function parseTrashMarkerKey(key) {
	const parts = typeof key === 'string' ? key.split('/') : [];
	return parts.length === 5 && parts[0] === 'users' && parts[2] === 'files' && parts[4] === TRASH_MARKER
		? parts[3]
		: null;
}

function toIsoString(value) {
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function listUserObjects(bucket, userId, fileId) {
	const prefix = fileId ? `${userPrefix(userId)}${fileId}/` : userPrefix(userId);
	const objects = [];
	let cursor;
	do {
		const result = await bucket.list({ prefix, cursor });
		objects.push(...result.objects);
		cursor = result.truncated ? result.cursor : undefined;
	} while (cursor);
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
	const timestamp = object.uploaded instanceof Date ? object.uploaded : new Date(object.uploaded);
	return Number.isNaN(timestamp.getTime()) ? versionTimestamp(versionId) : timestamp.toISOString();
}

function compareVersions(left, right) {
	return right.createdAt.localeCompare(left.createdAt) || right.versionId.localeCompare(left.versionId);
}

function encodeBase64Url(value) {
	const bytes = new TextEncoder().encode(value);
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodeBase64Url(value) {
	const base64 = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
	const binary = atob(base64);
	return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}
