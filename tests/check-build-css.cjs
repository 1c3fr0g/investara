const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const path = require("node:path");

const staticDirectory = path.resolve(__dirname, "../.next/static");
const css = readdirSync(staticDirectory, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
  .map((entry) => readFileSync(path.join(entry.parentPath, entry.name), "utf8"))
  .join("\n");

assert.ok(/\.flex\s*\{\s*display\s*:\s*flex/.test(css), "Production CSS is missing the Tailwind flex utility.");
assert.ok(css.includes(".xl\\:flex"), "Production CSS is missing the desktop navigation layout.");
assert.ok(css.includes(".dark\\:text-zinc-300"), "Production CSS is missing dark-mode utilities.");
assert.ok(css.includes(".ios-glass-pill"), "Production CSS is missing the Crystal Clear surfaces.");
assert.ok(!/@(?:custom-variant|theme|tailwind)\b/.test(css), "Production CSS contains uncompiled Tailwind directives.");
