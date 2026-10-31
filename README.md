# Share Track

Share Track is an npm-workspaces monorepo containing the frontend and backend.

## Workspaces

- `web-app` contains the Preact and Vite frontend.
- `backend-server` contains the Express API server.

## Development

Run `npm install` at the repository root, then start either workspace:

- `npm run dev` starts the frontend at http://localhost:5173/.
- `npm run dev:server` starts the Express server on port 3000.
- `npm run build` builds the frontend for production.

The backend exposes JWT-protected file endpoints. Configure `JWT_SECRET` with a random secret of at least 32 bytes, `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `WEB_APP_ORIGINS` (comma-separated allowed browser origins). JWTs must use HS256 and include a string `userID` claim.

- `GET /api/files` lists the signed-in user's files.
- `POST /api/files` accepts `{ "fileName": "portfolio.json", "data": { ... } }`; pass an existing `fileId` to save another immutable version.
- `GET /api/files/:fileId/versions` lists a file's versions.
- `GET /api/files/:fileId?versionId=...` returns the latest JSON, or the selected version.

Uploads are limited to 5 MB and validated against the frontend's six-array export format before being written to R2. R2 object keys include a base64url-encoded user ID, keeping each user's files isolated. Run `npm run test --workspace @share-track/backend-server` to test the API without Cloudflare credentials.
