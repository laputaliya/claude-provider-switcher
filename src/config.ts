import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Profile, ProfilesConfig } from "./types.js";

const CONFIG_DIR = path.join(os.homedir(), ".claude-switcher");
const CONFIG_FILE = path.join(CONFIG_DIR, "profiles.json");

const DEFAULT_CONFIG: ProfilesConfig = { profiles: [], active: null };

export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): ProfilesConfig {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
  return JSON.parse(raw) as ProfilesConfig;
}

export function saveConfig(config: ProfilesConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function addProfile(profile: Profile): void {
  const config = loadConfig();
  if (config.profiles.some((p) => p.name === profile.name)) {
    throw new Error(`配置档案 "${profile.name}" 已存在`);
  }
  config.profiles.push(profile);
  saveConfig(config);
}

export function removeProfile(name: string): void {
  const config = loadConfig();
  const index = config.profiles.findIndex((p) => p.name === name);
  if (index === -1) {
    throw new Error(`配置档案 "${name}" 不存在`);
  }
  config.profiles.splice(index, 1);
  if (config.active === name) {
    config.active = null;
  }
  saveConfig(config);
}

export function updateProfile(name: string, field: keyof Profile, value: string): void {
  const config = loadConfig();
  const profile = config.profiles.find((p) => p.name === name);
  if (!profile) {
    throw new Error(`配置档案 "${name}" 不存在`);
  }
  if (field === "name") {
    if (config.profiles.some((p) => p.name === value)) {
      throw new Error(`配置档案 "${value}" 已存在`);
    }
    if (config.active === name) {
      config.active = value;
    }
  }
  profile[field] = value;
  saveConfig(config);
}

export function getProfile(name: string): Profile | undefined {
  return loadConfig().profiles.find((p) => p.name === name);
}

export function listProfiles(): Profile[] {
  return loadConfig().profiles;
}

export function getActiveName(): string | null {
  return loadConfig().active;
}

export function setActive(name: string): void {
  const config = loadConfig();
  if (!config.profiles.some((p) => p.name === name)) {
    throw new Error(`配置档案 "${name}" 不存在`);
  }
  config.active = name;
  saveConfig(config);
}
