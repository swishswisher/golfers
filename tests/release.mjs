import { spawn } from "node:child_process";
import fs from "node:fs";
const suites = [
  "api",
  "targeted-api",
  "advanced",
  "contracts",
  "browser-regression",
  "performance",
];
const evidence = {
  at: new Date().toISOString(),
  environment:
    "Development API, real isolated demonstration clubs in PostgreSQL, production Next.js preview",
  suites: [],
};
fs.mkdirSync(".local/release-logs", { recursive: true });
for (const suite of suites) {
  const started = Date.now();
  const log = fs.openSync(`.local/release-logs/${suite}.log`, "w");
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [`tests/${suite}.mjs`], {
      env: process.env,
      stdio: ["ignore", log, log],
    });
    child.on("error", reject);
    child.on("exit", resolve);
  });
  fs.closeSync(log);
  evidence.suites.push({
    suite,
    status: code === 0 ? "passed" : "failed",
    exitCode: code,
    seconds: Number(((Date.now() - started) / 1000).toFixed(1)),
  });
  fs.writeFileSync(
    "docs/evidence/release.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log(`${suite}: ${code === 0 ? "passed" : "FAILED"}`);
  if (code !== 0) process.exit(code || 1);
}
