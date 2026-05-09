import {
  select,
  input,
  confirm,
  password,
} from "@inquirer/prompts";
import chalk from "chalk";
import {
  addProfile,
  removeProfile,
  updateProfile,
  listProfiles,
  getActiveName,
  setActive,
} from "./config.js";
import { switchToProfile, CLAUDE_JSON_PATH, loadClaudeSettings, saveClaudeSettings } from "./switcher.js";
import { BUILT_IN_PRESETS } from "./types.js";
import type { Profile, ProviderPreset } from "./types.js";
import fs from "node:fs";

function isCancelError(e: unknown): boolean {
  return e instanceof Error
    && (e.name === "CancelPromptError"
      || e.name === "ExitPromptError"
      || e.name === "AbortPromptError");
}

type PromptWithCancel<T> = Promise<T> & { cancel(): void };

function withEscCancel<T>(prompt: PromptWithCancel<T>): Promise<T> {
  if (!process.stdin.isTTY) return prompt;

  let handled = false;
  const listener = (ch: string, key: { name?: string; sequence?: string }) => {
    if (handled) return;
    if (key.name === "escape" || key.sequence === "\x1b") {
      handled = true;
      process.stdin.removeListener("keypress", listener);
      prompt.cancel();
    }
  };
  process.stdin.on("keypress", listener);

  return prompt.then(
    (result) => {
      process.stdin.removeListener("keypress", listener);
      return result;
    },
    (err) => {
      process.stdin.removeListener("keypress", listener);
      throw err;
    },
  );
}

type FieldKey = keyof Profile;

const FIELD_LABELS: Record<FieldKey, string> = {
  name: "供应商名",
  apiKey: "API Key",
  apiBaseUrl: "API Base URL",
  model: "模型名称",
};

const BACK = Symbol("back");
const BACK_CHOICE = { value: BACK, name: "↩️  返回上级菜单" };

function cancelled(): void {
  console.log(chalk.yellow("已返回。"));
}

async function safeInput(options: Parameters<typeof input>[0]): Promise<string | null> {
  try {
    return await withEscCancel(input(options));
  } catch (e) {
    if (isCancelError(e)) return null;
    throw e;
  }
}

async function safePassword(options: Parameters<typeof password>[0]): Promise<string | null> {
  try {
    return await withEscCancel(password(options));
  } catch (e) {
    if (isCancelError(e)) return null;
    throw e;
  }
}

async function safeConfirm(options: Parameters<typeof confirm>[0]): Promise<boolean | null> {
  try {
    return await withEscCancel(confirm(options));
  } catch (e) {
    if (isCancelError(e)) return null;
    throw e;
  }
}

async function safeSelect<T>(options: Parameters<typeof select<T>>[0]): Promise<T | null> {
  try {
    return await withEscCancel(select<T>(options) as PromptWithCancel<T>);
  } catch (e) {
    if (isCancelError(e)) return null;
    throw e;
  }
}

async function mainMenu(): Promise<void> {
  console.log(chalk.cyan("  Claude Code 供应商切换工具 (ccs)"));
  console.log(chalk.dim("  快速切换大模型供应商，内置百炼/火山/硅基流动/腾讯云/DeepSeek/OpenRouter 等预设"));
  console.log("");

  while (true) {
    const action = await safeSelect({
      message: "请选择操作：",
      choices: [
        { value: "switch", name: "🔄  切换供应商" },
        { value: "add", name: "➕  添加供应商" },
        { value: "edit", name: "✏️  编辑供应商" },
        { value: "delete", name: "🗑️  删除供应商" },
        { value: "list", name: "📋  列出供应商" },
        { value: "onboarding", name: "🚀  跳过首次登录引导" },
        { value: "attribution", name: "✍️  AI 署名设置" },
        { value: "exit", name: "🚪  退出" },
      ],
    });

    if (action === null) {
      console.log(chalk.green("再见！"));
      return;
    }

    switch (action) {
      case "switch":
        await handleSwitch();
        break;
      case "add":
        await handleAdd();
        break;
      case "edit":
        await handleEdit();
        break;
      case "delete":
        await handleDelete();
        break;
      case "list":
        handleList();
        break;
      case "onboarding":
        await handleOnboarding();
        break;
      case "attribution":
        await handleAttribution();
        break;
      case "exit":
        console.log(chalk.green("再见！"));
        return;
    }
  }
}

