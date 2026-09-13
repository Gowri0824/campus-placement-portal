import { build } from "vite";
import { gzipSync } from "node:zlib";

// In-memory production build: measurements do not replace the deployable dist.
const result = await build({ logLevel: "silent", build: { write: false } });
const chunks = result.output.filter((item) => item.type === "chunk");
const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
const initial = new Set();
function visit(name) {
  if (initial.has(name) || !byName.has(name)) return;
  initial.add(name);
  byName.get(name).imports.forEach(visit);
}
chunks.filter((chunk) => chunk.isEntry).forEach((chunk) => visit(chunk.fileName));
const size = (chunk) => ({
  file: chunk.fileName,
  bytes: Buffer.byteLength(chunk.code),
  gzipBytes: gzipSync(chunk.code).length,
  initial: initial.has(chunk.fileName),
});
const sizes = chunks.map(size).sort((a, b) => b.bytes - a.bytes);
const modules = chunks.flatMap((chunk) => Object.entries(chunk.modules).map(([id, info]) => ({
  id: id.replaceAll("\\", "/").replace(process.cwd().replaceAll("\\", "/") + "/", ""),
  renderedLength: info.renderedLength,
}))).sort((a, b) => b.renderedLength - a.renderedLength).slice(0, 15);
console.log(JSON.stringify({
  initialBytes: sizes.filter((chunk) => chunk.initial).reduce((sum, chunk) => sum + chunk.bytes, 0),
  initialGzipBytes: sizes.filter((chunk) => chunk.initial).reduce((sum, chunk) => sum + chunk.gzipBytes, 0),
  totalBytes: sizes.reduce((sum, chunk) => sum + chunk.bytes, 0),
  totalGzipBytes: sizes.reduce((sum, chunk) => sum + chunk.gzipBytes, 0),
  chunks: sizes,
  largestModules: modules,
}, null, 2));
