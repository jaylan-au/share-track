# Share Track

Share Track is an npm-workspaces monorepo containing the frontend and backend.

## Workspaces

- `web-app` contains the Preact and Vite frontend.
- `backend-server` contains the Hono API server.

## Development

Run `npm install` at the repository root, then start either workspace:

- `npm run dev` starts the frontend at http://localhost:5173/.
- `npm run dev:server` starts the Hono server on port 3000.
- `npm run build` builds the frontend for production.

### Local end-to-end

1. In `backend-server`, copy `.dev.vars.example` to `.dev.vars` and run `npm run dev:worker` (API on http://localhost:8787). `DEV_AUTH=true` skips Access locally.
2. In `web-app`, run `npm run dev`. `web-app/.env.development` already points at the local API.

### Online and offline modes

The web app reads `VITE_ONLINE_FILES_ENABLED` at build time (set in `web-app/.env.development` and `web-app/.env.production`):

- `true`: on start, the app checks for a signed-in session. If there is none it shows a splash screen offering **Sign in for online portfolios** or **Continue without signing in**. Online save and the Portfolios list only appear when signed in.
- `false`: a local-only build. No splash, no sign-in, and no online save/load options. JSON upload and download still work.


- **API:** deploy the Worker from `backend-server` with `npm run deploy`, after setting the Access values in `wrangler.jsonc`. See [backend-server/README.md](backend-server/README.md).
- **Web app:** set `VITE_API_BASE_URL` in `web-app/.env.production` to the Worker's custom domain, then run `npm run deploy:pages --workspace @share-track/web-app` to publish to Cloudflare Pages. The Pages project name is set in that script.
- The web app and API must share a parent domain (`share-track.lab.jaylancowie.com` for the app and `api.share-track.lab.jaylancowie.com` for the API), so the Access cookie is sent with each request. Add the web origin to `WEB_APP_ORIGINS`.


The backend exposes file endpoints protected by Cloudflare Access. Access must sit in front of the deployed Worker, and the server verifies the `Cf-Access-Jwt-Assertion` RS256 token against the team's JWKS, checking the issuer and audience. Configure `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `WEB_APP_ORIGINS` (comma-separated allowed browser origins). The user identity is the token's `sub` claim. See [backend-server/README.md](backend-server/README.md) for the deployment steps.

- `GET /api/files` lists the signed-in user's files.
- `POST /api/files` accepts `{ "fileName": "portfolio.json", "data": { ... } }`; pass an existing `fileId` to save another immutable version.
- `GET /api/files/:fileId/versions` lists a file's versions.
- `GET /api/files/:fileId?versionId=...` returns the latest JSON, or the selected version.
- `GET /api/trash` lists trashed files.
- `POST /api/files/:fileId/trash` moves a file to the trash; `POST /api/files/:fileId/restore` brings it back.
- `DELETE /api/files/:fileId` permanently deletes a file, and only works once it is in the trash.

Uploads are limited to 5 MB and validated against the frontend's six-array export format before being written to R2. R2 object keys include a base64url-encoded user ID, keeping each user's files isolated. Run `npm run test --workspace @share-track/backend-server` to test the API without Cloudflare credentials.
