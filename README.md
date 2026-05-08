# Claude Code 平台切换工具

一个交互式 CLI 工具，用于快速切换 Claude Code 的大模型提供商配置。预先配置多个提供商档案（阿里百炼、字节火山引擎等），一键切换，告别手动编辑配置文件。

## 功能

- **切换配置** — 选择已配置的档案，一键切换 Claude Code 的 API 提供商
- **添加配置** — 交互式输入档案名、API Key、Base URL、模型名称
- **编辑配置** — 修改已有档案的任意字段
- **删除配置** — 删除不需要的档案（当前激活档案会额外警告）
- **列出配置** — 查看所有档案及当前激活状态

## 安装

```bash
# 克隆项目
git clone <repo-url>
cd claude-platform-swither

# 安装依赖
pnpm install

# 编译
pnpm build

# 全局安装（可选，安装后可在任意目录使用 ccs 命令）
pnpm link --global
```

## 使用

```bash
# 直接运行
pnpm start

# 或使用全局命令（需先 pnpm link --global）
ccs
```

运行后进入交互式主菜单：

```
? 请选择操作：
❯ 🔄 切换配置
  ➕ 添加配置
  ✏️  编辑配置
  🗑️  删除配置
  📋 列出配置
  🚪 退出
```

### 切换配置示例

1. 选择「切换配置」
2. 从列表中选择目标提供商
3. 确认切换
4. 重启 Claude Code 使配置生效

### 添加配置示例

1. 选择「添加配置」
2. 依次输入：
   - 档案名（如 `bailian`、`volcano`）
   - API Key（输入时隐藏）
   - API Base URL
   - 模型名称

## 配置文件

| 文件 | 用途 |
|------|------|
| `~/.claude-switcher/profiles.json` | 存储所有配置档案及当前激活状态 |
| `~/.claude-switcher/backup.json` | 切换前的自动备份 |
| `~/.claude/settings.local.json` | Claude Code 的配置文件（切换目标） |

切换时会修改 `settings.local.json` 中的以下字段：

- `apiKey` — API 密钥
- `apiBaseUrl` — API 基础地址
- `model` — 模型名称

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
