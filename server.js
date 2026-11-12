import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

export function createAppServer(appRoot = root) {
  const resolvedRoot = resolve(appRoot);
  return createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    } catch {
      response.writeHead(400).end("Invalid request path");
      return;
    }
    if (pathname.endsWith("/")) pathname += "index.html";

    const filePath = resolve(resolvedRoot, `.${pathname}`);
    if (!filePath.startsWith(resolvedRoot + sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    try {
      const content = await readFile(filePath);
      response.writeHead(200, {
        "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache"
      });
      response.end(request.method === "HEAD" ? undefined : content);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "EISDIR") {
        response.writeHead(404).end("Not found");
        return;
      }
      console.error("Could not serve request.", error);
      response.writeHead(500).end("Internal server error");
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  const server = createAppServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`DataTech Thermal Compensation is available at http://localhost:${port}`);
    console.log("Keep this window open while using the app. Press Ctrl+C to stop the server.");
  });
}
