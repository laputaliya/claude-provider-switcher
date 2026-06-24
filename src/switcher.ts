import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Profile } from "./types.js";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SETTINGS_FILE = path.join(CLAUDE_DIR, "settings.json");

export const CLAUDE_JSON_PATH = path.join(os.homedir(), ".claude.json");

function getOpenCodeConfigDir(): string {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "opencode");
  }

  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "opencode");
  }

  return path.join(os.homedir(), ".config", "opencode");
}

const OPENCODE_CONFIG_DIR = getOpenCodeConfigDir();
const OPENCODE_CONFIG_FILE = path.join(OPENCODE_CONFIG_DIR, "opencode.json");

const SWITCHER_DIR = path.join(os.homedir(), ".claude-switcher");
const BACKUP_FILE = path.join(SWITCHER_DIR, "backup.json");
const BACKUP_OPENCODE_FILE = path.join(SWITCHER_DIR, "backup-opencode.json");

interface ClaudeSettings {
  env?: Record<string, string>;
  attribution?: {
    commits?: boolean;
    pullRequests?: boolean;
  };
  [key: string]: unknown;
}

interface OpenCodeConfig {
  provider?: Record<
    string,
    {
      options?: { baseURL?: string; apiKey?: string; timeout?: number; [key: string]: unknown };
      models?: Record<string, { name?: string; [key: string]: unknown }>;
      [key: string]: unknown;
    }
  >;
  model?: string;
  [key: string]: unknown;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─── Claude Code ────────────────────────────────────────────

export function loadClaudeSettings(): ClaudeSettings {
  if (!fs.existsSync(SETTINGS_FILE)) {
    return { env: {} };
  }
  const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
  return JSON.parse(raw) as ClaudeSettings;
}

export function saveClaudeSettings(settings: ClaudeSettings): void {
  ensureDir(CLAUDE_DIR);
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}

function backupClaudeSettings(): void {
  ensureDir(SWITCHER_DIR);
  if (fs.existsSync(SETTINGS_FILE)) {
    fs.copyFileSync(SETTINGS_FILE, BACKUP_FILE);
  } else {
    fs.writeFileSync(BACKUP_FILE, "{}", "utf-8");
  }
}

export function switchClaudeCode(profile: Profile): void {
  backupClaudeSettings();
  const settings = loadClaudeSettings();
  if (!settings.env) {
    settings.env = {};
  }
  settings.env.ANTHROPIC_AUTH_TOKEN = profile.apiKey;
  settings.env.ANTHROPIC_BASE_URL = profile.apiBaseUrl;
  settings.env.ANTHROPIC_MODEL = profile.model;
  settings.env.ANTHROPIC_SMALL_FAST_MODEL = profile.smallFastModel;
  settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = profile.haikuModel;
  settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL = profile.sonnetModel;
  settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL = profile.opusModel;
  settings.env.CLAUDE_CODE_SUBAGENT_MODEL = profile.subagentModel;
  settings.model = profile.model;
  saveClaudeSettings(settings);
}

// ─── OpenCode ────────────────────────────────────────────────

export function loadOpenCodeConfig(): OpenCodeConfig {
  if (!fs.existsSync(OPENCODE_CONFIG_FILE)) {
    return {};
  }
  const raw = fs.readFileSync(OPENCODE_CONFIG_FILE, "utf-8");
  return JSON.parse(raw) as OpenCodeConfig;
}

export function saveOpenCodeConfig(config: OpenCodeConfig): void {
  ensureDir(OPENCODE_CONFIG_DIR);
  fs.writeFileSync(
    OPENCODE_CONFIG_FILE,
    JSON.stringify(config, null, 2),
    "utf-8",
  );
}

function backupOpenCodeConfig(): void {
  ensureDir(SWITCHER_DIR);
  if (fs.existsSync(OPENCODE_CONFIG_FILE)) {
    fs.copyFileSync(OPENCODE_CONFIG_FILE, BACKUP_OPENCODE_FILE);
  } else {
    fs.writeFileSync(BACKUP_OPENCODE_FILE, "{}", "utf-8");
  }
}

export function switchOpenCode(profile: Profile): void {
  backupOpenCodeConfig();
  const config = loadOpenCodeConfig();

  if (!config.provider) {
    config.provider = {};
  }

  // 写入或更新 provider（models 仅保留当前，避免旧模型残留）
  config.provider[profile.name] = {
    options: {
      baseURL: profile.apiBaseUrl,
      apiKey: profile.apiKey,
    },
    models: {
      [profile.model]: {
        name: profile.model,
      },
    },
  };

  // 设置当前使用的模型
  config.model = `${profile.name}/${profile.model}`;

  saveOpenCodeConfig(config);
}

// ─── 统一切换入口 ────────────────────────────────────────────

export function switchToProfile(profile: Profile): void {
  if (profile.tool === "opencode") {
    switchOpenCode(profile);
  } else {
    switchClaudeCode(profile);
  }
}
