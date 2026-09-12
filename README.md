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

## HTML table extraction

Use `extractHTMLTable.js` to extract rows from the first `<table>` that has at least the requested number of `<tr>` rows, where each extracted row has at least the requested number of table cells (`<td>` or `<th>`):

```bash
node extractHTMLTable.js input.html output.json 3 4
```

The command writes JSON objects shaped like `{"td1":"...", "td2":"...", ...}` using all extracted cells from each qualifying row.