async function handleSwitch(): Promise<void> {
  const profiles = listProfiles();
  if (profiles.length === 0) {
    console.log(chalk.yellow("暂无供应商配置，请先添加。"));
    return;
  }

  const active = getActiveName();
  const profile = await safeSelect<Profile | typeof BACK>({
    message: "选择要切换的供应商：",
    choices: [
      ...profiles.map((p) => ({
        value: p as Profile | typeof BACK,
        name: `${p.name} (模型: ${p.model})${p.name === active ? chalk.green(" [当前]") : ""}`,
      })),
      BACK_CHOICE as { value: Profile | typeof BACK; name: string },
    ],
  });

  if (profile === null || profile === BACK) {
    cancelled();
    return;
  }

  const confirmed = await safeConfirm({
    message: `确认切换到 "${profile.name}"？（Base URL: ${profile.apiBaseUrl}, 模型: ${profile.model}）`,
  });
  if (confirmed === null || !confirmed) {
    console.log(chalk.yellow("已取消切换。"));
    return;
  }

  try {
    switchToProfile(profile);
    setActive(profile.name);
    console.log(chalk.green(`✓ 已切换到 "${profile.name}"，请重启 Claude Code 使配置生效。`));
  } catch (err) {
    console.log(chalk.red(`切换失败：${(err as Error).message}`));
  }
}

async function handleAdd(): Promise<void> {
  const presetChoice = await safeSelect<ProviderPreset | null | typeof BACK>({
    message: "选择供应商：",
    choices: [
      ...BUILT_IN_PRESETS.map((p) => ({
        value: p as ProviderPreset | null | typeof BACK,
        name: `${p.label} (${p.apiBaseUrl})`,
      })),
      { value: null as ProviderPreset | null | typeof BACK, name: "🔧  自定义" },
      BACK_CHOICE as { value: ProviderPreset | null | typeof BACK; name: string },
    ],
  });

  if (presetChoice === null || presetChoice === BACK) {
    cancelled();
    return;
  }

  let profile: Profile;

  if (presetChoice) {
    const preset = presetChoice as ProviderPreset;
    const apiKey = await safeInput({ message: `API Key（${preset.label}）：` });
    if (apiKey === null) { cancelled(); return; }
    if (!apiKey.trim()) {
      console.log(chalk.yellow("API Key 不能为空。"));
      return;
    }
    const model = await safeInput({ message: "模型名称：", default: preset.model });
    if (model === null) { cancelled(); return; }
    profile = {
      name: preset.name,
      apiKey,
      apiBaseUrl: preset.apiBaseUrl,
      model: model || preset.model,
    };
  } else {
    const name = await safeInput({ message: "供应商名（如 my-provider）：" });
    if (name === null || !name.trim()) { cancelled(); return; }
    const apiKey = await safeInput({ message: "API Key：" });
    if (apiKey === null) { cancelled(); return; }
    if (!apiKey.trim()) {
      console.log(chalk.yellow("API Key 不能为空。"));
      return;
    }
    const apiBaseUrl = await safeInput({ message: "API Base URL：" });
    if (apiBaseUrl === null) { cancelled(); return; }
    const model = await safeInput({ message: "模型名称：" });
    if (model === null) { cancelled(); return; }
    profile = { name: name.trim(), apiKey, apiBaseUrl, model };
  }

  try {
    addProfile(profile);
    console.log(chalk.green(`✓ 供应商 "${profile.name}" 已添加。`));
  } catch (err) {
    console.log(chalk.red((err as Error).message));
  }
}

async function handleEdit(): Promise<void> {
  const profiles = listProfiles();
  if (profiles.length === 0) {
    console.log(chalk.yellow("暂无供应商配置。"));
    return;
  }

  const selected = await safeSelect<Profile | typeof BACK>({
    message: "选择要编辑的供应商：",
    choices: [
      ...profiles.map((p) => ({
        value: p as Profile | typeof BACK,
        name: `${p.name} (模型: ${p.model})`,
      })),
      BACK_CHOICE as { value: Profile | typeof BACK; name: string },
    ],
  });

  if (selected === null || selected === BACK) {
    cancelled();
    return;
  }

  const field = await safeSelect<FieldKey | typeof BACK>({
    message: "选择要修改的字段：",
    choices: [
      ...(["apiKey", "apiBaseUrl", "model"] as FieldKey[]).map((f) => ({
        value: f as FieldKey | typeof BACK,
        name: FIELD_LABELS[f],
      })),
      BACK_CHOICE as { value: FieldKey | typeof BACK; name: string },
    ],
  });

  if (field === null || field === BACK) {
    cancelled();
    return;
  }

  let newValue: string;
  if (field === "apiKey") {
    const val = await safeInput({
      message: `新的 ${FIELD_LABELS[field]}（明文输入，请确认无误）：`,
    });
    if (val === null) { cancelled(); return; }
    newValue = val;
  } else {
    const val = await safeInput({
      message: `新的 ${FIELD_LABELS[field]}：`,
      default: selected[field],
    });
    if (val === null) { cancelled(); return; }
    newValue = val;
  }

  try {
    updateProfile(selected.name, field, newValue);
    console.log(chalk.green(`✓ "${selected.name}" 的 ${FIELD_LABELS[field]} 已更新。`));
  } catch (err) {
    console.log(chalk.red((err as Error).message));
  }
}

