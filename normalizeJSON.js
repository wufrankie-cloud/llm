#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function isPrimitive(value) {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function formatKey(key) {
  return String(key)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function primitiveToString(value) {
  if (value === null) return "null";
  return String(value);
}

function collectPlainText(node) {
  if (isPrimitive(node)) return primitiveToString(node);
  if (Array.isArray(node)) {
    return node.map(collectPlainText).filter(Boolean).join(" ");
  }
  if (node && typeof node === "object") {
    return Object.values(node).map(collectPlainText).filter(Boolean).join(" ");
  }
  return "";
}

function hasDocumentStructure(node) {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some(hasDocumentStructure);

  return Object.entries(node).some(([key, value]) => {
    const lower = key.toLowerCase();
    if (lower.includes("page") || lower.includes("paragraph")) return true;
    return hasDocumentStructure(value);
  });
}

function toPageLabel(key, value) {
  const keyStr = String(key);
  if (/^pages$/i.test(keyStr) && !isPrimitive(value)) return "";
  const match = keyStr.match(/page\s*([0-9]+)/i) || keyStr.match(/([0-9]+)/);
  if (match) return `Page ${match[1]}`;

  if (isPrimitive(value)) {
    const raw = primitiveToString(value).trim();
    if (/^[0-9]+$/.test(raw)) return `Page ${raw}`;
  }

  const formatted = formatKey(keyStr);
  return /^page\b/i.test(formatted) ? formatted : `Page ${formatted}`;
}

function normalizeWithStructure(node) {
  const lines = [];

  function walk(current, insidePage = false) {
    if (Array.isArray(current)) {
      current.forEach((item) => walk(item, insidePage));
      return;
    }

    if (!current || typeof current !== "object") {
      if (isPrimitive(current)) {
        const text = primitiveToString(current).trim();
        if (text) lines.push(text);
      }
      return;
    }

    const currentHasPageField = Object.keys(current).some((k) => {
      const lower = k.toLowerCase();
      return lower !== "pages" && lower.includes("page");
    });

    for (const [key, value] of Object.entries(current)) {
      const lower = key.toLowerCase();

      if (lower.includes("page")) {
        if (lower === "pages" && !isPrimitive(value)) {
          walk(value, insidePage);
          continue;
        }

        const pageLabel = toPageLabel(key, value);
        if (!pageLabel) {
          walk(value, insidePage);
          continue;
        }

        if (lines.length > 0 && lines[lines.length - 1] !== "") {
          lines.push("");
        }
        lines.push(pageLabel);
        if (!isPrimitive(value)) {
          walk(value, true);
        }
        continue;
      }

      if (lower.includes("paragraph")) {
        const paragraphText = collectPlainText(value).trim();
        if (paragraphText) {
          lines.push(paragraphText);
          lines.push("");
        }
        continue;
      }

      if ((insidePage || currentHasPageField) && isPrimitive(value)) {
        const text = primitiveToString(value).trim();
        if (text) lines.push(`${formatKey(key)}: ${text}`);
        continue;
      }

      walk(value, insidePage || currentHasPageField);
    }
  }

  walk(node);

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}

function normalizeJSON(jsonData) {
  if (hasDocumentStructure(jsonData)) {
    return normalizeWithStructure(jsonData);
  }
  return collectPlainText(jsonData).replace(/\s+/g, " ").trim();
}

function main() {
  const [, , inputPath, outputPath] = process.argv;

  if (!inputPath || !outputPath) {
    console.error("Usage: node normalizeJSON.js <input.json> <output.txt>");
    process.exit(1);
  }

  try {
    const input = fs.readFileSync(path.resolve(inputPath), "utf8");
    const data = JSON.parse(input);
    const normalized = normalizeJSON(data);
    fs.writeFileSync(path.resolve(outputPath), `${normalized}\n`, "utf8");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
