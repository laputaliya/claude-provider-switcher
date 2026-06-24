$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-Command($Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host "正在检测 Claude Code..."
if (Test-Command "claude") {
  $ClaudeVersion = try { claude --version 2>$null } catch { "ok" }
  if (-not $ClaudeVersion) {
    $ClaudeVersion = "ok"
  }
  Write-Host "✓ Claude Code 已安装 ($ClaudeVersion)"
} else {
  Write-Host "未检测到 Claude Code，正在安装..."
  if (Test-Command "npm") {
    npm install -g @anthropic-ai/claude-code
  } else {
    Write-Host "错误：未找到 npm，请先安装 Node.js"
    exit 1
  }

  if (Test-Command "claude") {
    Write-Host "✓ Claude Code 安装成功"
  } else {
    Write-Host "错误：Claude Code 安装失败，请手动安装后重试"
    exit 1
  }
}

Write-Host "正在安装依赖..."
Set-Location $ScriptDir

if (-not (Test-Command "pnpm")) {
  Write-Host "未检测到 pnpm，正在安装..."
  if (Test-Command "npm") {
    npm install -g pnpm
  } elseif (Test-Command "corepack") {
    corepack enable
    corepack prepare pnpm@latest --activate
  } else {
    Write-Host "错误：未找到 npm 或 corepack，请先安装 Node.js"
    exit 1
  }
}

pnpm install --frozen-lockfile

Write-Host "正在编译..."
pnpm build

Write-Host "正在注册 ccs 全局命令..."
npm link

Write-Host "✓ 已安装 ccs 命令"
Write-Host "  直接运行 ccs 即可使用"
