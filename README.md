# 0.5 Show — Social Command Center

A unified social publishing, analytics, AI insights, and reporting platform for the Zero Point Five Show media brand.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18 |
| Backend | NestJS 10, TypeScript |
| Storage | Flat JSON file (dev) — Drizzle + Postgres (future) |
| Auth | Cookie sessions, AES-256-GCM token encryption |
| AI | Anthropic Claude (default), Gemini, OpenRouter |
| Monorepo | Turborepo + pnpm workspaces |

## Repository structure

```
apps/
  api/        NestJS backend (port 4000)
  web/        Next.js frontend (port 3000)
packages/
  shared/     Shared TypeScript types
  database/   Drizzle ORM schema + seed
infra/
  docker/     Docker Compose for local Postgres, Redis, MinIO
```

## Quick start

### Prerequisites
- Node.js 20+
- pnpm 9+

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set at minimum:
#   ANTHROPIC_API_KEY   — get one at console.anthropic.com
#   ENCRYPTION_KEY      — 64 hex chars (openssl rand -hex 32)
#   CORS_ORIGINS        — http://localhost:3000
```

### 3. Start (development)

```bash
# Start API and frontend in parallel
pnpm dev
```

The frontend runs at http://localhost:3000  
The API runs at http://localhost:4000

## AI providers

Set `AI_PROVIDER` in `.env` to switch:

| Value | Model env var | Key env var |
|---|---|---|
| `anthropic` (default) | `ANTHROPIC_MODEL` (claude-haiku-4-5) | `ANTHROPIC_API_KEY` |
| `gemini` | `GEMINI_MODEL` (gemini-2.0-flash) | `GEMINI_API_KEY` |
| `openrouter` | `OPENROUTER_MODEL` | `OPENROUTER_API_KEY` |

All providers fall back gracefully to a local template if the API call fails.

## Social platform OAuth

Each platform requires OAuth credentials entered in **Settings → Provider credentials**. Real OAuth flows are supported for YouTube; all other platforms support mock connections for development.

See `.env.example` for the full list of platform credential variables.

## Security notes

- `ENCRYPTION_KEY` must be a unique random value in production. The fallback (`local-development-key`) is intentionally weak and only safe for local dev.
- `.env` is git-ignored. Never commit secrets.
- The session cookie uses `HttpOnly; SameSite=Lax` and `Secure` in production.

## License

Private — Zero Point Five Show.
