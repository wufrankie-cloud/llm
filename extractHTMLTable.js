#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function stripTags(value) {
  return value
    .replace(/<script\b[\s\S]*?<\/script\b[^>]*>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  const entities = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": "\"",
    "&#39;": "'",
    "&nbsp;": " ",
  };
  return value
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => entities[entity] || entity)
    .replace(/&#(\d+);/g, (_, numeric) => {
      const codePoint = Number.parseInt(numeric, 10);
      if (!Number.isFinite(codePoint)) return _;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const codePoint = Number.parseInt(hex, 16);
      if (!Number.isFinite(codePoint)) return _;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return _;
      }
    });
}

function extractTableBlocks(html) {
  const tagRegex = /<\/?table\b[^>]*>/gi;
  const stack = [];
  const blocks = [];
  let match = tagRegex.exec(html);

  while (match) {
    const tag = match[0];
    const index = match.index;
    const isClosing = /^<\s*\/\s*table\b/i.test(tag);

    if (!isClosing) {
      stack.push(index);
    } else if (stack.length > 0) {
      const start = stack.pop();
      blocks.push({
        start,
        html: html.slice(start, tagRegex.lastIndex),
      });
    }

    match = tagRegex.exec(html);
  }

  return blocks
    .sort((a, b) => a.start - b.start)
    .map((block) => block.html);
}

function extractRows(tableHtml, minTdCount) {
  const trMatches = tableHtml.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
  return trMatches
    .map((tr) => {
      const cellMatches = tr.match(/<(?:td|th)\b[\s\S]*?<\/(?:td|th)\s*>/gi) || [];
      if (cellMatches.length < minTdCount) return null;
      return cellMatches.map((cell) => decodeHtmlEntities(stripTags(cell)));
    })
    .filter(Boolean);
}

function extractHTMLTable(html, minRowCount, minTdCount) {
  const tableMatches = extractTableBlocks(html);
  for (const table of tableMatches) {
    const rows = extractRows(table, minTdCount);
    if (rows.length >= minRowCount) {
      return rows.map((row) => {
        const result = {};
        row.forEach((value, index) => {
          result[`td${index + 1}`] = value;
        });
        return result;
      });
    }
  }
  return null;
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.error(`Invalid ${name}: "${value}". It must be a positive integer.`);
    process.exit(1);
  }
  return parsed;
}

function main() {
  const [, , inputPath, outputPath, minRowsArg, minTdsArg] = process.argv;

  if (!inputPath || !outputPath || !minRowsArg || !minTdsArg) {
    console.error(
      "Usage: ./extractHTMLTable.js <input.html> <output.json> <min_rows> <min_tds> (or: node extractHTMLTable.js <input.html> <output.json> <min_rows> <min_tds>)"
    );
    process.exit(1);
  }

  const minRows = parsePositiveInt(minRowsArg, "min_rows");
  const minTds = parsePositiveInt(minTdsArg, "min_tds");

  const resolvedInputPath = path.resolve(inputPath);
  const resolvedOutputPath = path.resolve(outputPath);

  let html;
  try {
    html = fs.readFileSync(resolvedInputPath, "utf8");
  } catch (error) {
    console.error(`Error reading input file "${resolvedInputPath}": ${error.message}`);
    process.exit(1);
  }

  const extracted = extractHTMLTable(html, minRows, minTds);
  if (!extracted) {
    console.error(
      `No <table> found with at least ${minRows} <tr> rows containing at least ${minTds} table cells (<td> or <th>).`
    );
    process.exit(1);
  }

  try {
    fs.writeFileSync(resolvedOutputPath, `${JSON.stringify(extracted, null, 2)}\n`, "utf8");
  } catch (error) {
    console.error(`Error writing output file "${resolvedOutputPath}": ${error.message}`);
    process.exit(1);
  }
}

main();
