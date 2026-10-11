# ClassLoop Deployment & Operations Guide

This guide details running ClassLoop locally, connecting to live wearable hardware via secure tunneling, and deploying to production cloud platforms (Render, Railway, Qdrant Cloud).

---

## 1. Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+ and npm
- Make (or execute the steps via `scripts/setup.ps1` on Windows)

### Quickstart
```bash
# 1. Clone and navigate to repository
git clone https://github.com/classloop/classloop.git
cd classloop

# 2. Configure environment
cp .env.example .env

# 3. Setup virtual environment and dependencies
make setup

# 4. Build frontend bundle
make build

# 5. Start unified server
make start
# App is accessible at http://localhost:8080
```

### Full-Stack Hot-Reloading Development Mode
To develop both backend and frontend concurrently with live reloading:
```bash
make dev
```
- Backend API & Docs: `http://localhost:8080` (FastAPI Swagger at `/docs`)
- Frontend Vite Server: `http://localhost:5173`

---

## 2. Exposing Webhooks to Omi Hardware

When connecting physical Omi hardware in a development or staging environment, the Omi backend needs a public HTTPS endpoint to send webhook notifications to `/api/webhook/omi`.

### Option A: Cloudflare Tunnel (Recommended, No rate limits)
```bash
# Install cloudflared via brew / winget / direct binary
cloudflared tunnel --url http://localhost:8080
```
Copy the generated `https://<random-id>.trycloudflare.com` URL and append `/api/webhook/omi`.

### Option B: ngrok
```bash
ngrok http 8080
```
Configure your Omi Developer Dashboard with:
- **Webhook URL**: `https://<your-ngrok-domain>.ngrok-free.app/api/webhook/omi`
- **Webhook Secret**: Matching `OMI_WEBHOOK_SECRET` in your `.env` file.

---

## 3. Cloud Deployment: Render

Render offers an easy way to deploy Python web services with persistent disk storage.

1. **Create Web Service**:
   - Connect your GitHub repository.
   - **Environment**: Python 3
   - **Build Command**:
     ```bash
     pip install -e backend && cd frontend && npm install && npm run build
     ```
   - **Start Command**:
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
2. **Attach Persistent Disk**:
   - Mount Path: `/opt/render/project/src/data`
   - Size: 1 GB (stores SQLite database and local FastEmbed cache).
3. **Set Environment Variables**:
   Configure all required variables (see reference table below). Set `DATABASE_URL` to `sqlite+aiosqlite:///./data/classloop.db`.

---

## 4. Cloud Deployment: Railway

