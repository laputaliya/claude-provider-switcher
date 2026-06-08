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
  loadConfig,
  saveConfig,
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
  smallFastModel: "Small/Fast 模型",
  haikuModel: "Haiku 模型",
  sonnetModel: "Sonnet 模型",
  opusModel: "Opus 模型",
  subagentModel: "Subagent 模型",
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
        { value: "models", name: "🔧  模型管理" },
        { value: "config", name: "⚙️  Claude Code 配置" },
        { value: "exit", name: "🚪  退出" },
      ],
    });

    if (action === null) {
      console.log(chalk.green("再见！"));
      return;
    }

    switch (action) {
      case "models":
        await modelManagementMenu();
        break;
      case "config":
        await ccConfigMenu();
        break;
      case "exit":
        console.log(chalk.green("再见！"));
        return;
    }
  }
}

async function modelManagementMenu(): Promise<void> {
  while (true) {
    const action = await safeSelect({
      message: "模型管理：",
      choices: [
        { value: "switch", name: "🔄  切换供应商" },
        { value: "add", name: "➕  添加供应商" },
        { value: "edit", name: "✏️  编辑供应商" },
        { value: "delete", name: "🗑️  删除供应商" },
        { value: "list", name: "📋  列出供应商" },
        BACK_CHOICE,
      ],
    });

    if (action === null || action === BACK) {
      cancelled();
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
    }
  }
}

