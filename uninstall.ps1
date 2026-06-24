$ErrorActionPreference = "Stop"

function Test-Command($Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

if (Test-Command "ccs") {
  Write-Host "正在卸载 ccs 命令..."
  npm unlink -g claude-provider-switcher

  if (Test-Command "ccs") {
    Write-Host "提示：ccs 命令仍然存在，可能由其他安装方式提供，请手动检查。"
  } else {
    Write-Host "✓ 已卸载 ccs 命令"
  }
} else {
  Write-Host "ccs 命令不存在，无需卸载"
}
