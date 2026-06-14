import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function readMonitorConfig(configPath = "config/monitors.example.json") {
  const resolvedConfigPath = resolve(configPath);
  return JSON.parse(await readFile(resolvedConfigPath, "utf8"));
}
