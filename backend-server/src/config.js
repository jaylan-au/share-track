/**
 * Reads the runtime-independent app settings from an env-like object.
 * Works with Node's `process.env` and with the Workers `env` binding object
 * (secrets and vars are both exposed as plain string properties).
 *
 * `DEV_AUTH=true` (set in `.dev.vars` or the shell) enables a fixed local user
 * for development. It is ignored whenever `CF_ACCESS_TEAM_DOMAIN` is set, so a
 * deployed Worker always requires Cloudflare Access.
 */
export function readAppConfig(env) {
	const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim() ?? '';
	const devAuthEnabled = env.DEV_AUTH === 'true' && teamDomain === '';
	return {
		access: {
			teamDomain: env.CF_ACCESS_TEAM_DOMAIN,
			audience: env.CF_ACCESS_AUD,
		},
		allowedOrigins: (env.WEB_APP_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
		devUserId: devAuthEnabled ? (env.DEV_USER_ID?.trim() || 'local-dev-user') : null,
	};
}
