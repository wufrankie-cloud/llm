#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const WORD_LIMIT = 200;

function splitIntoChunks(str, wordLimit) {
  const words = str.trim().split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += wordLimit) {
    chunks.push(words.slice(i, i + wordLimit).join(" "));
  }
  return chunks;
}

function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return true;
  return false;
}

function cleanNode(node) {
  if (Array.isArray(node)) {
    return node.map(cleanNode).filter((item) => !isEmpty(item));
  }

  if (node !== null && typeof node === "object") {
    const result = {};
    for (const [key, value] of Object.entries(node)) {
      if (isEmpty(value)) continue;

      if (typeof value === "string") {
        const chunks = splitIntoChunks(value, WORD_LIMIT);
        if (chunks.length > 1) {
          chunks.forEach((chunk, i) => {
            result[`${key}${i + 1}`] = chunk;
          });
          continue;
        }
      }

      const cleaned = cleanNode(value);
      if (!isEmpty(cleaned)) {
        result[key] = cleaned;
      }
    }
    return result;
  }

  return node;
}

function main() {
  const [, , inputPath, outputPath] = process.argv;

  if (!inputPath || !outputPath) {
    console.error(
      "Usage: ./cleanJSON.js <input.json> <output.json> (or: node cleanJSON.js <input.json> <output.json>)"
    );
    process.exit(1);
  }

  const resolvedInputPath = path.resolve(inputPath);
  const resolvedOutputPath = path.resolve(outputPath);

  let input;
  try {
    input = fs.readFileSync(resolvedInputPath, "utf8");
  } catch (error) {
    console.error(`Error reading input file "${resolvedInputPath}": ${error.message}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch (error) {
    console.error(`Error parsing JSON from "${resolvedInputPath}": ${error.message}`);
    process.exit(1);
  }

  try {
    const cleaned = cleanNode(data);
    fs.writeFileSync(resolvedOutputPath, JSON.stringify(cleaned, null, 2) + "\n", "utf8");
    console.log(`Cleaned JSON written to "${resolvedOutputPath}"`);
  } catch (error) {
    console.error(`Error writing output file "${resolvedOutputPath}": ${error.message}`);
    process.exit(1);
  }
}

main();
