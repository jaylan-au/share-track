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

The backend currently exposes `GET /health`, which returns `{ "status": "ok" }`.
