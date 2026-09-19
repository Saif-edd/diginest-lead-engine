import { spawn } from "node:child_process";

function supportsSystemCa() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return major > 23 || (major === 23 && minor >= 9) || (major === 22 && minor >= 15);
}

const nodeArguments = [];
const nextCommand = process.argv[2];
if (nextCommand !== "build" && supportsSystemCa()) nodeArguments.push("--use-system-ca");
nodeArguments.push("node_modules/next/dist/bin/next", ...process.argv.slice(2));

const nextProcess = spawn(process.execPath, nodeArguments, {
  env: process.env,
  stdio: "inherit",
});

nextProcess.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

nextProcess.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exitCode = code ?? 1;
  }
});
