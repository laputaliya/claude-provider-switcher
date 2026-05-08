# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目用途

Claude Code 大模型提供商配置切换工具（CLI 命令 `ccs`）。预先配置多个提供商档案（百炼、火山等），一键切换，避免手动编辑 `~/.claude/settings.local.json`。

## 常用命令

```bash
pnpm build          # 编译（输出到 dist/）
pnpm dev            # 监听模式编译
pnpm start          # 运行
node dist/index.js  # 直接运行编译产物
```

## 架构

```
src/
├── types.ts      # Profile、ProfilesConfig 类型定义
├── config.ts     # 配置档案的 CRUD，读写 ~/.claude-switcher/profiles.json
├── switcher.ts   # 切换逻辑，读写 ~/.claude/settings.local.json，备份到 backup.json
└── index.ts      # CLI 入口，交互式主菜单（@inquirer/prompts）
```

- **配置存储**：`~/.claude-switcher/profiles.json`，包含 `profiles[]` 和 `active` 字段
- **切换目标**：修改 `~/.claude/settings.local.json` 的 `apiKey`、`apiBaseUrl`、`model` 三个字段
- **备份**：切换前自动备份当前配置到 `~/.claude-switcher/backup.json`

## 语言规范

本项目面向中文开发者。UI 文本、注释、文档使用中文，代码标识符（变量名、函数名）使用英文。
