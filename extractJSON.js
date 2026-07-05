#!/usr/bin/env node
/**
 * extractJSON.js
 * Usage: node extractJSON.js <input.txt> <output.json>
 *
 * Splits input text into overlapping chunks (500-800 words each),
 * embeds them via a local OpenAI-compatible API, and writes the
 * resulting chunks + vectors to a JSON file.
 *
 * Configuration via environment variables (or edit defaults below):
 *   EMBED_BASE_URL   - e.g. http://localhost:1234/v1  (default)
 *   EMBED_API_KEY    - API key                        (default: "lm-studio")
 *   EMBED_MODEL      - embedding model name           (default: "text-embedding-ada-002")
 *   CHUNK_MIN        - minimum chunk size in words    (default: 500)
 *   CHUNK_MAX        - maximum chunk size in words    (default: 800)
 *   OVERLAP_PCT      - overlap percentage (10-20)     (default: 15)
 */

const fs   = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BASE_URL   = process.env.EMBED_BASE_URL || "http://localhost:1234/v1";
const API_KEY    = process.env.EMBED_API_KEY  || "lm-studio";
const MODEL      = process.env.EMBED_MODEL    || "text-embedding-ada-002";
const CHUNK_MIN  = parseInt(process.env.CHUNK_MIN  || "500", 10);
const CHUNK_MAX  = parseInt(process.env.CHUNK_MAX  || "800", 10);
const OVERLAP_PCT = parseFloat(process.env.OVERLAP_PCT || "15") / 100; // 0.15

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Split text into paragraphs on blank lines. */
function splitParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Count words in a string. */
function wordCount(str) {
  return str.split(/\s+/).filter(Boolean).length;
}

/**
 * Merge paragraphs into base chunks of 500-800 words.
 * Paragraphs that are less than CHUNK_MIN words are combined with
 * subsequent paragraphs until the combined text reaches CHUNK_MIN-CHUNK_MAX.
 */
function buildBaseChunks(paragraphs) {
  const chunks = [];
  let current = [];
  let currentWords = 0;

  for (const para of paragraphs) {
    const pWords = wordCount(para);

    // If adding this paragraph would exceed CHUNK_MAX and we already meet CHUNK_MIN,
    // close the current chunk first.
    if (currentWords >= CHUNK_MIN && currentWords + pWords > CHUNK_MAX) {
      chunks.push(current.join("\n\n"));
      current = [];
      currentWords = 0;
    }

    current.push(para);
    currentWords += pWords;

    // Close the chunk once we are within the target range.
    if (currentWords >= CHUNK_MIN && currentWords <= CHUNK_MAX) {
      chunks.push(current.join("\n\n"));
      current = [];
      currentWords = 0;
    }
  }

  // Flush any remaining paragraphs.
  if (current.length > 0) {
    const remaining = current.join("\n\n");
    // If it is smaller than CHUNK_MIN, merge it into the last chunk.
    if (chunks.length > 0 && wordCount(remaining) < CHUNK_MIN) {
      chunks[chunks.length - 1] += "\n\n" + remaining;
    } else {
      chunks.push(remaining);
    }
  }

  return chunks;
}

/**
 * Given an array of word tokens, return a slice [start, end).
 */
function wordsSlice(words, start, end) {
  return words.slice(Math.max(0, start), Math.min(words.length, end)).join(" ");
}

/**
 * Add overlapping context from the previous and next base chunks.
 * The overlap is OVERLAP_PCT of the neighbouring chunk's word count.
 */
