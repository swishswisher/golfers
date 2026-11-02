/** Local QA transport only: PostgreSQL wire protocol through Neon's documented
 * TLS WebSocket endpoint. Honors the configured HTTPS proxy and certificate trust.
 * Production Npgsql connects to PostgreSQL directly. No credentials are logged. */
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import WebSocket from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";
const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const cfg = JSON.parse(fs.readFileSync(root + "/.local/settings.json", "utf8"));
const host = cfg.connectionString.match(/Host=([^;]+)/)?.[1];
if (!host?.endsWith(".neon.tech"))
  throw new Error(
    "This local transport is restricted to the configured Neon endpoint.",
  );
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const server = net.createServer((socket) => {
  socket.pause();
  const ws = new WebSocket("wss://" + host + "/v2", {
    agent: proxy ? new HttpsProxyAgent(proxy) : undefined,
    handshakeTimeout: 20000,
    perMessageDeflate: false,
  });
  ws.on("open", () => {
    socket.resume();
  });
  socket.on("data", (data) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
  ws.on("message", (data) => {
    if (!socket.destroyed) socket.write(Buffer.from(data));
  });
  ws.on("error", () => {
    console.error("PostgreSQL WebSocket transport failed.");
    socket.destroy();
  });
  ws.on("close", () => socket.end());
  socket.on("close", () => ws.close());
  socket.on("error", () => ws.close());
});
server.listen(6543, "127.0.0.1", () =>
  console.log(
    "Local PostgreSQL TLS-WebSocket transport listening on 127.0.0.1:6543.",
  ),
);
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () => {
    server.close();
    process.exit(0);
  });
