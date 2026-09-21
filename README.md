# Cricket Rules Chatbot

A RAG (Retrieval-Augmented Generation) chatbot that answers questions about cricket's Laws and
common playing conditions — LBW, DRS, no-balls/wides, dismissals, follow-on, powerplays, boundary
and catch rules, and more.

## How it works

1. Cricket rules are written up as curated Markdown docs in `backend/data/knowledge_base/`.
2. An ingestion script chunks those docs, embeds each chunk (via Cohere), and stores them in a
   Postgres + [pgvector](https://github.com/pgvector/pgvector) database hosted on Supabase.
3. When you ask a question, the backend embeds your question the same way, retrieves the most
   relevant rule chunks by vector similarity, and asks an open-source LLM (hosted on
   [Groq](https://groq.com), which serves models like Meta's Llama and OpenAI's open-weight
   `gpt-oss`) to answer using only that retrieved context — streaming the answer back to the
   browser along with the source sections it used.

Everything used is free-tier: no paid subscriptions, and the LLM itself is open-source (only its
*hosting* is a cloud service, to make this deployable on Vercel).

## Tech stack

| Layer        | Technology                                                              |
|--------------|--------------------------------------------------------------------------|
| Backend      | Python + FastAPI, deployed as a Vercel serverless function              |
| Frontend     | React + Vite + Tailwind CSS, deployed as a static Vercel site           |
| LLM (chat)   | [Groq](https://groq.com) running `openai/gpt-oss-20b` (open-source, free tier) |
| Embeddings   | [Cohere](https://cohere.com) `embed-english-v3.0` (free tier)          |
| Vector store | [Supabase](https://supabase.com) Postgres + pgvector (free tier)       |

## Setup (one-time)

### 1. Create free accounts and gather keys

You need four values:

1. **Groq API key** — sign up at [console.groq.com](https://console.groq.com) → API Keys → Create API Key
2. **Cohere API key** — sign up at [dashboard.cohere.com](https://dashboard.cohere.com/welcome/register) → API Keys → copy the Trial key
3. **Supabase project URL + service_role key** — create a project at [supabase.com/dashboard](https://supabase.com/dashboard), then:
   - Go to **Database → Extensions**, enable `vector`
   - Go to **SQL Editor** and run:
     ```sql
     create table documents (
       id bigserial primary key,
       content text,
       file text,
       heading text,
       embedding vector(1024)
     );

     create or replace function match_documents (
       query_embedding vector(1024),
       match_count int
     )
     returns table (id bigint, content text, file text, heading text, similarity float)
     language sql stable
     as $$
       select documents.id, documents.content, documents.file, documents.heading,
              1 - (documents.embedding <=> query_embedding) as similarity
       from documents
       order by documents.embedding <=> query_embedding
       limit match_count;
     $$;
     ```
   - Go to **Project Settings → API** and copy the **Project URL** and the **`service_role`** key (the legacy JWT-style key, not the newer `sb_secret_...` key)

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt

copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux
```

Edit `backend/.env` and fill in the four values from step 1.

Build the vector index from the knowledge base (re-run this any time you edit the markdown files
in `data/knowledge_base/`):

```bash
python scripts/ingest.py
```

Start the API server:

```bash
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. Check `http://localhost:8000/api/health`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. The Vite dev server proxies `/api` requests to the
FastAPI backend on port 8000, so no `.env` is needed for local frontend dev.

## Running the project (every time)

Once the one-time setup above is done, starting the app day-to-day only takes two terminals — no
local model or database to keep running, since the LLM/embeddings/vector store are all hosted.

**Terminal 1 — backend:**

```powershell
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload
```

**Terminal 2 — frontend:**

```powershell
cd frontend
npm run dev
```

Then open `http://localhost:5173` and start asking cricket rules questions.

> Only re-run `pip install -r requirements.txt`, `npm install`, or `python scripts/ingest.py` if
> their inputs change (`requirements.txt`, `package.json`, or the files in
> `data/knowledge_base/`, respectively). They don't need to be repeated on every run.

## Deploying to Vercel

This deploys as **two separate Vercel projects** — one for the backend (Python serverless
function), one for the frontend (static site) — since they're two different runtimes.

### 1. Backend project

1. In the [Vercel dashboard](https://vercel.com/new), import this GitHub repo as a new project
2. Set **Root Directory** to `backend`
3. Vercel will detect `api/index.py` (via `backend/vercel.json`) as a Python serverless function automatically
4. In **Environment Variables**, add all the values from `backend/.env` (`GROQ_API_KEY`,
   `GROQ_MODEL`, `COHERE_API_KEY`, `COHERE_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_TABLE`, `TOP_K`, `KNOWLEDGE_BASE_DIR=./data/knowledge_base`) — and set `CORS_ORIGINS`
   to your frontend's Vercel URL once you know it (step 2)
5. Deploy. Note the resulting URL (e.g. `https://cricket-chatbot-api.vercel.app`)
6. Run `python scripts/ingest.py` locally once (pointed at the same Supabase project) so the
   deployed backend has data to retrieve from — ingestion isn't run automatically on deploy

### 2. Frontend project

1. Import the same repo as a **second** Vercel project
2. Set **Root Directory** to `frontend` (Vercel auto-detects the Vite framework)
3. In **Environment Variables**, add `VITE_API_BASE_URL` set to the backend project's URL from step 1
4. Deploy

### 3. Connect them

Go back to the backend project's environment variables and set `CORS_ORIGINS` to the frontend's
final URL (e.g. `https://cricket-chatbot.vercel.app`), then redeploy the backend so CORS allows
requests from it.

## Adding more rules

Drop additional `.md` files into `backend/data/knowledge_base/` (or replace them with official MCC
Laws of Cricket / ICC playing conditions text if you have those documents), then re-run:

```bash
python scripts/ingest.py
```

No code changes are needed — the ingestion pipeline picks up any markdown file in that folder.

## API

- `POST /api/chat` — `{ "question": "...", "history": [{ "role": "user"|"assistant", "content": "..." }] }`
  → streams Server-Sent Events (`token` events with partial text, followed by a final `sources` event).
- `POST /api/ingest` — re-runs ingestion over the knowledge base (same as `scripts/ingest.py`, but
  callable over HTTP).
- `GET /api/health` — health check.
