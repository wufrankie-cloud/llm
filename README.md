# llm
NodeJS for LLM

## JSON cleaning

Use `cleanJSON.js` to clean a JSON document by removing empty or null key-value pairs and splitting long string values into numbered keys:

```bash
node cleanJSON.js input.json output.json
```

Behavior:
- Keys with `null`, empty string, whitespace-only string, empty array, or empty object values are removed.
- String values exceeding 200 words are split into numbered keys (e.g. `content` → `content1`, `content2`, …), each holding at most 200 words.
- Cleaning is applied recursively to nested objects and arrays.

## JSON normalization

Use `normalizeJSON.js` to convert a JSON document into normalized text for downstream embedding workflows:

```bash
node normalizeJSON.js input.json output.txt
```

Behavior:
- For generic JSON, primitive values are flattened into one normalized text line.
- If keys containing `page` or `paragraph` are detected:
  - concatenation starts from `page` keys (for example, `Page 1`)
  - `paragraph` content is emitted as paragraph blocks with line breaks
