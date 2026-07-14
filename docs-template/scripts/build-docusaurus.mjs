import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "./patch-docusaurus-resolve-weak.mjs";

const preload = fileURLToPath(new URL("./resolve-weak-preload.cjs", import.meta.url));
const result = spawnSync("pnpm", ["exec", "docusaurus", "build"], {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${preload}`]
      .filter(Boolean)
      .join(" "),
  },
});

process.exit(result.status ?? 1);
