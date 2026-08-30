import { cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");

// Everything that ships except assets/ — which is derived below from what the
// pages actually reference, so unused images never reach the Cloudflare deploy.
// about.html is redirect-only (see _redirects) and styles.css is unlinked, so
// neither is copied.
const entries = [
  "index.html",
  "company.html",
  "archive.html",
  "archive/catalogue-01/index.html",
  "pricing.html",
  "download.html",
  "sign-in.html",
  "sign-up.html",
  "404.html",
  "robots.txt",
  "sitemap.xml",
  "site.webmanifest",
  "_headers",
  "_redirects",
  "script.js"
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of entries) {
  await cp(join(root, entry), join(dist, entry), { recursive: true, force: true });
}

// Copy only the assets referenced by the shipped text files.
const walk = async (dir) => {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(html|css|js|webmanifest|xml|json)$/.test(e.name)) out.push(p);
  }
  return out;
};

const referenced = new Set();
for (const file of await walk(dist)) {
  const text = await readFile(file, "utf8");
  for (const m of text.matchAll(/assets\/([A-Za-z0-9._-]+\.[A-Za-z0-9]+)/g)) {
    referenced.add(m[1]);
  }
}

await mkdir(join(dist, "assets"), { recursive: true });
for (const name of [...referenced].sort()) {
  try {
    await cp(join(root, "assets", name), join(dist, "assets", name));
  } catch {
    console.warn(`  ! referenced asset not found: assets/${name}`);
  }
}

console.log(
  `Built Oriphim static site to ${dist} (${referenced.size} assets, ${entries.length} pages/files)`
);
