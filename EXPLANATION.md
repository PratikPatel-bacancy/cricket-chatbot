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
Markdown files  →  Chunker  →  Embedding model  →  Vector database (Chroma)
(knowledge_base/)  (splits by     (turns text into                (stores chunks +
                    heading)       number vectors)                 their vectors)
```

- **Chunker**: splits each doc by its `##` headings, so each chunk is one self-contained rule
  section (not an arbitrary character cut that could split a sentence in half).
- **Embedding model**: `sentence-transformers` (`all-MiniLM-L6-v2`) — converts each chunk of text
  into a list of ~384 numbers (a "vector") that captures its *meaning*. Runs fully locally, no
  API calls, free.
- **Vector database**: Chroma, stored on disk. Think of it as a searchable index where "nearby"
  vectors mean "similar meaning."

### Flow B: Answering a question (happens on every chat message)

```
User question
   → Embed the question (same embedding model)
   → Similarity search in Chroma → top-K most relevant chunks
   → Build a prompt: "Answer ONLY using this context: [chunks] ... Question: [question]"
   → Send to the LLM (Ollama / Llama 3.2 3B, running locally)
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
| Backend | Python + FastAPI | Best ecosystem for RAG/ML tooling; async support for streaming |
| Frontend | React + Vite + Tailwind | Simple, fast dev server, easy streaming UI |
| Embeddings | `sentence-transformers` (local) | Free, offline, no API key — turns text into comparable vectors |
| Vector store | Chroma (local, embedded) | Zero setup, no account, persists to disk |
| LLM | Ollama running Llama 3.2 3B | Fully open-source, runs locally and free (no per-request cost, no API key) — this was a deliberate switch after starting with a paid API, to keep the whole stack free |

**Everything runs on the local machine** — no cloud account, no API key, no cost per question.

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
Chroma works fine up to hundreds of thousands of chunks. For much bigger corpora, next steps
would be a managed vector DB (Pinecone/Weaviate), smarter retrieval (re-ranking, hybrid
keyword+vector search), and a bigger/faster LLM if answer quality on harder questions degrades.

**Q: What's the one-sentence architecture summary?**
"Cricket rules are chunked and embedded into a local vector database; each question is embedded
the same way, matched against the database by similarity, and the top matching rule excerpts are
handed to a local open-source LLM which answers using only that retrieved context, streaming the
result back with its sources."
