#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$SCRIPT_DIR/dist/index.js"
LINK_DIR="/usr/local/bin"
LINK="$LINK_DIR/ccs"

if [ ! -f "$TARGET" ]; then
  echo "错误：未找到编译产物 $TARGET"
  echo "请先运行 pnpm build"
  exit 1
fi

if [ -L "$LINK" ] || [ -e "$LINK" ]; then
  echo "检测到已存在的 ccs，正在移除旧链接..."
  sudo rm -f "$LINK"
fi

sudo ln -s "$TARGET" "$LINK"
echo "✓ 已安装 ccs 命令 → $TARGET"
echo "  直接运行 ccs 即可使用"
