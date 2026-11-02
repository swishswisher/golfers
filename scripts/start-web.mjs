import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
const root = path.resolve(new URL("..", import.meta.url).pathname),
  standalone = path.join(root, ".next/standalone");
if (!fs.existsSync(path.join(standalone, "server.js")))
  throw new Error("Run npm run build before starting the production server.");
fs.cpSync(
  path.join(root, ".next/static"),
  path.join(standalone, ".next/static"),
  { recursive: true },
);
fs.cpSync(path.join(root, "public"), path.join(standalone, "public"), {
  recursive: true,
});
const hostIndex = process.argv.indexOf("--hostname"),
  portIndex = process.argv.indexOf("--port");
const child = spawn(process.execPath, [path.join(standalone, "server.js")], {
  cwd: standalone,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: hostIndex >= 0 ? process.argv[hostIndex + 1] : "0.0.0.0",
    PORT:
      portIndex >= 0 ? process.argv[portIndex + 1] : process.env.PORT || "3000",
  },
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
