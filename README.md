# Claude Code 大模型供应商切换工具

一个交互式 CLI 工具，用于快速切换 Claude Code 的大模型供应商。内置 10 个常用供应商预设（阿里百炼、字节火山引擎、硅基流动、DeepSeek、OpenRouter 等），一键切换，告别手动编辑配置文件。

## 功能

- **切换供应商** — 选择已配置的供应商，一键切换 Claude Code 的 API 提供商
- **添加供应商** — 从内置供应商预设中选择，只需录入 API Key；或选择自定义后输入全部信息
- **编辑供应商** — 修改已有供应商的 API Key（明文显示，防止输错）、Base URL、模型名称
- **删除供应商** — 删除不需要的供应商（当前激活的会额外警告）
- **列出供应商** — 查看所有供应商及当前激活状态
- **跳过首次登录引导** — 设置 `hasCompletedOnboarding`，跳过 Claude Code 启动时的登录引导流程
- **AI 署名设置** — 开启/关闭 Claude Code 在 git 提交和 PR 中的 AI 署名

## 安装

```bash
# 克隆项目
git clone <repo-url>
cd claude-provider-switcher

# 安装全局命令
./install.sh
```

## 卸载

```bash
./uninstall.sh
```

## 使用

```bash
# 直接运行
pnpm start

# 或使用全局命令（需先安装）
ccs
```

运行后进入交互式主菜单，按 ESC 或 Ctrl+C 可返回上级：

```
? 请选择操作：
❯ 🔄  切换供应商
  ➕  添加供应商
  ✏️  编辑供应商
  🗑️  删除供应商
  📋  列出供应商
  🚀  跳过首次登录引导
  ✍️  AI 署名设置
  🚪  退出
```

### 内置供应商

| 供应商 | 预设名 |
|--------|--------|
| 阿里百炼（Token Plan） | `bailian-token` |
| 阿里百炼（Coding Plan） | `bailian-coding` |
| 阿里百炼（基础版） | `bailian` |
| 字节火山引擎（Agent Plan） | `volcano-agent` |
| 字节火山引擎（Coding Plan） | `volcano-coding` |
| 字节火山引擎（基础版） | `volcano` |
| 硅基流动 | `siliconflow` |
| 硅基流动（国际站） | `siliconflow-en` |
| 腾讯云（Coding Plan） | `tencent-coding` |
| 腾讯云（Token Plan 个人版） | `tencent-token` |
| 腾讯云（Token Plan 企业版） | `tencent-token-enterprise` |
| MiniMax（国内站） | `minimax` |
| MiniMax（国际站） | `minimax-en` |
| 月之暗面（Kimi Code Plan） | `moonshot-code` |
| 月之暗面（开放平台） | `moonshot` |
| 智谱 | `zhipu` |
| DeepSeek | `deepseek` |
| OpenRouter | `openrouter` |

### 添加供应商示例

1. 选择「添加供应商」
2. 从内置列表中选择供应商，或选择「自定义」
3. 内置供应商：只需输入 API Key（明文显示），模型名称可按回车使用默认值
4. 自定义：依次输入供应商名、API Key、API Base URL、模型名称

## 配置文件

| 文件 | 用途 |
|------|------|
| `~/.claude-switcher/profiles.json` | 存储所有供应商配置及当前激活状态 |
| `~/.claude-switcher/backup.json` | 切换前的自动备份 |
| `~/.claude/settings.json` | Claude Code 配置（切换目标，写 `env` 字段） |
| `~/.claude.json` | Claude Code 全局配置（引导跳过等） |

切换时修改 `settings.json` 中 `env` 的以下环境变量：

- `ANTHROPIC_AUTH_TOKEN` — API 密钥
- `ANTHROPIC_BASE_URL` — API 基础地址
- `ANTHROPIC_MODEL` — 模型名称

## 技术栈

- Node.js + TypeScript
- [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js) — 交互式 UI
- [chalk](https://github.com/chalk/chalk) — 彩色输出
- [tsup](https://github.com/egoist/tsup) — 构建

## 开发

```bash
pnpm build    # 编译
pnpm dev      # 监听模式编译
pnpm start    # 运行
```

## License

MIT
