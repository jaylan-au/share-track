const PAYLOAD_FIELDS = [
	'ShareSecurities',
	'HoldingEntities',
	'ShareLots',
	'ShareTransactions',
	'ShareLotTransactions',
	'ShareSecurityPriceRecords',
];
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_ENTITIES_PER_TABLE = 100_000;
const MAX_NESTING_DEPTH = 64;

export function validateShareTrackPayload(payload) {
	if (!isPlainObject(payload)) {
		return 'The JSON document must be an object.';
	}
	const keys = Object.keys(payload);
	if (keys.some((key) => !PAYLOAD_FIELDS.includes(key))) {
		return 'The JSON document contains an unsupported top-level field.';
	}
	for (const field of PAYLOAD_FIELDS) {
		if (!Object.hasOwn(payload, field) || !Array.isArray(payload[field])) {
			return `The JSON document must contain a ${field} array.`;
		}
		if (payload[field].length > MAX_ENTITIES_PER_TABLE) {
			return `The ${field} array contains too many entries.`;
		}
		if (payload[field].some((entity) => !isPlainObject(entity))) {
			return `Every entry in ${field} must be an object.`;
		}
	}

	const pending = [{ value: payload, depth: 0 }];
	while (pending.length > 0) {
		const { value, depth } = pending.pop();
		if (depth > MAX_NESTING_DEPTH) {
			return 'The JSON document is nested too deeply.';
		}
		if (typeof value === 'number' && !Number.isFinite(value)) {
			return 'The JSON document contains an invalid number.';
		}
		if (value === null || typeof value !== 'object') {
			continue;
		}
		for (const key of Object.keys(value)) {
			if (FORBIDDEN_KEYS.has(key)) {
				return 'The JSON document contains a forbidden object key.';
			}
			pending.push({ value: value[key], depth: depth + 1 });
		}
	}

	return null;
}

function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}