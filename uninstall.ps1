$ErrorActionPreference = "Stop"

function Test-Command($Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

if (Test-Command "ccs") {
  Write-Host "Uninstalling ccs command..."
  npm unlink -g claude-provider-switcher

  if (Test-Command "ccs") {
    Write-Host "Note: ccs command still exists. It may be provided by another installation. Please check it manually."
  } else {
    Write-Host "ccs command uninstalled successfully"
  }
} else {
  Write-Host "ccs command does not exist. Nothing to uninstall."
}
