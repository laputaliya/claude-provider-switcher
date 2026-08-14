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
  listProfilesByTool,
  getActiveName,
  setActive,
  loadConfig,
  saveConfig,
} from "./config.js";
import { switchToProfile, CLAUDE_JSON_PATH, loadClaudeSettings, saveClaudeSettings } from "./switcher.js";
import { BUILT_IN_PRESETS } from "./types.js";
import type { Profile, ProviderPreset, ToolType } from "./types.js";
import fs from "node:fs";
import readline from "node:readline";

// ─── 全局 ESC 处理（短转义序列超时 + AbortController）────────

let currentAbort: (() => void) | null = null;

if (process.stdin.isTTY) {
  // Monkey-patch：所有 readline Interface（含 inquirer 内部）强制 50ms ESC 超时
  const orig = readline.createInterface;
  // @ts-ignore
  readline.createInterface = function (opts) {
    return orig.call(this, { escapeCodeTimeout: 50, ...opts });
  };
  // 通过 monkey-patched 接口初始化 keypress decoder（50ms 超时）
  const initRl = readline.createInterface({ input: process.stdin });
  initRl.close(); // 仅用于初始化，close 不会清除 keypress decoder

  process.stdin.on("keypress", (_ch, key) => {
    if ((key?.name === "escape" || key?.sequence === "\x1b") && currentAbort) {
      const abort = currentAbort;
      currentAbort = null;
      abort();
    }
  });
}

function isCancelError(e: unknown): boolean {
  return e instanceof Error
    && (e.name === "CancelPromptError"
      || e.name === "ExitPromptError"
      || e.name === "AbortPromptError");
}

type PromptWithCancel<T> = Promise<T> & { cancel(): void };

function withEscCancel<T>(
  makePrompt: (signal: AbortSignal) => PromptWithCancel<T>,
): Promise<T> {
  if (!process.stdin.isTTY) return makePrompt(new AbortController().signal);
  const controller = new AbortController();
  currentAbort = () => controller.abort();
  return makePrompt(controller.signal).finally(() => {
    currentAbort = null;
  });
}

const BACK = Symbol("back");
const BACK_CHOICE = { value: BACK, name: "🔙 返回上级菜单" };
const CUSTOM = Symbol("custom");

function cancelled(): void {
  console.log(chalk.yellow("已返回。"));
}

async function safeInput(options: Parameters<typeof input>[0]): Promise<string | null> {
  try {
    return await withEscCancel((signal) => input(options, { signal }) as PromptWithCancel<string>);
  } catch (e) {
    if (isCancelError(e)) return null;
    throw e;
  }
}

async function safePassword(options: Parameters<typeof password>[0]): Promise<string | null> {
  try {
    return await withEscCancel((signal) => password(options, { signal }) as PromptWithCancel<string>);
  } catch (e) {
    if (isCancelError(e)) return null;
    throw e;
  }
}

async function safeConfirm(options: Parameters<typeof confirm>[0]): Promise<boolean | null> {
  try {
    return await withEscCancel((signal) => confirm(options, { signal }) as PromptWithCancel<boolean>);
  } catch (e) {
    if (isCancelError(e)) return null;
    throw e;
  }
}

async function safeSelect<T>(options: Parameters<typeof select<T>>[0]): Promise<T | null> {
  try {
    return await withEscCancel((signal) => select<T>(options, { signal }) as PromptWithCancel<T>);
  } catch (e) {
    if (isCancelError(e)) return null;
    throw e;
  }
}

// ─── 主菜单 ──────────────────────────────────────────────────

async function mainMenu(): Promise<void> {
  console.log(chalk.cyan("  Claude Code / OpenCode 供应商切换工具 (ccs)"));
  console.log(chalk.dim("  快速切换大模型供应商，内置百炼/火山/硅基流动/腾讯云/DeepSeek/OpenRouter 等预设"));
  console.log("");

  while (true) {
    const action = await safeSelect({
      message: "请选择工具：",
      choices: [
        { value: "claude-code" as const, name: "🤖 Claude Code" },
        { value: "opencode" as const, name: "🐙 OpenCode" },
        { value: "exit" as const, name: "🚪 退出" },
      ],
    });

    if (action === null) {
      console.log(chalk.green("再见！"));
      return;
    }

    switch (action) {
      case "claude-code":
        await toolMenu("claude-code");
        break;
      case "opencode":
        await toolMenu("opencode");
        break;
      case "exit":
        console.log(chalk.green("再见！"));
        return;
    }
  }
}

// ─── 工具菜单（Claude Code / OpenCode）───────────────────────

