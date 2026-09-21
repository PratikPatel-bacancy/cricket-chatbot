# Cricket Rules Chatbot — Explanation Notes

Simple notes to help you explain this project in a discussion: what it does, how it's built, and
what you learned while building it.

---

## 1. The problem, in one sentence

Build a chatbot that can correctly answer questions about cricket's rules (LBW, DRS, no-balls,
follow-on, etc.) without making things up.

## 2. Why RAG instead of just asking an LLM directly?

Think of a general LLM (like plain ChatGPT/Llama) as a person who has read a LOT of books once,
a long time ago, and is now answering from memory. Problems with that:

- It might **misremember** a rule and confidently give a wrong answer ("hallucination").
- It has no way to tell you **where** the rule came from.
- You can't easily **update** its knowledge (you'd have to retrain the whole model).

**RAG (Retrieval-Augmented Generation)** fixes this by turning it into an **open-book exam**
instead of a memory test:

1. You give the model a small, trusted "book" of facts (our knowledge base).
2. Before answering, the system **looks up the most relevant pages** of that book for the
   question being asked.
3. It hands the model *only those relevant pages* plus the question, and says: "answer using
   only this."
4. If the book doesn't cover it, the model is instructed to say "I don't know" instead of
   guessing.

This is why RAG is the right approach for a domain-specific Q&A bot like this one — the answers
are grounded in a real, inspectable source instead of the model's fuzzy memory.

## 3. Dataset / knowledge source

Since there was no existing document to upload, I authored a **curated knowledge base**: 8
Markdown files covering the Laws of Cricket and common playing conditions:

- LBW (`lbw.md`)
- DRS / review system (`drs_review_system.md`)
- No-balls and wides (`no_ball_and_wide.md`)
- All 10 ways of getting out (`dismissals.md`)
- Follow-on and innings structure (`follow_on_and_innings.md`)
- Overs, powerplays, over-rate rules (`overs_and_powerplay.md`)
- Boundary and catch rules (`boundary_and_catch_rules.md`)
- General glossary (extras, DLS, super over, etc.) (`general_laws_glossary.md`)

Each file is organized into headed sections (`## Heading`) so it can be split into clean,
self-contained chunks. **Nothing about the pipeline is cricket-specific** — swap these files for
any other document set (e.g. official MCC/ICC PDFs, HR policies, product manuals) and the same
system works unchanged.

## 4. Architecture — the two flows

There are exactly two things that happen in this system: **loading knowledge in**, and
**answering a question**.

### Flow A: Ingestion (done once, or whenever the knowledge base changes)

```
Markdown files  →  Chunker  →  Embedding API (Cohere)  →  Vector database (Supabase/pgvector)
(knowledge_base/)  (splits by     (turns text into                 (stores chunks +
                    heading)       number vectors)                  their vectors)
```

- **Chunker**: splits each doc by its `##` headings, so each chunk is one self-contained rule
  section (not an arbitrary character cut that could split a sentence in half). Pure text
  processing, no ML involved.
- **Embedding model**: Cohere's `embed-english-v3.0` — converts each chunk of text into a list of
  1024 numbers (a "vector") that captures its *meaning*. Called over Cohere's API rather than run
  locally, because the local version (`sentence-transformers`, built on PyTorch) is far too heavy
  to bundle into a serverless function.
- **Vector database**: Postgres with the `pgvector` extension, hosted on Supabase. Think of it as
  a searchable index where "nearby" vectors mean "similar meaning." A SQL function
  (`match_documents`) does the actual similarity search using pgvector's cosine-distance operator.

### Flow B: Answering a question (happens on every chat message)

```
User question
   → Embed the question (same Cohere embedding model)
   → Similarity search in Supabase/pgvector → top-K most relevant chunks
   → Build a prompt: "Answer ONLY using this context: [chunks] ... Question: [question]"
   → Send to the LLM (Groq API, serving the open-source gpt-oss-20b model)
   → Stream the answer back to the browser, token by token
   → Also send back which source sections were used (for transparency)
```

The key trick: **similarity search**, not keyword search. It compares the *meaning* of the
question's vector to the *meaning* of each stored chunk's vector (using cosine similarity), so
"What's a duck in cricket?" correctly matches a glossary entry even if it doesn't share many
exact words with the question.

## 5. Tech stack and why each piece was chosen

| Layer | Choice | Why |
|---|---|---|
| Backend | Python + FastAPI, on Vercel (serverless) | Best ecosystem for RAG tooling; deployable as a lightweight serverless function once heavy local ML deps were removed |
| Frontend | React + Vite + Tailwind, on Vercel (static) | Simple, fast dev server, easy streaming UI, trivial static hosting |
| Embeddings | Cohere `embed-english-v3.0` (hosted, free tier) | Same job as a local embedding model, but small enough footprint to call from a serverless function (no PyTorch bundled) |
| Vector store | Supabase (Postgres + pgvector, free tier) | Managed, persists independently of any serverless function's ephemeral filesystem |
| LLM | Groq API running `openai/gpt-oss-20b` | Fast inference, genuinely open-weight model (Apache 2.0), free tier — no local machine or GPU needed to serve it |

**Every piece is on a free tier** — the LLM and embedding model are open-source, only their
*hosting* is a cloud service (needed to make the whole thing deployable and always-on).

> **Evolution of this stack**: this project actually went through three architectures —
> (1) a paid API (Anthropic Claude) → (2) fully local and free (Ollama + sentence-transformers +
> Chroma) → (3) fully hosted and free (Groq + Cohere + Supabase), once "deploy it live on Vercel"
> became a requirement, since Vercel's serverless functions can't run a persistent multi-GB local
> model or a local-disk database. Being able to explain *why* each transition happened is more
> valuable in a discussion than just describing the final state.

