import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Profile, ProfilesConfig, ToolType } from "./types.js";

const CONFIG_DIR = path.join(os.homedir(), ".claude-switcher");
const CONFIG_FILE = path.join(CONFIG_DIR, "profiles.json");

const DEFAULT_CONFIG: ProfilesConfig = {
  profiles: [],
  active: { "claude-code": null, opencode: null },
};

export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): ProfilesConfig {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return structuredClone(DEFAULT_CONFIG);
  }
  const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
  const parsed = JSON.parse(raw);

  // 向后兼容：旧格式 active 是字符串，迁移为 Record
  if (typeof parsed.active === "string" || parsed.active === null) {
    parsed.active = {
      "claude-code": parsed.active ?? null,
      opencode: null,
    };
  }
  // 确保两个 key 都存在
  if (!("claude-code" in parsed.active)) parsed.active["claude-code"] = null;
  if (!("opencode" in parsed.active)) parsed.active.opencode = null;

  // 向后兼容：旧 Profile 无 tool 字段，默认 claude-code
  for (const p of parsed.profiles ?? []) {
    if (!p.tool) p.tool = "claude-code";
  }

  return parsed as ProfilesConfig;
}

export function saveConfig(config: ProfilesConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function addProfile(profile: Profile): void {
  const config = loadConfig();
  if (config.profiles.some((p) => p.name === profile.name && p.tool === profile.tool)) {
    throw new Error(`配置档案 "${profile.name}" 已存在`);
  }
  config.profiles.push(profile);
  saveConfig(config);
}

export function removeProfile(tool: ToolType, name: string): void {
  const config = loadConfig();
  const index = config.profiles.findIndex(
    (p) => p.name === name && p.tool === tool,
  );
  if (index === -1) {
    throw new Error(`配置档案 "${name}" 不存在`);
  }
  config.profiles.splice(index, 1);
  if (config.active[tool] === name) {
    config.active[tool] = null;
  }
  saveConfig(config);
}

export function updateProfile(
  tool: ToolType,
  name: string,
  field: keyof Profile,
  value: string,
): void {
  const config = loadConfig();
  const profile = config.profiles.find(
    (p) => p.name === name && p.tool === tool,
  );
  if (!profile) {
    throw new Error(`配置档案 "${name}" 不存在`);
  }
  if (field === "name") {
    if (
      config.profiles.some(
        (p) => p.name === value && p.tool === tool,
      )
    ) {
      throw new Error(`配置档案 "${value}" 已存在`);
    }
    if (config.active[tool] === name) {
      config.active[tool] = value;
    }
  }
  (profile as Record<string, string>)[field] = value;
  saveConfig(config);
}

export function getProfile(tool: ToolType, name: string): Profile | undefined {
  return loadConfig().profiles.find(
    (p) => p.name === name && p.tool === tool,
  );
}

export function listProfiles(): Profile[] {
  return loadConfig().profiles;
}

export function listProfilesByTool(tool: ToolType): Profile[] {
  return loadConfig().profiles.filter((p) => p.tool === tool);
}

export function getActiveName(tool: ToolType): string | null {
  return loadConfig().active[tool] ?? null;
}

export function setActive(tool: ToolType, name: string): void {
  const config = loadConfig();
  if (
    !config.profiles.some(
      (p) => p.name === name && p.tool === tool,
    )
  ) {
    throw new Error(`配置档案 "${name}" 不存在`);
  }
  config.active[tool] = name;
  saveConfig(config);
}
