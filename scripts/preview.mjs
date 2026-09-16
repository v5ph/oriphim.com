import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, "dist");
const fallback404 = join(dist, "404.html");
const portArg = process.argv.findIndex((arg) => arg === "--port");
const port = portArg >= 0 ? Number(process.argv[portArg + 1]) : 52922;
const host = "127.0.0.1";

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

const redirects = new Map([
  ["/index.html", "/"],
  ["/about", "/company"],
  ["/about.html", "/company"],
  ["/company.html", "/company"],
  ["/contact.html", "/contact"],
  ["/archive.html", "/archive"],
  ["/archive/catalogue-01/index.html", "/archive/catalogue-01"],
  ["/pricing.html", "/pricing"],
  ["/download.html", "/download"],
  ["/sign-in.html", "/sign-in"],
  ["/sign-up.html", "/sign-up"]
]);

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const insideDist = (path) => {
  const relative = normalize(path).replace(dist, "");
  return path === dist || (path.startsWith(dist + sep) && !relative.includes(`..${sep}`));
};

const resolveFile = async (pathname) => {
  const cleanPath = decodeURIComponent(pathname).replace(/^\/+/, "");
  const candidates = [];

  if (!cleanPath) {
    candidates.push(join(dist, "index.html"));
  } else {
    const direct = resolve(dist, cleanPath);
    candidates.push(direct);
    if (!extname(direct)) candidates.push(`${direct}.html`);
    candidates.push(join(direct, "index.html"));
  }

  for (const candidate of candidates) {
    if (!insideDist(candidate)) continue;
    if (!(await exists(candidate))) continue;
    const info = await stat(candidate);
    if (info.isFile()) return candidate;
  }

  return null;
};

const sendFile = (res, file, status = 200) => {
  res.writeHead(status, {
    "Content-Type": types[extname(file)] || "application/octet-stream"
  });
  createReadStream(file).pipe(res);
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${host}:${port}`);
    const pathname = url.pathname.replace(/\/$/, "") || "/";

    if (redirects.has(pathname)) {
      res.writeHead(301, { Location: redirects.get(pathname) });
      res.end();
      return;
    }

    const file = await resolveFile(url.pathname);
    if (file) {
      sendFile(res, file);
      return;
    }

    if (await exists(fallback404)) {
      sendFile(res, fallback404, 404);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Preview server error");
  }
}).listen(port, host, () => {
  console.log(`Oriphim preview listening at http://${host}:${port}`);
});
