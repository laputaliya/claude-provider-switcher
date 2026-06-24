$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-Command($Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host "Checking Claude Code..."
if (Test-Command "claude") {
  $ClaudeVersion = try { claude --version 2>$null } catch { "ok" }
  if (-not $ClaudeVersion) {
    $ClaudeVersion = "ok"
  }
  Write-Host "Claude Code is installed ($ClaudeVersion)"
} else {
  Write-Host "Claude Code was not found. Installing..."
  if (Test-Command "npm") {
    npm install -g @anthropic-ai/claude-code
  } else {
    Write-Host "Error: npm was not found. Please install Node.js first."
    exit 1
  }

  if (Test-Command "claude") {
    Write-Host "Claude Code installed successfully"
  } else {
    Write-Host "Error: Claude Code installation failed. Please install it manually and retry."
    exit 1
  }
}

Write-Host "Installing dependencies..."
Set-Location $ScriptDir

if (-not (Test-Command "pnpm")) {
  Write-Host "pnpm was not found. Installing..."
  if (Test-Command "npm") {
    npm install -g pnpm
  } elseif (Test-Command "corepack") {
    corepack enable
    corepack prepare pnpm@latest --activate
  } else {
    Write-Host "Error: npm or corepack was not found. Please install Node.js first."
    exit 1
  }
}

pnpm install --frozen-lockfile

Write-Host "Building..."
pnpm build

Write-Host "Registering global ccs command..."
npm link

Write-Host "ccs command installed successfully"
Write-Host "Run ccs to start"
