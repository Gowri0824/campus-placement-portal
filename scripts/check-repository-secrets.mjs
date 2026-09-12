import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const credentialPatterns = [
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{16,}/],
  ["Supabase access token", /sbp_[A-Za-z0-9]{20,}/],
  ["GitHub token", /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/],
  ["Database connection password", /postgres(?:ql)?:\/\/[^\s:/]+:[^\s@]+@/i],
];

export function inspectFile(file, text) {
  const issues = [];
  if (/(^|\/)(?:node_modules|dist|dist-ssr|\.temp|\.branches|logs)(\/|$)|\.(?:log|tmp|bak|pem|key|p12|pfx)$/i.test(file)
    || /(^|\/)\.env(?:\.|$)/.test(file) && !/(^|\/)\.env\.example$/.test(file)) {
    issues.push("Local-only or sensitive file must not be tracked");
  }
  for (const [label, pattern] of credentialPatterns) {
    if (pattern.test(text)) issues.push(label);
  }
  for (const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    let claims;
    try { claims = JSON.parse(Buffer.from(match[1], "base64url").toString()); } catch { continue; }
    if (claims.role === "service_role") issues.push("Privileged Supabase JWT");
  }
  return [...new Set(issues)];
}

export async function scanRepository(root) {
  // Include tracked ignored files; otherwise an accidentally committed .env is missed.
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" });
  const files = [...new Set(output.split("\0").filter(Boolean))];
  const findings = [];
  for (const file of files) {
    const text = await readFile(path.join(root, file), "utf8");
    for (const issue of inspectFile(file, text)) findings.push({ file, issue });
  }
  return { files: files.length, findings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await scanRepository(process.cwd());
    if (result.findings.length) {
      // Never print credential values, source snippets, or raw errors into CI logs.
      for (const { file, issue } of result.findings) console.error(`${JSON.stringify(file)}: ${issue}`);
      process.exitCode = 1;
    } else {
      console.log(`Repository scan passed: ${result.files} files; no recognized credentials or forbidden artifacts.`);
    }
  } catch {
    console.error("Repository scan could not complete. Check Git availability and file readability.");
    process.exitCode = 1;
  }
}
