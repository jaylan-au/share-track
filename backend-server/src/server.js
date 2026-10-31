import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { readAppConfig } from './config.js';
import { createR2Storage } from './r2-storage.js';
import { createS3R2BucketFromEnv } from './r2-s3-bucket.js';

const bucket = createS3R2BucketFromEnv(process.env);
const app = createApp({
	storage: bucket ? createR2Storage(bucket) : null,
	...readAppConfig(process.env),
});
const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, () => {
	console.log(`Backend server listening on port ${port}`);
});