## 6. Why chunk by heading instead of fixed character count?

A naive approach splits text every N characters. That can cut a rule's explanation mid-sentence,
so when it's retrieved later, the model sees an incomplete thought and gives a wrong or confused
answer. Splitting by `##` heading keeps each retrieved chunk as one complete, coherent idea
("here is everything about the follow-on rule," not "here is half of the follow-on rule").

## 7. Key learnings / things that went wrong and how they were fixed

Being able to talk through a real problem you hit (not just the happy path) is usually what
separates a strong answer from a scripted one.

1. **Chunking bug → duplicate/incomplete context.** A long rule section got split into two
   overlapping pieces. Both pieces ranked highly for the same question, so the model's context
   window was filled with two near-duplicate, partially-truncated versions of the same rule
   instead of a diverse set of relevant sections — and the model actually said "condition 5 isn't
   in my context" even though it existed, just in a fragment it didn't see.
   **Fix**: increased the max chunk size so most sections stay whole, and added de-duplication
   in retrieval (only keep the best-scoring chunk per section/heading).

2. **Switching LLM providers mid-project.** Started with Anthropic Claude for the chat model, but
   pivoted to a fully local, free, open-source model (Ollama + Llama 3.2 3B) once the requirement
   became "no paid services." This is a good example of **the retrieval half of RAG being
   completely decoupled from the generation half** — swapping the LLM required changing exactly
   one file (`services/rag.py`) and zero changes to embeddings, chunking, or the vector store.

3. **Environment friction on Windows.** The local embedding model (`sentence-transformers`, built
   on PyTorch) needed the Microsoft Visual C++ Redistributable installed system-wide before it
   would load — a good reminder that "local/free" AI tooling still has real system dependencies,
   unlike calling a hosted API.

4. **Verifying "it works" needs more than one check.** Confirmed correctness at three levels:
   retrieval alone (does it find the right chunks for a question), the API alone (via curl,
   checking the streamed response and sources), and the actual browser UI (does it render
   correctly end-to-end). Each layer can hide a different class of bug — e.g., the API can work
   perfectly while a frontend parsing bug still shows nothing on screen.

5. **Deploying forced a second, bigger architecture swap.** Serverless hosting (Vercel) can't run
   a persistent local LLM or a local-disk vector database, so moving from "runs on my machine" to
   "deployed live" meant swapping *three* pieces at once: Ollama → Groq (hosted LLM API),
   sentence-transformers → Cohere (hosted embeddings API), Chroma → Supabase/pgvector (hosted
   vector DB). Same lesson as #2, at a bigger scale: because retrieval, embedding, and generation
   are separate, swappable services behind clean interfaces, none of the chunking logic, prompt
   logic, or frontend UI needed to change — only the three service-integration files did.

6. **Hosted APIs drift under you.** The first Groq model name I configured
   (`llama-3.1-8b-instant`) had been deprecated/renamed since — a 404 with a clear
   `model_not_found` error, fixed by querying Groq's `/models` endpoint to see what was actually
   available. A reminder that hosted-API dependencies (unlike a model file you download once) can
   change their supported model list at any time.

7. **A single mistyped character broke DNS, silently.** A Supabase project URL was decoded from
   the wrong source and off by one character (`bonnxdudw` vs `bonnnxdudw`) — enough to produce a
   hard "domain doesn't exist" error with no hint about *which* character was wrong. Lesson:
   for URLs/IDs copied or derived indirectly, verify against the authoritative source (the actual
   dashboard) rather than trusting a manual transcription.

## 8. Likely follow-up questions and short answers

**Q: Why not fine-tune a model on cricket rules instead of RAG?**
Fine-tuning is expensive, slow to update (need to retrain for every rule change), and still
doesn't guarantee correctness or let you show sources. RAG is cheaper, instantly updatable (just
edit a file and re-run ingestion), and traceable (you can show which document backs each answer).

**Q: What happens if the question isn't covered by the knowledge base?**
The system prompt explicitly tells the model to say it doesn't have that information rather than
guessing, and this was tested (e.g., asking "What is the capital of France?" correctly returns
"I don't have that rule in my knowledge base" instead of a hallucinated answer).

**Q: How do you measure retrieval quality?**
Each retrieved chunk has a similarity score (0–1, higher = more relevant) shown to the user as a
"relevance %" alongside its source. Sanity-checked by asking pointed questions and confirming the
top-ranked chunk was the actually-relevant section.

**Q: How would this scale to a much bigger knowledge base?**
Postgres/pgvector (via Supabase) comfortably handles hundreds of thousands of chunks. For much
bigger corpora, next steps would be an approximate-nearest-neighbor index (pgvector supports
HNSW), smarter retrieval (re-ranking, hybrid keyword+vector search), and a bigger/faster LLM if
answer quality on harder questions degrades.

**Q: Why not keep everything local instead of using hosted APIs?**
That was the second iteration of this project, and it worked well for local development. It
stopped being viable the moment "deploy this live on the internet" became a requirement — Vercel
(and most serverless platforms) can't run a persistent multi-GB model process or a local-disk
database, since serverless functions are stateless and spin up fresh per request.

**Q: What's the one-sentence architecture summary?**
"Cricket rules are chunked and embedded via a hosted embedding API into a Postgres/pgvector
database; each question is embedded the same way, matched against that database by similarity,
and the top matching rule excerpts are handed to an open-source LLM (served via a hosted
inference API) which answers using only that retrieved context, streaming the result back with
its sources."
