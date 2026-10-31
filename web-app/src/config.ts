/// <reference types="vite/client" />

/**
 * Build-time switch for online portfolios. When false the app runs local-only: no splash
 * screen, no sign-in, and no online save/load options. Set VITE_ONLINE_FILES_ENABLED in
 * .env.development / .env.production.
 */
export const onlineFilesEnabled = import.meta.env.VITE_ONLINE_FILES_ENABLED === 'true';