function addOverlaps(baseChunks) {
  return baseChunks.map((chunk, i) => {
    const chunkWords = chunk.split(/\s+/).filter(Boolean);
    const overlapWords = Math.round(chunkWords.length * OVERLAP_PCT);

    let prefixText = "";
    if (i > 0) {
      const prevWords = baseChunks[i - 1].split(/\s+/).filter(Boolean);
      const take = Math.max(
        Math.round(prevWords.length * OVERLAP_PCT),
        overlapWords
      );
      prefixText = wordsSlice(prevWords, prevWords.length - take, prevWords.length);
    }

    let suffixText = "";
    if (i < baseChunks.length - 1) {
      const nextWords = baseChunks[i + 1].split(/\s+/).filter(Boolean);
      const take = Math.max(
        Math.round(nextWords.length * OVERLAP_PCT),
        overlapWords
      );
      suffixText = wordsSlice(nextWords, 0, take);
    }

    const parts = [];
    if (prefixText) parts.push(prefixText);
    parts.push(chunk);
    if (suffixText) parts.push(suffixText);

    return {
      index: i,
      text: parts.join(" "),
      core_text: chunk,
      overlap_prefix_words: prefixText ? prefixText.split(/\s+/).filter(Boolean).length : 0,
      overlap_suffix_words: suffixText ? suffixText.split(/\s+/).filter(Boolean).length : 0,
      total_words: parts.join(" ").split(/\s+/).filter(Boolean).length,
    };
  });
}

// ---------------------------------------------------------------------------
// Embedding via local OpenAI-compatible API
// ---------------------------------------------------------------------------

/**
 * POST a JSON body to the embeddings endpoint and return the parsed response.
 */
function postJSON(urlStr, body, apiKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;

    const payload = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + (url.search || ""),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        Authorization: "Bearer " + apiKey,
      },
    };

    const req = transport.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`API error ${res.statusCode}: ${data}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Failed to parse API response: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Embed a single text string. Returns the embedding vector (number[]).
 */
async function embed(text) {
  const endpoint = `${BASE_URL.replace(/\/$/, "")}/embeddings`;
  const response = await postJSON(
    endpoint,
    { model: MODEL, input: text },
    API_KEY
  );
  if (!response.data || !response.data[0] || !response.data[0].embedding) {
    throw new Error(`Unexpected embedding response: ${JSON.stringify(response)}`);
  }
  return response.data[0].embedding;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const [, , inputFile, outputFile] = process.argv;

  if (!inputFile || !outputFile) {
    console.error("Usage: node extractJSON.js <input.txt> <output.json>");
    process.exit(1);
  }

  const inputPath  = path.resolve(inputFile);
  const outputPath = path.resolve(outputFile);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const text = fs.readFileSync(inputPath, "utf8");

  console.log("Splitting into paragraphs…");
  const paragraphs = splitParagraphs(text);
  console.log(`  → ${paragraphs.length} paragraphs`);

  console.log("Building base chunks (500-800 words)…");
  const baseChunks = buildBaseChunks(paragraphs);
  console.log(`  → ${baseChunks.length} base chunks`);

  console.log(`Adding ${Math.round(OVERLAP_PCT * 100)}% overlaps…`);
  const chunks = addOverlaps(baseChunks);

  console.log("Embedding chunks via", BASE_URL, "…");
  const results = [];
  for (const chunk of chunks) {
    process.stdout.write(`  Chunk ${chunk.index + 1}/${chunks.length}… `);
    try {
      const vector = await embed(chunk.text);
      results.push({
        chunk_index: chunk.index,
        total_words: chunk.total_words,
        overlap_prefix_words: chunk.overlap_prefix_words,
        overlap_suffix_words: chunk.overlap_suffix_words,
        core_text: chunk.core_text,
        text: chunk.text,
        embedding: vector,
      });
      console.log(`done (${vector.length} dims)`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      // Still record the chunk without an embedding so the file is useful.
      results.push({
        chunk_index: chunk.index,
        total_words: chunk.total_words,
        overlap_prefix_words: chunk.overlap_prefix_words,
        overlap_suffix_words: chunk.overlap_suffix_words,
        core_text: chunk.core_text,
        text: chunk.text,
        embedding: null,
        error: err.message,
      });
    }
  }

  const output = {
    metadata: {
      source: path.basename(inputPath),
      base_url: BASE_URL,
      model: MODEL,
      chunk_min_words: CHUNK_MIN,
      chunk_max_words: CHUNK_MAX,
      overlap_pct: Math.round(OVERLAP_PCT * 100),
      total_chunks: results.length,
      created_at: new Date().toISOString(),
    },
    chunks: results,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`\nWrote ${results.length} chunks to ${outputPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