async function ccConfigMenu(): Promise<void> {
  while (true) {
    const action = await safeSelect({
      message: "Claude Code 配置：",
      choices: [
        { value: "env", name: "🌍  环境变量设置" },
        { value: "onboarding", name: "🚀  跳过首次登录引导" },
        { value: "attribution", name: "✍️  AI 署名设置" },
        BACK_CHOICE,
      ],
    });

    if (action === null || action === BACK) {
      cancelled();
      return;
    }

    switch (action) {
      case "env":
        await handleEnvVars();
        break;
      case "onboarding":
        await handleOnboarding();
        break;
      case "attribution":
        await handleAttribution();
        break;
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
    const mainModel = model || preset.model;
    const smallFastModel = await safeInput({ message: "Small/Fast 模型：", default: mainModel });
    if (smallFastModel === null) { cancelled(); return; }
    const haikuModel = await safeInput({ message: "Haiku 模型：", default: mainModel });
    if (haikuModel === null) { cancelled(); return; }
    const sonnetModel = await safeInput({ message: "Sonnet 模型：", default: mainModel });
    if (sonnetModel === null) { cancelled(); return; }
    const opusModel = await safeInput({ message: "Opus 模型：", default: mainModel });
    if (opusModel === null) { cancelled(); return; }
    const subagentModel = await safeInput({ message: "Subagent 模型：", default: mainModel });
    if (subagentModel === null) { cancelled(); return; }
    profile = {
      name: preset.name,
      apiKey,
      apiBaseUrl: preset.apiBaseUrl,
      model: mainModel,
      smallFastModel: smallFastModel || mainModel,
      haikuModel: haikuModel || mainModel,
      sonnetModel: sonnetModel || mainModel,
      opusModel: opusModel || mainModel,
      subagentModel: subagentModel || mainModel,
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
    const mainModel = model || "";
    const smallFastModel = await safeInput({ message: "Small/Fast 模型：", default: mainModel });
    if (smallFastModel === null) { cancelled(); return; }
    const haikuModel = await safeInput({ message: "Haiku 模型：", default: mainModel });
    if (haikuModel === null) { cancelled(); return; }
    const sonnetModel = await safeInput({ message: "Sonnet 模型：", default: mainModel });
    if (sonnetModel === null) { cancelled(); return; }
    const opusModel = await safeInput({ message: "Opus 模型：", default: mainModel });
    if (opusModel === null) { cancelled(); return; }
    const subagentModel = await safeInput({ message: "Subagent 模型：", default: mainModel });
    if (subagentModel === null) { cancelled(); return; }
    profile = {
      name: name.trim(),
      apiKey,
      apiBaseUrl,
      model: mainModel,
      smallFastModel: smallFastModel || mainModel,
      haikuModel: haikuModel || mainModel,
      sonnetModel: sonnetModel || mainModel,
      opusModel: opusModel || mainModel,
      subagentModel: subagentModel || mainModel,
    };
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

  const apiKey = await safeInput({
    message: `API Key（明文输入，回车保持原值）：`,
    default: selected.apiKey,
  });
  if (apiKey === null) { cancelled(); return; }

  const apiBaseUrl = await safeInput({
    message: "API Base URL（回车保持原值）：",
    default: selected.apiBaseUrl,
  });
  if (apiBaseUrl === null) { cancelled(); return; }

  const model = await safeInput({
    message: "模型名称（回车保持原值）：",
    default: selected.model,
  });
  if (model === null) { cancelled(); return; }

  const mainModel = model || selected.model;

  const smallFastModel = await safeInput({
    message: "Small/Fast 模型（回车保持原值）：",
    default: selected.smallFastModel || mainModel,
  });
  if (smallFastModel === null) { cancelled(); return; }

  const haikuModel = await safeInput({
    message: "Haiku 模型（回车保持原值）：",
    default: selected.haikuModel || mainModel,
  });
  if (haikuModel === null) { cancelled(); return; }

  const sonnetModel = await safeInput({
    message: "Sonnet 模型（回车保持原值）：",
    default: selected.sonnetModel || mainModel,
  });
  if (sonnetModel === null) { cancelled(); return; }

  const opusModel = await safeInput({
    message: "Opus 模型（回车保持原值）：",
    default: selected.opusModel || mainModel,
  });
  if (opusModel === null) { cancelled(); return; }

  const subagentModel = await safeInput({
    message: "Subagent 模型（回车保持原值）：",
    default: selected.subagentModel || mainModel,
  });
  if (subagentModel === null) { cancelled(); return; }

  const profile: Profile = {
    name: selected.name,
    apiKey: apiKey || selected.apiKey,
    apiBaseUrl: apiBaseUrl || selected.apiBaseUrl,
    model: mainModel,
    smallFastModel: smallFastModel || mainModel,
    haikuModel: haikuModel || mainModel,
    sonnetModel: sonnetModel || mainModel,
    opusModel: opusModel || mainModel,
    subagentModel: subagentModel || mainModel,
  };

  try {
    const config = loadConfig();
    const idx = config.profiles.findIndex((p) => p.name === selected.name);
    if (idx !== -1) {
      config.profiles[idx] = profile;
      saveConfig(config);
      console.log(chalk.green(`✓ 供应商 "${selected.name}" 已更新。`));
    }
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
    console.log(`    Base URL:       ${p.apiBaseUrl}`);
    console.log(`    模型:           ${p.model}`);
    if (p.smallFastModel !== p.model) console.log(`    Small/Fast:     ${p.smallFastModel}`);
    if (p.haikuModel !== p.model) console.log(`    Haiku:          ${p.haikuModel}`);
    if (p.sonnetModel !== p.model) console.log(`    Sonnet:         ${p.sonnetModel}`);
    if (p.opusModel !== p.model) console.log(`    Opus:           ${p.opusModel}`);
    if (p.subagentModel !== p.model) console.log(`    Subagent:       ${p.subagentModel}`);
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

// ─── 环境变量定义 ────────────────────────────────────────────

interface EnvVarDef {
  key: string;
  label: string;
  desc: string;
  type: "input" | "select" | "boolean";
  options?: { value: string; name: string }[];
}

const ENV_VAR_DEFS: EnvVarDef[] = [
  {
    key: "CLAUDE_CODE_EFFORT_LEVEL",
    label: "思考努力程度",
    desc: "控制 Claude Code 思考深度，影响响应质量与耗时",
    type: "select",
    options: [
      { value: "auto", name: "自动（默认）" },
      { value: "low", name: "低" },
      { value: "medium", name: "中" },
      { value: "high", name: "高" },
      { value: "xhigh", name: "极高" },
      { value: "max", name: "最大" },
    ],
  },
  {
    key: "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
    label: "禁用非必要网络流量",
    desc: "禁止 Claude Code 后台发送遥测/分析等非必要请求",
    type: "boolean",
  },
  {
    key: "CLAUDE_CODE_DISABLE_THINKING",
    label: "禁用扩展思考",
    desc: "强制关闭扩展思考模式，可提升响应速度",
    type: "boolean",
  },
  {
    key: "CLAUDE_CODE_DISABLE_AUTO_MEMORY",
    label: "禁用自动记忆",
    desc: "关闭 Claude Code 自动记录记忆的功能",
    type: "boolean",
  },
  {
    key: "CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS",
    label: "禁用 Git 指令",
    desc: "不自动注入 Git 相关的工作流提示",
    type: "boolean",
  },
  {
    key: "API_TIMEOUT_MS",
    label: "API 超时（毫秒）",
    desc: "API 请求超时时间，默认 600000（10分钟），最大 2147483647",
    type: "input",
  },
  {
    key: "CLAUDE_CODE_MAX_OUTPUT_TOKENS",
    label: "最大输出 Token 数",
    desc: "限制单次请求的最大输出 token 数量",
    type: "input",
  },
  {
    key: "CLAUDE_CODE_ATTRIBUTION_HEADER",
    label: "署名请求头",
    desc: "自定义 Claude Code 发送的署名标识字符串",
    type: "input",
  },
];

// ─── 环境变量处理函数 ────────────────────────────────────────

const EFFORT_LABELS: Record<string, string> = {
  auto: "自动",
  low: "低",
  medium: "中",
  high: "高",
  xhigh: "极高",
  max: "最大",
};

async function handleEnvVars(): Promise<void> {
  const settings = loadClaudeSettings();
  if (!settings.env) {
    settings.env = {};
  }
  const env = settings.env;

  while (true) {
    // 显示当前值
    console.log("");
    console.log(chalk.bold("  当前环境变量："));
    for (const def of ENV_VAR_DEFS) {
      const val = env[def.key];
      let display: string;
      if (def.type === "boolean") {
        display = val === "1" ? chalk.green("已开启") : chalk.dim("未设置/关闭");
      } else if (def.key === "CLAUDE_CODE_EFFORT_LEVEL") {
        display = val ? chalk.cyan(EFFORT_LABELS[val] ?? val) : chalk.dim("未设置");
      } else {
        display = val ? chalk.cyan(val) : chalk.dim("未设置");
      }
      console.log(`    ${chalk.bold(def.label)}：${display}`);
    }
    console.log("");

    const defsWithBack = [
      ...ENV_VAR_DEFS.map((d) => ({
        value: d as EnvVarDef | typeof BACK,
        name: `${d.label} — ${chalk.dim(d.desc)}`,
      })),
      BACK_CHOICE as { value: EnvVarDef | typeof BACK; name: string },
    ];

    const chosen = await safeSelect<EnvVarDef | typeof BACK>({
      message: "选择要修改的环境变量：",
      choices: defsWithBack,
    });

    if (chosen === null || chosen === BACK) {
      cancelled();
      return;
    }

    const def = chosen as EnvVarDef;

    if (def.type === "boolean") {
      const currentOn = env[def.key] === "1";
      const choice = await safeSelect({
        message: `${def.label}：`,
        choices: [
          { value: "on", name: `开启${currentOn ? chalk.green(" ← 当前") : ""}` },
          { value: "off", name: `关闭${!currentOn ? chalk.green(" ← 当前") : ""}` },
        ],
      });
      if (choice === null) { cancelled(); return; }
      if (choice === "on") {
        env[def.key] = "1";
      } else {
        delete env[def.key];
      }
    } else if (def.type === "select") {
      const currentVal = env[def.key] || "auto";
      const options = (def.options ?? []).map((o) => ({
        value: o.value,
        name: `${o.name}${o.value === currentVal ? chalk.green(" ← 当前") : ""}`,
      }));
      const val = await safeSelect({
        message: `${def.label}：`,
        choices: options,
      });
      if (val === null) { cancelled(); return; }
      env[def.key] = val;
    } else {
      const val = await safeInput({
        message: `${def.label}：`,
        default: env[def.key] ?? "",
      });
      if (val === null) { cancelled(); return; }
      if (val.trim()) {
        env[def.key] = val.trim();
      } else {
        delete env[def.key];
      }
    }

    try {
      saveClaudeSettings(settings);
      console.log(chalk.green(`✓ 环境变量 "${def.label}" 已保存。`));
    } catch (err) {
      console.log(chalk.red(`保存失败：${(err as Error).message}`));
    }
  }
}

mainMenu().catch(console.error);
