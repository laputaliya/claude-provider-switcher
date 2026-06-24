# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目用途

Claude Code 大模型供应商切换工具（CLI 命令 `ccs`，包名 `claude-provider-switcher`）。预先配置多个供应商预设（百炼、火山等），一键切换，避免手动编辑 `~/.claude/settings.json`。

## 常用命令

```bash
pnpm build                                             # 编译（输出到 dist/）
pnpm dev                                               # 监听模式编译
pnpm start                                             # 运行
node dist/index.js                                     # 直接运行编译产物
./install.sh                                           # 安装全局命令（macOS/Linux）
./uninstall.sh                                         # 卸载全局命令（macOS/Linux）
powershell -ExecutionPolicy Bypass -File .\install.ps1   # 安装全局命令（Windows）
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1 # 卸载全局命令（Windows）
```

## 架构

```
src/
├── types.ts      # Profile、ProfilesConfig、ProviderPreset 类型定义 + BUILT_IN_PRESETS 内置供应商
├── config.ts     # 供应商档案的 CRUD，读写 ~/.claude-switcher/profiles.json
├── switcher.ts   # 切换逻辑：修改 ~/.claude/settings.json 的 env.ANTHROPIC_AUTH_TOKEN/BASE_URL/MODEL
└── index.ts      # CLI 入口，交互式主菜单（@inquirer/prompts），支持 ESC/返回选项
```

- **配置存储**：`~/.claude-switcher/profiles.json`，包含 `profiles[]` 和 `active` 字段
- **切换目标**：修改 `~/.claude/settings.json` 的 `env` 字段（ANTHROPIC_AUTH_TOKEN、ANTHROPIC_BASE_URL、ANTHROPIC_MODEL）
- **备份**：切换前自动备份 `settings.json` 到 `~/.claude-switcher/backup.json`
- **OpenCode 配置**：遵循跨平台配置目录，优先 `XDG_CONFIG_HOME`，Windows 使用 `%APPDATA%\opencode`，其他平台默认 `~/.config/opencode`
- **附加功能**：跳过首次登录引导（`~/.claude.json` 的 `hasCompletedOnboarding`）、AI 署名设置（`settings.json` 的 `attribution`）

## 关键设计决策

- **API Key 明文输入**：添加/编辑供应商时 API Key 使用 `input` 而非 `password`，方便确认输入正确
- **ESC 返回**：通过 stdin keypress 监听 ESC 键调用 prompt.cancel()，所有交互层均可逐级返回
- **供应商预设**：`types.ts` 的 `BUILT_IN_PRESETS` 维护内置供应商列表，选预设只需输入 API Key

## 语言规范

本项目面向中文开发者。UI 文本、注释、文档使用中文，代码标识符（变量名、函数名）使用英文。