1. **Deploy Repository**:
   - Create a new Railway project and link your repository.
   - Railway automatically detects the root [`Procfile`](file:///c:/Users/Eshwar%20G/Desktop/Working/ClassLoop/Procfile):
     ```text
     web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
2. **Add a Persistent Volume**:
   - Add a Volume mounted at `/app/data` to preserve the SQLite database and local files between deploys.
3. **Configure Environment Variables**:
   - Set `APP_ENV=production`
   - Set `DATABASE_URL=sqlite+aiosqlite:////app/data/classloop.db`
   - Set `PORT=${{PORT}}`

---

## 5. Qdrant Cloud Setup (Optional / Production)

By default, ClassLoop uses embedded Qdrant (`./data/qdrant`), which requires zero external setup. For distributed production workloads, use Qdrant Cloud:

1. Create a free cluster at [cloud.qdrant.io](https://cloud.qdrant.io).
2. Create an API key.
3. Update `.env`:
   ```env
   QDRANT_URL=https://your-cluster-id.us-east-1-0.aws.cloud.qdrant.io:6333
   QDRANT_API_KEY=your-qdrant-api-key
   QDRANT_PATH=
   ```
4. ClassLoop automatically initializes the `lecture_chunks` collection with 384-dimensional cosine indexing on initial startup.

---

## 6. Environment Variable Reference Table

| Variable | Required in Prod | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `APP_ENV` | No | `development` | Runtime environment (`development`, `staging`, `production`). |
| `APP_BASE_URL` | Yes | `http://localhost:8080` | Public base URL used for callback links and assets. |
| `ADMIN_TOKEN` | Yes | `change-me` | Secret bearer token required for administrative API operations. |
| `SECRET_KEY` | Yes | `generate-with-make-secret` | Cryptographic secret for signing session tokens and encryption. |
| `CORS_ORIGINS` | No | `http://localhost:5173,http://localhost:8080` | Comma-separated list of permitted CORS origins. |
| `DEMO_MODE` | No | `true` | If `true`, enables mock fallback adapters for Omi and Lyzr. |
| `OMI_WEBHOOK_SECRET` | For Omi | *(empty)* | HMAC secret key shared with the Omi hardware webhook provider. |
| `OMI_API_KEY` | For Omi | *(empty)* | API key for interacting with Omi cloud APIs. |
| `OMI_APP_ID` | For Omi | *(empty)* | Registered Omi Application Identifier. |
| `LYZR_API_KEY` | For Lyzr | *(empty)* | API key to communicate with Lyzr Agent endpoints. |
| `LYZR_BASE_URL` | No | `https://api.lyzr.ai` | Base URL for Lyzr Agent API v2 endpoints. |
| `LYZR_ORCHESTRATOR_AGENT_ID` | For Lyzr | *(empty)* | Unique Agent ID for the workflow orchestrator. |
| `LYZR_DETECTOR_AGENT_ID` | For Lyzr | *(empty)* | Unique Agent ID for the confusion detection specialist. |
| `LYZR_CONTENT_AGENT_ID` | For Lyzr | *(empty)* | Unique Agent ID for structured notes and quiz synthesis. |
| `LYZR_SCHEDULER_AGENT_ID` | For Lyzr | *(empty)* | Unique Agent ID for spaced-repetition scheduling. |
| `QDRANT_URL` | No | *(empty)* | Remote Qdrant Cloud URL (leave empty for local embedded mode). |
| `QDRANT_API_KEY` | No | *(empty)* | API key for remote Qdrant Cloud cluster. |
| `QDRANT_PATH` | No | `./data/qdrant` | Local filesystem path for embedded vector storage. |
| `QDRANT_COLLECTION` | No | `lecture_chunks` | Name of the vector collection. |
| `EMBEDDING_PROVIDER` | No | `fastembed` | Embedding backend engine (`fastembed`, `openai`, `custom`). |
| `EMBEDDING_MODEL` | No | `BAAI/bge-small-en-v1.5` | Model identifier for generating 384-d dense vectors. |
| `DATABASE_URL` | Yes | `sqlite+aiosqlite:///./data/classloop.db` | Async SQLAlchemy database connection URL. |
| `SILENCE_TIMEOUT_SECONDS` | No | `90` | Inactivity threshold before finalizing an open lecture session. |
| `CHUNK_SECONDS` | No | `45` | Audio segment duration used for semantic chunk grouping. |
| `EPHEMERAL_TTL_HOURS` | No | `24` | Hours before inactive ephemeral session records are purged. |
| `LOG_LEVEL` | No | `INFO` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`). |
| `PORT` | No | `8080` | Port on which the FastAPI application binds. |

---

## 7. Troubleshooting & Common Issues

### 1. `ModuleNotFoundError: No module named 'app'`
Make sure backend is installed in editable mode inside your active virtual environment:
```bash
pip install -e backend
```

### 2. Frontend Assets Returning 404
In production or unified server mode (`make start`), FastAPI serves static assets from `frontend/dist`. Run:
```bash
make build
```
Verify that `frontend/dist/index.html` exists.

### 3. Qdrant Storage Permission or Lock Error
If running multiple processes in embedded Qdrant mode, SQLite or RocksDB file locks may trigger. Ensure only one instance of the FastAPI server access `./data/qdrant` concurrently, or configure `QDRANT_URL` pointing to an external Qdrant instance.

### 4. SSE Disconnecting on Reverse Proxies
When using NGINX, Cloudflare, or corporate firewalls, Server-Sent Events may buffer or disconnect. Ensure reverse proxies pass:
```nginx
proxy_set_header Connection '';
proxy_http_version 1.1;
chunked_transfer_encoding off;
proxy_buffering off;
proxy_cache off;
```
