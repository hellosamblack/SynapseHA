#!/usr/bin/env node
/** @format */

import { decode } from "@toon-format/toon";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath =
  process.argv[2] || path.join(__dirname, "entity_index_cache.toon");

try {
  const txt = fs.readFileSync(filePath, "utf8");
  const parsed = decode(txt, { indent: 2, strict: false });
  console.log("DECODE_OK");
  if (parsed && parsed.meta) {
    console.log(JSON.stringify(parsed.meta, null, 2));
  } else {
    console.log("Parsed object does not contain meta.");
  }
  process.exit(0);
} catch (e) {
  console.error("DECODE_ERROR", e && e.stack ? e.stack : String(e));
  process.exit(2);
}
