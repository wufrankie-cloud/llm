# llm
NodeJS for LLM

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
