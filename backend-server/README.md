# Backend Server

Express API for saving, listing, and retrieving Share Track JSON files in Cloudflare R2. All file endpoints require a signed JWT.

## Requirements

- Node.js 20 or later
- An R2 bucket and S3 API credentials
- A JWT signing secret shared with the service that issues the app's tokens

## Environment Variables

Set these in the server's runtime environment. The server reads `process.env` directly and does not load `.env` files.

| Variable | Required | Description |
| --- | --- | --- |
| `JWT_SECRET` | Yes for file API | Secret used to verify HS256 bearer tokens. Must be at least 32 bytes. |
| `CLOUDFLARE_ACCOUNT_ID` | Yes for R2 | Cloudflare account ID used to build the R2 S3 endpoint. |
| `R2_ACCESS_KEY_ID` | Yes for R2 | R2 S3 API access key ID. |
| `R2_SECRET_ACCESS_KEY` | Yes for R2 | R2 S3 API secret access key. |
| `R2_BUCKET_NAME` | Yes for R2 | Existing bucket name where file versions are stored. |
| `WEB_APP_ORIGINS` | For browser access | Comma-separated exact origins allowed by CORS, such as `http://localhost:5173,https://app.example.com`. |
| `PORT` | No | HTTP listen port. Defaults to `3000`. |

Configure the four R2 variables together. If any is missing, the server starts without storage and file routes respond with `503`; `/health` remains available. Create an R2 API token with object read and write access to this bucket. Keep the access key, secret, and JWT secret out of source control and browser code.

The token verifier accepts HS256 tokens and requires a non-empty string `userID` claim (up to 256 characters). Use a cryptographically random `JWT_SECRET` of at least 32 bytes and configure the token issuer to sign with the same secret. Tokens should include an expiry; expired tokens are rejected.

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

The production command is `npm run start:server` from the root, or `npm start` from this directory. Run the backend tests with `npm test --workspace @share-track/backend-server` from the root.

For local development, export environment variables in the shell before starting the server. For deployment, configure them through the hosting provider's secret/environment-variable settings. Do not commit real credentials in an example env file.

## R2 Object Naming and Versions

Each uploaded version is a separate immutable R2 object. R2 bucket versioning is not used. The key structure is:

```text
users/<base64url(userID)>/files/<fileId>/<base64url(fileName)>/<timestamp>-<uuid>.json
```

- `userID` comes only from the verified JWT, never from request JSON or query parameters. Its UTF-8 bytes are base64url encoded to keep the key segment safe and unambiguous.
- `fileId` is a server-generated UUID on the first upload. To save another version, the client sends that existing ID; the server checks that it belongs to the authenticated user.
- `fileName` is a display name supplied at creation, trimmed, and limited to 120 characters. It is base64url encoded in the key, not used as a path. A file's name cannot be changed when saving a later version.
- The final segment is a millisecond timestamp followed by a random UUID and `.json`. Every save gets a new key, so earlier versions remain available.

This layout allows listing by a user's prefix without scanning other users' keys. It is an application-level ownership boundary; keep the bucket private and grant this server only the R2 access it needs.

## API

Send `Authorization: Bearer <JWT>` to every `/api/files` endpoint.

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
