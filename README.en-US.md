# Claude-for-Microsoft365-Proxy

English | [中文](README.md)

Cloudflare Worker that proxies API requests for the [Claude Office](https://support.claude.com/en/articles/13945233-use-claude-for-microsoft-365-with-third-party-platforms) Add-in, bypassing browser CORS restrictions.

![main](docs/main.png)

## Quick Start

```
┌─────────────────────────────────────────────────────────────┐
│                Step 1: Deploy Worker                        │
├───────────────────────────┬─────────────────────────────────┤
│  Option 1: Fork + Actions │  Option 2: Clone + Local        │
│                           │                                 │
│  1. Fork repo             │  1. git clone                   │
│  2. Set Secrets/Vars      │  2. cp .env.example .env.local  │
│  3. Run workflow          │  3. npm run deploy              │
│  4. Get GATEWAY_URL       │                                 │
└───────────┬───────────────┴────────────────┬────────────────┘
            │                                │
            └────────────────┬───────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 2: Install Office Add-in                  │
├───────────────────────────┬─────────────────────────────────┤
│  Option 1: npm run build  │  Option 2: Manual copy          │
│                           │                                 │
│  npm run build            │  cp manifest.xml.example ...    │
│  Auto-generates           │  Fill URL/Token in UI after     │
│  manifest.xml             │  launch                         │
└───────────┬───────────────┴────────────────┬────────────────┘
            │                                │
            └────────────────┬───────────────┘
                             │
                             ▼
              Copy manifest.xml → Office shared add-ins folder
                          Restart Excel/Word/PowerPoint
```

---

## Step 1: Deploy Worker

### Option 1: Fork + GitHub Actions (Recommended)

No local environment needed — everything happens on GitHub.

1. **Fork** this repo to your GitHub account.

2. **Set Secrets and Variables**: Go to your fork → **Settings → Secrets and variables → Actions**.

   **Secrets** (encrypted):

   | Secret | How to get |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | [Create token](https://dash.cloudflare.com/profile/api-tokens) with **Edit Cloudflare Workers** permission |
   | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard right sidebar |

   **Variables** (non-sensitive): `TARGET_BASE` (required), `GATEWAY_URL` (optional), `KNOWN_MODELS` (optional), `DEFAULT_MODEL` (optional). See [Configuration](#configuration) for details.

3. **Run workflow**: Go to **Actions → Deploy to Cloudflare Workers → Run workflow**, then click **Run workflow**.

4. **Get GATEWAY_URL**: After deploy, check **Settings → Secrets and variables → Actions → Variables** for the auto-written `GATEWAY_URL`.

### Option 2: Clone + Local Deploy

For local development or users who prefer everything on their machine.

```bash
git clone https://github.com/hyooeewee/claude-for-microsoft365-proxy.git
cd claude-for-microsoft365-proxy
cp .env.example .env.local    # fill in your config
npm run deploy                # reads .env.local and deploys
```

#### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- Cloudflare account with Workers enabled
- `wrangler` authenticated: `npx wrangler login`

#### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run locally via `wrangler dev` |
| `npm run deploy` | Read vars from `.env.local` and deploy to Cloudflare |

---

## Step 2: Install Office Add-in

After deployment, generate `manifest.xml` and copy it to your Office shared add-ins folder.

### Option 1: Auto-generate (Recommended)

Run `npm run build` locally to generate `manifest.xml` from `.env.local`:

```bash
npm run build   # Generates manifest.xml (⚠ contains gateway_token — do not share)
```

Then copy the generated `manifest.xml` to your Office shared add-ins folder and restart Excel/Word/PowerPoint.

### Option 2: Manual Fill

Copy the template and fill in the details via the UI after launching:

```bash
cp manifest.xml.example manifest.xml
```

Then copy `manifest.xml` to your Office shared add-ins folder and restart Excel/Word/PowerPoint. After launching, enter `GATEWAY_URL` and `GATEWAY_TOKEN` in the add-in UI.

#### Scripts

| Command | What it does |
|---|---|
| `npm run build` | Generate `manifest.xml` from `.env.local` (⚠ contains secret — do not share) |
| `npm run load` | Load `manifest.xml` in Office for local debugging |

---

## Configuration

| Variable | Required | Description |
|---|---|---|
| `TARGET_BASE` | Yes | Upstream API base URL |
| `ALLOWED_ORIGIN` | No | CORS allowed origin, defaults to `https://pivot.claude.ai` |
| `GATEWAY_URL` | No | This proxy's public URL (auto-configured as custom domain if set) |
| `GATEWAY_TOKEN` | No | Upstream API key (Worker does not read it, used only in manifest.xml) |
| `KNOWN_MODELS` | No | Comma-separated model list |
| `DEFAULT_MODEL` | No | Fallback model for unknown names |

The Worker only needs `TARGET_BASE` to forward requests. `KNOWN_MODELS` and `DEFAULT_MODEL` are only used for `/v1/models` interception and model fallback.

---

## How It Works

```
Browser (Claude Add-in)
  → OPTIONS preflight (CORS)
  → POST /v1/messages
  → Worker forwards to TARGET_BASE/v1/messages
  → Returns response with CORS headers
```

The Worker:
- Intercepts `/v1/models` and returns a mock model list (upstream doesn't support it)
- Maps unknown model names to a default (`DEFAULT_MODEL`)
- Forwards all other requests unchanged

## Project Structure

```
├── .env.example              # Environment variable template
├── .github/workflows/
│   └── deploy.yml            # GitHub Actions auto-deploy
├── manifest.xml.example      # Office Add-in manifest template
├── src/
│   └── index.js              # Worker entry point
└── wrangler.toml             # Cloudflare Workers config
```
