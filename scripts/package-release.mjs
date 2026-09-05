import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = (await import(new URL("../package.json", import.meta.url), {
  with: { type: "json" },
})).default;
const releaseDir = resolve(root, "release");
const archivePath = resolve(releaseDir, `ai-chat-playground-${packageJson.version}.zip`);

await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });

async function runZipCommand(command, args) {
  await execFileAsync(command, args, { cwd: resolve(root, "dist") });
}

try {
  await runZipCommand("zip", ["-r", archivePath, "."]);
} catch (error) {
  if (process.platform !== "win32") throw error;

  await runZipCommand("powershell.exe", [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path * -DestinationPath ${JSON.stringify(archivePath)} -Force`,
  ]);
}

console.log(`Created ${archivePath}`);
