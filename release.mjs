import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist");

for (const file of [
  "main.js",
  "manifest.json",
  "versions.json",
  "README.md",
  "LICENSE",
])
  await cp(file, `dist/${file}`);
