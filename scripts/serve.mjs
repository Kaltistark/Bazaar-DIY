import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff2": "font/woff2",
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let file = decodeURIComponent(url.pathname);
    if (file === "/") file = "/index.html";
    if (file.startsWith("/assets/")) file = "/public" + file;
    const resolved = path.resolve(root, "." + file);
    if (!resolved.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    const info = await stat(resolved);
    if (!info.isFile()) throw new Error("Not a file");
    res.writeHead(200, {
      "Content-Type":
        types[path.extname(resolved)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(await readFile(resolved));
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("文件不存在");
  }
});
let port = Number(process.env.PORT || 5173);
server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    port++;
    server.listen(port, "127.0.0.1");
  } else throw e;
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Local: http://127.0.0.1:${port}/`),
);
