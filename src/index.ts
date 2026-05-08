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
import { switchToProfile } from "./switcher.js";
import type { Profile } from "./types.js";

type FieldKey = keyof Profile;

const FIELD_LABELS: Record<FieldKey, string> = {
  name: "档案名",
  apiKey: "API Key",
  apiBaseUrl: "API Base URL",
  model: "模型名称",
};

async function mainMenu(): Promise<void> {
  while (true) {
    const action = await select({
      message: "请选择操作：",
      choices: [
        { value: "switch", name: "🔄 切换配置" },
        { value: "add", name: "➕ 添加配置" },
        { value: "edit", name: "✏️  编辑配置" },
        { value: "delete", name: "🗑️  删除配置" },
        { value: "list", name: "📋 列出配置" },
        { value: "exit", name: "🚪 退出" },
      ],
    });

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
      case "exit":
        console.log(chalk.green("再见！"));
        return;
    }
  }
}

async function handleSwitch(): Promise<void> {
  const profiles = listProfiles();
  if (profiles.length === 0) {
    console.log(chalk.yellow("暂无配置档案，请先添加。"));
    return;
  }

  const active = getActiveName();
  const profile = await select({
    message: "选择要切换的配置：",
    choices: profiles.map((p) => ({
      value: p,
      name: `${p.name} (模型: ${p.model})${p.name === active ? chalk.green(" [当前]") : ""}`,
    })),
  });

  const confirmed = await confirm({
    message: `确认切换到 "${profile.name}"？（Base URL: ${profile.apiBaseUrl}, 模型: ${profile.model}）`,
  });

  if (!confirmed) {
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
  const name = await input({ message: "档案名（如 bailian、volcano）：" });
  if (!name.trim()) {
    console.log(chalk.yellow("档案名不能为空。"));
    return;
  }

  const apiKey = await password({ message: "API Key：" });
  const apiBaseUrl = await input({ message: "API Base URL：" });
  const model = await input({ message: "模型名称：" });

  try {
    addProfile({ name: name.trim(), apiKey, apiBaseUrl, model });
    console.log(chalk.green(`✓ 配置档案 "${name.trim()}" 已添加。`));
  } catch (err) {
    console.log(chalk.red((err as Error).message));
  }
}

async function handleEdit(): Promise<void> {
  const profiles = listProfiles();
  if (profiles.length === 0) {
    console.log(chalk.yellow("暂无配置档案。"));
    return;
  }

  const selected = await select({
    message: "选择要编辑的配置：",
    choices: profiles.map((p) => ({
      value: p,
      name: `${p.name} (模型: ${p.model})`,
    })),
  });

  const field = await select({
    message: "选择要修改的字段：",
    choices: (["apiKey", "apiBaseUrl", "model"] as FieldKey[]).map((f) => ({
      value: f,
      name: FIELD_LABELS[f],
    })),
  });

  let newValue: string;
  if (field === "apiKey") {
    newValue = await password({ message: `新的 ${FIELD_LABELS[field]}：` });
  } else {
    newValue = await input({
      message: `新的 ${FIELD_LABELS[field]}：`,
      default: selected[field],
    });
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
    console.log(chalk.yellow("暂无配置档案。"));
    return;
  }

  const active = getActiveName();
  const selected = await select({
    message: "选择要删除的配置：",
    choices: profiles.map((p) => ({
      value: p.name,
      name: `${p.name}${p.name === active ? chalk.red(" [当前激活]") : ""}`,
    })),
  });

  if (selected === active) {
    const warned = await confirm({
      message: chalk.yellow(`"${selected}" 是当前激活的配置，删除后 Claude Code 将使用 settings.local.json 中的现有值。确认删除？`),
    });
    if (!warned) {
      console.log(chalk.yellow("已取消删除。"));
      return;
    }
  } else {
    const confirmed = await confirm({ message: `确认删除 "${selected}"？` });
    if (!confirmed) {
      console.log(chalk.yellow("已取消删除。"));
      return;
    }
  }

  try {
    removeProfile(selected);
    console.log(chalk.green(`✓ 配置档案 "${selected}" 已删除。`));
  } catch (err) {
    console.log(chalk.red((err as Error).message));
  }
}

function handleList(): void {
  const profiles = listProfiles();
  const active = getActiveName();

  if (profiles.length === 0) {
    console.log(chalk.yellow("暂无配置档案。"));
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

mainMenu().catch(console.error);
