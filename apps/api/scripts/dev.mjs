import { spawn, spawnSync } from "node:child_process";

const initial = spawnSync("tsc", ["-p", "tsconfig.build.json"], {
  stdio: "inherit",
});

if (initial.status !== 0) process.exit(initial.status ?? 1);

const compiler = spawn("tsc", ["-p", "tsconfig.build.json", "--watch", "--preserveWatchOutput"], {
  stdio: "inherit",
});
const server = spawn("node", ["--watch", "dist/src/main.js"], {
  stdio: "inherit",
});

const stop = (signal) => {
  compiler.kill(signal);
  server.kill(signal);
};

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

server.on("exit", (code) => {
  compiler.kill("SIGTERM");
  process.exit(code ?? 0);
});
