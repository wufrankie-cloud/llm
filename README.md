# llm
NodeJS for LLM

## extractJSON.js

Extracts a plain-text document into an embedding JSON file suitable for similarity-search implementations.

### Usage

```bash
node extractJSON.js <input.txt> <output.json>
```

### What it does

1. **Paragraph splitting** – detects blank lines and splits the text into paragraphs.
2. **Chunk assembly** – merges consecutive paragraphs until each chunk contains **500–800 words**. A chunk that is under 500 words is combined with the next paragraph(s) until it reaches the target range.
3. **Overlap** – each chunk includes a **10–20 %** word overlap borrowed from the tail of the previous chunk and the head of the next chunk, improving retrieval continuity.
4. **Embedding** – each chunk is sent to a local OpenAI-compatible embedding API (default: `http://localhost:1234/v1`).
5. **Output** – all chunks and their embedding vectors are written to the specified JSON file.

### Configuration (environment variables)

| Variable | Default | Description |
|---|---|---|
| `EMBED_BASE_URL` | `http://localhost:1234/v1` | Base URL of the embedding API |
| `EMBED_API_KEY` | `lm-studio` | API key |
| `EMBED_MODEL` | `text-embedding-ada-002` | Embedding model name |
| `CHUNK_MIN` | `500` | Minimum chunk size in words |
| `CHUNK_MAX` | `800` | Maximum chunk size in words |
| `OVERLAP_PCT` | `15` | Overlap percentage (10–20 recommended) |

### Example

```bash
EMBED_BASE_URL=http://localhost:1234/v1 \
EMBED_API_KEY=my-key \
EMBED_MODEL=nomic-embed-text-v1 \
node extractJSON.js input.txt output.json
```

### Output format

```json
{
  "metadata": {
    "source": "input.txt",
    "base_url": "http://localhost:1234/v1",
    "model": "text-embedding-ada-002",
    "chunk_min_words": 500,
    "chunk_max_words": 800,
    "overlap_pct": 15,
    "total_chunks": 3,
    "created_at": "2026-07-05T14:00:00.000Z"
  },
  "chunks": [
    {
      "chunk_index": 0,
      "total_words": 620,
      "overlap_prefix_words": 0,
      "overlap_suffix_words": 87,
      "core_text": "…the main paragraph text…",
      "text": "…core text + suffix overlap…",
      "embedding": [0.012, -0.034, "…"]
    }
  ]
}
```

A sample `input.txt` is included for quick testing.
