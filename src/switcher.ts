import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Profile } from "./types.js";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SETTINGS_FILE = path.join(CLAUDE_DIR, "settings.json");

export const CLAUDE_JSON_PATH = path.join(os.homedir(), ".claude.json");

const CONFIG_DIR = path.join(os.homedir(), ".claude-switcher");
const BACKUP_FILE = path.join(CONFIG_DIR, "backup.json");

interface ClaudeSettings {
  env?: Record<string, string>;
  attribution?: {
    commits?: boolean;
    pullRequests?: boolean;
  };
  [key: string]: unknown;
}

function ensureClaudeDir(): void {
  if (!fs.existsSync(CLAUDE_DIR)) {
    fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  }
}

function ensureSwitcherDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadClaudeSettings(): ClaudeSettings {
  if (!fs.existsSync(SETTINGS_FILE)) {
    return { env: {} };
  }
  const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
  return JSON.parse(raw) as ClaudeSettings;
}

export function saveClaudeSettings(settings: ClaudeSettings): void {
  ensureClaudeDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}

export function backupSettings(): void {
  ensureSwitcherDir();
  if (fs.existsSync(SETTINGS_FILE)) {
    fs.copyFileSync(SETTINGS_FILE, BACKUP_FILE);
  } else {
    fs.writeFileSync(BACKUP_FILE, "{}", "utf-8");
  }
}

export function switchToProfile(profile: Profile): void {
  backupSettings();
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