async function handleDelete(): Promise<void> {
  const profiles = listProfiles();
  if (profiles.length === 0) {
    console.log(chalk.yellow("暂无供应商配置。"));
    return;
  }

  const active = getActiveName();
  const selected = await safeSelect<string | typeof BACK>({
    message: "选择要删除的供应商：",
    choices: [
      ...profiles.map((p) => ({
        value: p.name as string | typeof BACK,
        name: `${p.name}${p.name === active ? chalk.red(" [当前激活]") : ""}`,
      })),
      BACK_CHOICE as { value: string | typeof BACK; name: string },
    ],
  });

  if (selected === null || selected === BACK) {
    cancelled();
    return;
  }

  if (selected === active) {
    const warned = await safeConfirm({
      message: chalk.yellow(`"${selected}" 是当前激活的供应商，删除后 Claude Code 将使用 settings.local.json 中的现有值。确认删除？`),
    });
    if (warned === null || !warned) {
      console.log(chalk.yellow("已取消删除。"));
      return;
    }
  } else {
    const confirmed = await safeConfirm({ message: `确认删除 "${selected}"？` });
    if (confirmed === null || !confirmed) {
      console.log(chalk.yellow("已取消删除。"));
      return;
    }
  }

  try {
    removeProfile(selected);
    console.log(chalk.green(`✓ 供应商 "${selected}" 已删除。`));
  } catch (err) {
    console.log(chalk.red((err as Error).message));
  }
}

function handleList(): void {
  const profiles = listProfiles();
  const active = getActiveName();

  if (profiles.length === 0) {
    console.log(chalk.yellow("暂无供应商配置。"));
    return;
  }

  console.log("");
  for (const p of profiles) {
    const marker = p.name === active ? chalk.green(" ← 当前") : "";
    console.log(`  ${chalk.bold(p.name)}${marker}`);
    console.log(`    Base URL: ${p.apiBaseUrl}`);
    console.log(`    模型:     ${p.model}`);
  }
  console.log("");
}

async function handleOnboarding(): Promise<void> {
  let config: Record<string, unknown>;
  try {
    const raw = fs.readFileSync(CLAUDE_JSON_PATH, "utf-8");
    config = JSON.parse(raw);
  } catch {
    config = {};
  }

  const current = config.hasCompletedOnboarding === true;
  console.log(`  当前状态：${current ? chalk.green("已跳过首次登录引导") : chalk.red("未跳过首次登录引导")}`);
  console.log("");

  const choice = await safeSelect<string | typeof BACK>({
    message: "跳过首次登录引导设置：",
    choices: [
      { value: "skip", name: `跳过引导（设置 hasCompletedOnboarding = true）` },
      { value: "reset", name: `重置引导（设置 hasCompletedOnboarding = false）` },
      BACK_CHOICE as { value: string | typeof BACK; name: string },
    ],
  });

  if (choice === null || choice === BACK) {
    cancelled();
    return;
  }

  config.hasCompletedOnboarding = choice === "skip";

  try {
    fs.writeFileSync(CLAUDE_JSON_PATH, JSON.stringify(config, null, 2), "utf-8");
    if (choice === "skip") {
      console.log(chalk.green("✓ 已设置跳过首次登录引导，下次启动 Claude Code 将直接进入。"));
    } else {
      console.log(chalk.green("✓ 已重置首次登录引导，下次启动 Claude Code 将显示引导流程。"));
    }
  } catch (err) {
    console.log(chalk.red(`设置失败：${(err as Error).message}`));
  }
}

async function handleAttribution(): Promise<void> {
  const settings = loadClaudeSettings();
  const attr = (settings.attribution ?? {}) as { commits?: boolean; pullRequests?: boolean };

  const commitsLabel = attr.commits ? chalk.green("已开启") : chalk.red("已关闭");
  const prsLabel = attr.pullRequests ? chalk.green("已开启") : chalk.red("已关闭");

  console.log(`  git提交署名：${commitsLabel}`);
  console.log(`  PR署名：${prsLabel}`);
  console.log("");

  const choice = await safeSelect<string | typeof BACK>({
    message: "AI 署名设置：",
    choices: [
      { value: "commits-on", name: `git 提交署名 — 开启` },
      { value: "commits-off", name: `git 提交署名 — 关闭` },
      { value: "prs-on", name: `PR 署名 — 开启` },
      { value: "prs-off", name: `PR 署名 — 关闭` },
      BACK_CHOICE as { value: string | typeof BACK; name: string },
    ],
  });

  if (choice === null || choice === BACK) {
    cancelled();
    return;
  }

  if (!settings.attribution) {
    settings.attribution = {};
  }
  const a = settings.attribution as { commits?: boolean; pullRequests?: boolean };

  switch (choice) {
    case "commits-on":
      a.commits = true;
      break;
    case "commits-off":
      a.commits = false;
      break;
    case "prs-on":
      a.pullRequests = true;
      break;
    case "prs-off":
      a.pullRequests = false;
      break;
  }

  try {
    saveClaudeSettings(settings);
    console.log(chalk.green("✓ AI 署名设置已保存。"));
  } catch (err) {
    console.log(chalk.red(`设置失败：${(err as Error).message}`));
  }
}

mainMenu().catch(console.error);
