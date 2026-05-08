#!/usr/bin/env bash
set -e

LINK="/usr/local/bin/ccs"

if [ -L "$LINK" ] || [ -e "$LINK" ]; then
  sudo rm -f "$LINK"
  echo "✓ 已卸载 ccs 命令"
else
  echo "ccs 命令不存在，无需卸载"
fi