async function toolMenu(tool: ToolType): Promise<void> {
  const label = tool === "claude-code" ? "Claude Code" : "OpenCode";

  while (true) {
    const choices = tool === "claude-code"
      ? [
          { value: "models", name: "🔧 模型管理" },
          { value: "config", name: "🔩 配置管理" },
          BACK_CHOICE,
        ]
      : [
          { value: "models", name: "🔧 模型管理" },
          BACK_CHOICE,
        ];

    const action = await safeSelect({
      message: `${label}：`,
      choices,
    });

    if (action === null || action === BACK) {
      cancelled();
      return;
    }

    switch (action) {
      case "models":
        await modelManagementMenu(tool);
        break;
      case "config":
        await ccConfigMenu();
        break;
    }
  }
}

// ─── 模型管理（通用，按 tool 区分）───────────────────────────

async function modelManagementMenu(tool: ToolType): Promise<void> {
  while (true) {
    const action = await safeSelect({
      message: "模型管理：",
      choices: [
        { value: "switch", name: "🔄 切换供应商" },
        { value: "add", name: "➕ 添加供应商" },
        { value: "edit", name: "📝 编辑供应商" },
        { value: "delete", name: "❌ 删除供应商" },
        { value: "list", name: "📋 列出供应商" },
        BACK_CHOICE,
      ],
    });

    if (action === null || action === BACK) {
      cancelled();
      return;
    }

    switch (action) {
      case "switch":
        await handleSwitch(tool);
        break;
      case "add":
        await handleAdd(tool);
        break;
      case "edit":
        await handleEdit(tool);
        break;
      case "delete":
        await handleDelete(tool);
        break;
      case "list":
        handleList(tool);
        break;
    }
  }
}

// ─── Claude Code 配置菜单 ────────────────────────────────────

