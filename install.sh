#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$SCRIPT_DIR/dist/index.js"
LINK_DIR="/usr/local/bin"
LINK="$LINK_DIR/ccs"

echo "正在检测 Claude Code..."
if command -v claude &>/dev/null; then
  echo "✓ Claude Code 已安装 ($(claude --version 2>/dev/null || echo 'ok'))"
else
  echo "未检测到 Claude Code，正在安装..."
  if command -v npm &>/dev/null; then
    npm install -g @anthropic-ai/claude-code
  else
    echo "错误：未找到 npm，请先安装 Node.js"
    exit 1
  fi
  if command -v claude &>/dev/null; then
    echo "✓ Claude Code 安装成功"
  else
    echo "错误：Claude Code 安装失败，请手动安装后重试"
    exit 1
  fi
fi

echo "正在安装依赖..."
cd "$SCRIPT_DIR"

if ! command -v pnpm &>/dev/null; then
  echo "未检测到 pnpm，正在安装..."
  if command -v npm &>/dev/null; then
    npm install -g pnpm
  elif command -v corepack &>/dev/null; then
    corepack enable && corepack prepare pnpm@latest --activate
  else
    echo "错误：未找到 npm 或 corepack，请先安装 Node.js"
    exit 1
  fi
fi

pnpm install --frozen-lockfile

echo "正在编译..."
pnpm build

if [ -L "$LINK" ] || [ -e "$LINK" ]; then
  echo "检测到已存在的 ccs，正在移除旧链接..."
  sudo rm -f "$LINK"
fi

sudo ln -s "$TARGET" "$LINK"
echo "✓ 已安装 ccs 命令 → $TARGET"
echo "  直接运行 ccs 即可使用"
