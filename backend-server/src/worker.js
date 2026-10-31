import { createApp } from './app.js';
import { readAppConfig } from './config.js';
import { createR2Storage } from './r2-storage.js';

/**
 * Cloudflare Workers entry point. Bindings come from wrangler.jsonc:
 * the R2 bucket is `R2_BUCKET`. Cloudflare Access settings come from `vars` in wrangler.jsonc.
 */
const appsByEnv = new WeakMap();

function getApp(env) {
	let app = appsByEnv.get(env);
	if (!app) {
		app = createApp({
			storage: env.R2_BUCKET ? createR2Storage(env.R2_BUCKET) : null,
			...readAppConfig(env),
		});
		appsByEnv.set(env, app);
	}
	return app;
}

export default {
	fetch(request, env, ctx) {
		return getApp(env).fetch(request, env, ctx);
	},
};