async function ccConfigMenu(): Promise<void> {
  while (true) {
    const action = await safeSelect({
      message: "Claude Code 配置：",
      choices: [
        { value: "env", name: "🌍 环境变量设置" },
        { value: "onboarding", name: "🚀 跳过首次登录引导" },
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
    }
  }
}

// ─── 切换供应商 ──────────────────────────────────────────────

async function handleSwitch(tool: ToolType): Promise<void> {
  const profiles = listProfilesByTool(tool);
  if (profiles.length === 0) {
    console.log(chalk.yellow("暂无供应商配置，请先添加。"));
    return;
  }

  const active = getActiveName(tool);
  const profile = await safeSelect<Profile | typeof BACK>({
    message: "选择要切换的供应商：",
    choices: [
      ...profiles.map((p) => ({
        value: p as Profile | typeof BACK,
        name: `${p.name} (${p.model})${p.name === active ? chalk.green(" ← 当前") : ""}`,
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
    setActive(tool, profile.name);
    const toolLabel = tool === "claude-code" ? "Claude Code" : "OpenCode";
    console.log(chalk.green(`✓ 已切换到 "${profile.name}"，请重启 ${toolLabel} 使配置生效。`));
  } catch (err) {
    console.log(chalk.red(`切换失败：${(err as Error).message}`));
  }
}

// ─── 添加供应商 ──────────────────────────────────────────────

async function handleAdd(tool: ToolType): Promise<void> {
  const toolLabel = tool === "claude-code" ? "Claude Code" : "OpenCode";
  const presetChoice = await safeSelect<ProviderPreset | typeof CUSTOM | typeof BACK>({
    message: `选择供应商（目标工具: ${toolLabel}）：`,
    choices: [
      ...BUILT_IN_PRESETS.map((p) => ({
        value: p as ProviderPreset | typeof CUSTOM | typeof BACK,
        name: `${p.label} (${tool === "opencode" ? p.apiBaseUrlOC : p.apiBaseUrl})`,
      })),
      { value: CUSTOM as typeof CUSTOM, name: "🔧 自定义" },
      BACK_CHOICE as { value: ProviderPreset | typeof CUSTOM | typeof BACK; name: string },
    ],
  });

  if (presetChoice === null || presetChoice === BACK) {
    cancelled();
    return;
  }

  let profile: Profile;

  if (tool === "claude-code") {
    // Claude Code：完整的模型字段
    if (presetChoice !== CUSTOM) {
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
        tool,
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
        tool,
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
  } else {
    // OpenCode：只需 name / apiKey / apiBaseUrl / model
    if (presetChoice !== CUSTOM) {
      const preset = presetChoice as ProviderPreset;
      const apiKey = await safeInput({ message: `API Key（${preset.label}）：` });
      if (apiKey === null) { cancelled(); return; }
      if (!apiKey.trim()) {
        console.log(chalk.yellow("API Key 不能为空。"));
        return;
      }
      const model = await safeInput({ message: "模型名称（将作为 model-id）：", default: preset.model });
      if (model === null) { cancelled(); return; }
      profile = {
        tool,
        name: preset.name,
        apiKey,
        apiBaseUrl: preset.apiBaseUrlOC,
        model: model || preset.model,
        smallFastModel: "",
        haikuModel: "",
        sonnetModel: "",
        opusModel: "",
        subagentModel: "",
      };
    } else {
      const name = await safeInput({ message: "供应商名（即 provider-id，如 my-provider）：" });
      if (name === null || !name.trim()) { cancelled(); return; }
      const apiKey = await safeInput({ message: "API Key：" });
      if (apiKey === null) { cancelled(); return; }
      if (!apiKey.trim()) {
        console.log(chalk.yellow("API Key 不能为空。"));
        return;
      }
      const apiBaseUrl = await safeInput({ message: "API Base URL：" });
      if (apiBaseUrl === null) { cancelled(); return; }
      const model = await safeInput({ message: "模型名称（即 model-id）：" });
      if (model === null) { cancelled(); return; }
      profile = {
        tool,
        name: name.trim(),
        apiKey,
        apiBaseUrl: apiBaseUrl || "",
        model: model || "",
        smallFastModel: "",
        haikuModel: "",
        sonnetModel: "",
        opusModel: "",
        subagentModel: "",
      };
    }
  }

  try {
    addProfile(profile);
    console.log(chalk.green(`✓ 供应商 "${profile.name}" 已添加（目标: ${toolLabel}）。`));
  } catch (err) {
    console.log(chalk.red((err as Error).message));
  }
}

// ─── 编辑供应商 ──────────────────────────────────────────────

async function handleEdit(tool: ToolType): Promise<void> {
  const profiles = listProfilesByTool(tool);
  if (profiles.length === 0) {
    console.log(chalk.yellow("暂无供应商配置。"));
    return;
  }

  const selected = await safeSelect<Profile | typeof BACK>({
    message: "选择要编辑的供应商：",
    choices: [
      ...profiles.map((p) => ({
        value: p as Profile | typeof BACK,
        name: `${p.name} (${p.model})`,
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

  let profile: Profile;

  if (tool === "claude-code") {
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

    profile = {
      tool,
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
  } else {
    profile = {
      tool,
      name: selected.name,
      apiKey: apiKey || selected.apiKey,
      apiBaseUrl: apiBaseUrl || selected.apiBaseUrl,
      model: mainModel,
      smallFastModel: "",
      haikuModel: "",
      sonnetModel: "",
      opusModel: "",
      subagentModel: "",
    };
  }

  try {
    const config = loadConfig();
    const idx = config.profiles.findIndex(
      (p) => p.name === selected.name && p.tool === tool,
    );
    if (idx !== -1) {
      config.profiles[idx] = profile;
      saveConfig(config);
      // 如果编辑的是当前激活的供应商，立即同步到工具配置文件
      const active = config.active[tool];
      if (active === selected.name) {
        switchToProfile(profile);
      }
      console.log(chalk.green(`✓ 供应商 "${selected.name}" 已更新。`));
    }
  } catch (err) {
    console.log(chalk.red((err as Error).message));
  }
}

// ─── 删除供应商 ──────────────────────────────────────────────

async function handleDelete(tool: ToolType): Promise<void> {
  const profiles = listProfilesByTool(tool);
  if (profiles.length === 0) {
    console.log(chalk.yellow("暂无供应商配置。"));
    return;
  }

  const active = getActiveName(tool);
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
      message: chalk.yellow(`"${selected}" 是当前激活的供应商，确认删除？`),
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
    removeProfile(tool, selected);
    console.log(chalk.green(`✓ 供应商 "${selected}" 已删除。`));
  } catch (err) {
    console.log(chalk.red((err as Error).message));
  }
}

// ─── 列出供应商 ──────────────────────────────────────────────

function handleList(tool: ToolType): void {
  const profiles = listProfilesByTool(tool);
  const active = getActiveName(tool);
  const toolLabel = tool === "claude-code" ? "Claude Code" : "OpenCode";

  if (profiles.length === 0) {
    console.log(chalk.yellow(`暂无 ${toolLabel} 供应商配置。`));
    return;
  }

  console.log("");
  console.log(chalk.dim(`  [${toolLabel}]`));
  for (const p of profiles) {
    const marker = p.name === active ? chalk.green(" ← 当前") : "";
    console.log(`  ${chalk.bold(p.name)}${marker}`);
    console.log(`    Base URL:  ${p.apiBaseUrl}`);
    console.log(`    模型:      ${p.model}`);
    if (tool === "claude-code") {
      if (p.smallFastModel !== p.model) console.log(`    Small/Fast: ${p.smallFastModel}`);
      if (p.haikuModel !== p.model) console.log(`    Haiku:      ${p.haikuModel}`);
      if (p.sonnetModel !== p.model) console.log(`    Sonnet:     ${p.sonnetModel}`);
      if (p.opusModel !== p.model) console.log(`    Opus:       ${p.opusModel}`);
      if (p.subagentModel !== p.model) console.log(`    Subagent:   ${p.subagentModel}`);
    }
  }
  console.log("");
}

// ─── 跳过首次登录引导 ────────────────────────────────────────

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
