import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { await scan(file); continue; }
    if (!/\.(js|jsx|html)$/.test(file)) continue;
    const text = await readFile(file, "utf8");
    assert.ok(!/SUPABASE_SERVICE_ROLE_KEY|VITE_[A-Z_]*(?:SERVICE_ROLE|SECRET)|sb_secret_[a-zA-Z0-9_-]{10,}/.test(text), `Server credential marker in ${file}`);
    for (const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
      let claims;
      try { claims = JSON.parse(Buffer.from(match[1], "base64url").toString()); } catch { continue; }
      assert.notEqual(claims.role, "service_role", `Privileged JWT found in ${file}`);
    }
  }
}
for (const directory of ["src", "shared", "dist"]) await scan(directory);
console.log("Frontend source/shared contract/bundle: no service-role credentials or server-secret references found.");
