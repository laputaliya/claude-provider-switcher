import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Profile } from "./types.js";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SETTINGS_FILE = path.join(CLAUDE_DIR, "settings.local.json");

const CONFIG_DIR = path.join(os.homedir(), ".claude-switcher");
const BACKUP_FILE = path.join(CONFIG_DIR, "backup.json");

interface ClaudeSettings {
  apiKey?: string;
  apiBaseUrl?: string;
  model?: string;
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
    return {};
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
  settings.apiKey = profile.apiKey;
  settings.apiBaseUrl = profile.apiBaseUrl;
  settings.model = profile.model;
  saveClaudeSettings(settings);
}
