import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");

const entries = [
  "index.html",
  "about.html",
  "company.html",
  "archive.html",
  "archive",
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
  "styles.css",
  "script.js",
  "assets"
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of entries) {
  await cp(join(root, entry), join(dist, entry), {
    recursive: true,
    force: true,
    errorOnExist: false
  });
}

console.log(`Built Oriphim static site to ${dist}`);
