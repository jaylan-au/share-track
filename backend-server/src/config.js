/**
 * Reads the runtime-independent app settings from an env-like object.
 * Works with Node's `process.env` and with the Workers `env` binding object
 * (secrets and vars are both exposed as plain string properties).
 */
export function readAppConfig(env) {
	return {
		access: {
			teamDomain: env.CF_ACCESS_TEAM_DOMAIN,
			audience: env.CF_ACCESS_AUD,
		},
		allowedOrigins: (env.WEB_APP_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
	};
}
