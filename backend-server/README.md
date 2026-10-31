# Backend Server

Hono API for saving, listing, and retrieving Share Track JSON files in Cloudflare R2. The app is framework-agnostic Hono code, and it runs on two targets: Node (via `@hono/node-server`) and Cloudflare Workers. All file endpoints require a Cloudflare Access token.

## Requirements

- Node.js 20 or later
- An R2 bucket. For Node, S3 API credentials. For Workers, the R2 binding in `wrangler.jsonc`.
- A Cloudflare Access application protecting the hostname that serves this Worker (see [Deployment](#deployment-to-cloudflare-workers-behind-cloudflare-access))

## Environment Variables

Node reads `process.env` directly and does not load `.env` files. Workers reads bindings and variables from `env`. Non-secret settings come from `vars` in `wrangler.jsonc`, and the R2 binding is also declared there.

| Variable | Node | Workers | Description |
| --- | --- | --- | --- |
| `CF_ACCESS_TEAM_DOMAIN` | Yes | `vars` | Your Zero Trust team domain, such as `your-team.cloudflareaccess.com`. Access tokens are validated against its keys and issuer. |
| `CF_ACCESS_AUD` | Yes | `vars` | The Application Audience (AUD) tag of the Access application that protects this server. |
| `WEB_APP_ORIGINS` | For browser access | `vars` | Comma-separated exact origins allowed by CORS, such as `http://localhost:5173,https://share-track.lab.jaylancowie.com`. |
| `DEV_AUTH` | Local only | `.dev.vars` | Set to `true` to skip Access locally and act as `DEV_USER_ID`. Ignored when `CF_ACCESS_TEAM_DOMAIN` is set. |
| `DEV_USER_ID` | Local only | `.dev.vars` | Fixed user id used with `DEV_AUTH`. Defaults to `local-dev-user`. |
| `CLOUDFLARE_ACCOUNT_ID` | Yes for R2 | Not used | Cloudflare account ID used to build the R2 S3 endpoint. |
| `R2_ACCESS_KEY_ID` | Yes for R2 | Not used | R2 S3 API access key ID. |
| `R2_SECRET_ACCESS_KEY` | Yes for R2 | Not used | R2 S3 API secret access key. |
| `R2_BUCKET_NAME` | Yes for R2 | Not used | Existing bucket name where file versions are stored. |
| `R2_BUCKET` | Not used | R2 binding | Bucket binding declared in `wrangler.jsonc`. |
| `PORT` | No | Not used | HTTP listen port. Defaults to `3000`. |

On Node, configure the four R2 variables together. If any is missing, the server starts without storage and file routes respond with `503`; `/health` remains available. On Workers, a missing `R2_BUCKET` binding gives the same `503` behaviour. Create an R2 API token with object read and write access to this bucket. Keep the R2 access key and secret out of source control and browser code.

Authentication uses Cloudflare Access. The server does not issue or accept its own tokens. For each `/api/files` request it reads the `Cf-Access-Jwt-Assertion` header that Access attaches for signed-in users, then checks that the token is RS256, was issued by `https://<CF_ACCESS_TEAM_DOMAIN>`, has `CF_ACCESS_AUD` in its audience, and is unexpired. The user identity is the token's `sub` claim. If `CF_ACCESS_TEAM_DOMAIN` or `CF_ACCESS_AUD` is missing, file routes respond with `503`.

## Install and Run

From the monorepo root:

```sh
npm install
npm run dev:server
```

Or from this directory:

```sh
npm run dev
```

The production command is `npm run start:server` from the root, or `npm start` from this directory. The Node entry point is `src/server.js`. The Workers entry point is `src/worker.js`. Both build the same Hono app from `src/app.js`, and shared settings are read by `src/config.js`. Run the backend tests with `npm test --workspace @share-track/backend-server` from the root.

For local Node development, export environment variables in the shell before starting the server. For deployment, configure them through the hosting provider's secret/environment-variable settings. Do not commit real credentials in an example env file.

### Cloudflare Workers

The Worker, its R2 binding and its non-secret settings are in `wrangler.jsonc`. Commands are run from this directory:

```sh
npm run dev:worker   # local Worker via wrangler dev
npm run deploy       # deploy to Cloudflare Workers
```

### Local development settings

`wrangler dev` cannot pass Access checks, so local runs use a `.dev.vars` file instead:

```sh
cp .dev.vars.example .dev.vars
npm run dev:worker   # API at http://localhost:8787
```

`.dev.vars` is git-ignored and overrides the `vars` in `wrangler.jsonc`. The example sets `DEV_AUTH=true` and clears `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD`, so every request acts as `DEV_USER_ID` (default `local-dev-user`). By default `wrangler dev` simulates R2 locally under `.wrangler/`, so local data stays separate from the deployed bucket.

`DEV_AUTH` is only honoured when `CF_ACCESS_TEAM_DOMAIN` is empty. A deployed Worker has the team domain set, so it always requires Access, even if `DEV_AUTH` were set by mistake. Test real Access behaviour against the deployed Worker.

The web app reads `VITE_API_BASE_URL` from `web-app/.env.development` (`http://localhost:8787`), and its Vite dev server origin (`http://localhost:5173`) must be listed in `WEB_APP_ORIGINS`.

## Deployment to Cloudflare Workers behind Cloudflare Access

Access handles sign-in at the edge. The Worker then verifies the signed Access token itself, so the Worker only trusts requests that came through Access. The steps below assume a Cloudflare account with Zero Trust enabled.

1. **Create the R2 bucket.** Run `npx wrangler r2 bucket create share-track`, or create it in the dashboard under R2. Keep it private. If you choose another name, update `bucket_name` in `wrangler.jsonc`.
2. **Sign in to Wrangler.** Run `npx wrangler login`, or set `CLOUDFLARE_API_TOKEN` to a token that can edit Workers and R2.
3. **Find your team domain.** In the Zero Trust dashboard, the team domain is shown on the overview page (for example `your-team.cloudflareaccess.com`). Set it as `CF_ACCESS_TEAM_DOMAIN` in `wrangler.jsonc`.
4. **Set the allowed web origin.** Set `WEB_APP_ORIGINS` in `wrangler.jsonc` to the deployed web app origin, `https://share-track.lab.jaylancowie.com`. Use exact origins, separated by commas. The `routes` entry in `wrangler.jsonc` binds the Worker to `api.share-track.lab.jaylancowie.com`. The zone `jaylancowie.com` must be in the same Cloudflare account.
5. **Deploy once to get a hostname.** Run `npm run deploy`. Use a custom domain (a route on a zone in your account) for production so the hostname is stable. A `workers.dev` hostname also works for testing.
6. **Create the Access application.** In Zero Trust, go to **Access controls > Applications > Add an application**, choose **Self-hosted**, and set the application domain to the Worker hostname. Give the application a session duration, then add an **Allow** policy that includes the people or groups who may use the app.
7. **Copy the Audience (AUD) tag.** Open the application's settings and copy its **Application Audience (AUD) tag**. Set it as `CF_ACCESS_AUD` in `wrangler.jsonc`.
8. **Redeploy.** Run `npm run deploy` again so the Worker picks up the Access settings.
9. **Verify.**
   - Open `https://<worker-host>/api/files` in a browser. Access should ask you to sign in, and after sign-in you should see `{"files":[]}`.
   - Run `curl -i https://<worker-host>/api/files` without signing in. You should get an Access sign-in response, not file data.
   - If the response is `503` with "Cloudflare Access authentication is not configured", check that `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` are set and redeployed.

The `vars` in `wrangler.jsonc` are not secrets, so they can be committed. No Cloudflare secret is needed for the Worker, because the R2 binding is used directly.

### Browser clients

If the web app is served from a different origin than the API, the browser must send the Access cookie with each request. Use `fetch(url, { credentials: 'include' })`, and put the web app and API on the same parent domain (`share-track.lab.jaylancowie.com` and `api.share-track.lab.jaylancowie.com`) so the cookie is sent. The API already echoes allowed origins exactly and sets `Access-Control-Allow-Credentials: true`. If browser preflight requests are blocked by Access, enable the option that allows `OPTIONS` requests to bypass Access in the application's settings.

## R2 Object Naming and Versions

Each uploaded version is a separate immutable R2 object. R2 bucket versioning is not used. The key structure is:

```text
users/<base64url(userId)>/files/<fileId>/<base64url(fileName)>/<timestamp>-<uuid>.json
```

- `userId` is the `sub` claim of the verified Cloudflare Access token, never request JSON or query parameters. Its UTF-8 bytes are base64url encoded to keep the key segment safe and unambiguous. Changing identity provider or account changes the `sub`, so existing files are only visible to the same `sub`.
- `fileId` is a server-generated UUID on the first upload. To save another version, the client sends that existing ID; the server checks that it belongs to the authenticated user.
- `fileName` is a display name supplied at creation, trimmed, and limited to 120 characters. It is base64url encoded in the key, not used as a path. A file's name cannot be changed when saving a later version.
- The final segment is a millisecond timestamp followed by a random UUID and `.json`. Every save gets a new key, so earlier versions remain available.

This layout allows listing by a user's prefix without scanning other users' keys. It is an application-level ownership boundary; keep the bucket private and grant this server only the R2 access it needs.

### Trash

R2 has no move operation, so trashing does not relocate objects. Trashing a file writes a small marker object at `users/<base64url(userId)>/files/<fileId>/_trash`, and restoring deletes that marker. All versions stay where they are. Active listings skip trashed files, and `GET /api/trash` lists only trashed ones. Trashed time is the marker's upload time.

Permanent deletion is only allowed for a trashed file. It removes every version and the marker in one batched delete. This cannot be undone.

## API

Requests must reach the server through Cloudflare Access. Access attaches the `Cf-Access-Jwt-Assertion` header for signed-in users, and the server verifies it on every `/api/files` endpoint.

### List files

```http
GET /api/files
```

Returns the current user's files, each with `id`, `fileName`, `latestVersionId`, `updatedAt`, and `versionCount`.

### Create a file or save a version

```http
POST /api/files
Content-Type: application/json
```

New file body:

```json
{
  "fileName": "portfolio.json",
  "data": {
    "ShareSecurities": [],
    "HoldingEntities": [],
    "ShareLots": [],
    "ShareTransactions": [],
    "ShareLotTransactions": [],
    "ShareSecurityPriceRecords": []
  }
}
```

The response includes the generated `id`, `fileName`, `versionId`, and `createdAt`. To save a new version, send the same body with the returned `id` as `fileId`:

```json
{
  "fileId": "<existing-file-id>",
  "fileName": "portfolio.json",
  "data": { "...": "same six-array format" }
}
```

Each data property must be an array of objects. Unknown top-level fields, unsafe object keys, non-finite numbers, and nesting deeper than 64 levels are rejected. The JSON request body is limited to 5 MB.

### List versions

```http
GET /api/files/<fileId>/versions
```

Returns version metadata for that file, newest first.

### Read the latest or a selected version

```http
GET /api/files/<fileId>
GET /api/files/<fileId>?versionId=<versionId>
```

Returns the Share Track JSON document. The selected version must belong to the requested file and authenticated user.

### List trashed files

```http
GET /api/trash
```

Returns `{ "files": [...] }` with `id`, `fileName`, `latestVersionId`, `updatedAt`, `versionCount` and `trashedAt`.

### Move a file to the trash

```http
POST /api/files/<fileId>/trash
```

Returns `{ "id", "trashedAt" }`. Trashing an already trashed file succeeds and resets its trashed time.

### Restore a file from the trash

```http
POST /api/files/<fileId>/restore
```

Returns `{ "id" }`. Responds `409` if the file is not in the trash.

### Delete a file permanently

```http
DELETE /api/files/<fileId>
```

Responds `204` on success. Responds `409` if the file has not been moved to the trash first, and `404` if it does not belong to the user.

Saving a new version to a trashed file (`POST /api/files` with its `fileId`) is refused with `409`. Restore it first.
