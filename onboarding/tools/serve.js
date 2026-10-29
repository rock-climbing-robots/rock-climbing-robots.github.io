// Static file server for local viewing: node tools/serve.js [port]
// The site is plain files; this only exists because ES modules need HTTP.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const PORT = Number(process.argv[2] || 8080);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".json": "application/json",
};

createServer(async (req, res) => {
  let path = decodeURIComponent(req.url.split("?")[0]);
  if (path.endsWith("/")) path += "index.html";
  const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ""));
  try {
    const body = await readFile(file);
    const type = TYPES[extname(file)] || "application/octet-stream";
    // Range requests, as any real server answers them: without them a browser
    // cannot SEEK a video (its `seekable` stays empty), and a film held on an
    // instant other than 0 silently shows its first frame.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (range) {
      const size = body.length;
      let start = range[1] === "" ? size - Number(range[2]) : Number(range[1]);
      let end = range[1] === "" || range[2] === "" ? size - 1 : Number(range[2]);
      start = Math.max(0, start);
      end = Math.min(end, size - 1);
      if (start > end) {
        res.writeHead(416, { "content-range": `bytes */${size}` });
        return res.end();
      }
      res.writeHead(206, {
        "content-type": type, "cache-control": "no-cache", "accept-ranges": "bytes",
        "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1,
      });
      return res.end(body.subarray(start, end + 1));
    }
    res.writeHead(200, {
      "content-type": type, "cache-control": "no-cache", "accept-ranges": "bytes",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}/`));
