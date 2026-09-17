# Cricket Rules Chatbot

A RAG (Retrieval-Augmented Generation) chatbot that answers questions about cricket's Laws and
common playing conditions — LBW, DRS, no-balls/wides, dismissals, follow-on, powerplays, boundary
and catch rules, and more.

## How it works

1. Cricket rules are written up as curated Markdown docs in `backend/data/knowledge_base/`.
2. An ingestion script chunks those docs, embeds each chunk locally (no external API), and stores
   them in a local [Chroma](https://www.trychroma.com/) vector database.
3. When you ask a question, the backend embeds your question, retrieves the most relevant rule
   chunks, and asks a locally-running open-source LLM (via [Ollama](https://ollama.com)) to answer
   using only that retrieved context — streaming the answer back to the browser along with the
   source sections it used.

Everything runs locally and free — no API keys, no cloud accounts, no per-request cost.

## Tech stack

| Layer       | Technology                                   |
|-------------|-----------------------------------------------|
| Backend     | Python + FastAPI                              |
| Frontend    | React + Vite + Tailwind CSS                   |
| LLM (chat)  | [Ollama](https://ollama.com) running `llama3.2:3b` (open-source, local, free) |
| Embeddings  | `sentence-transformers` (`all-MiniLM-L6-v2`, local, free) |
| Vector store| Chroma (local, embedded, no external account) |

## Setup (one-time)

Do this once (or again only when noted). After this, see **Running the project** below for your
day-to-day start-up commands.

### 1. Ollama (local LLM)

Install Ollama from [ollama.com/download](https://ollama.com/download), then pull the model used by
this project:

```bash
ollama pull llama3.2:3b
```

Ollama runs as a background service on `http://localhost:11434` — no account or API key needed.

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

The defaults in `.env.example` already point at `http://localhost:11434` and `llama3.2:3b` — no
editing needed unless you want a different model.

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
FastAPI backend on port 8000.

## Running the project (every time)

Once the one-time setup above is done, starting the app day-to-day only takes two terminals.
Ollama itself doesn't need starting — it runs as a background Windows service automatically.

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

## Adding more rules

Drop additional `.md` files into `backend/data/knowledge_base/` (or replace them with official MCC
Laws of Cricket / ICC playing conditions text if you have those documents), then re-run:

```bash
python scripts/ingest.py
```

No code changes are needed — the ingestion pipeline picks up any markdown file in that folder.

## API

- `POST /api/chat` — `{ "question": "..." }` → streams Server-Sent Events (`token` events with
  partial text, followed by a final `sources` event).
- `POST /api/ingest` — re-runs ingestion over the knowledge base (same as `scripts/ingest.py`, but
  callable over HTTP).
- `GET /api/health` — health check.
