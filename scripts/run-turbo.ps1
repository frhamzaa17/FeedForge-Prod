param(
  [Parameter(Mandatory = $true)]
  [string]$Task
)

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$tools = Join-Path $root '.tools'
$node = 'C:\Program Files\nodejs'
$envFile = Join-Path $root '.env'

if (Test-Path -LiteralPath $envFile) {
  foreach ($line in Get-Content -LiteralPath $envFile) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }

    $separator = $trimmed.IndexOf('=')
    if ($separator -lt 1) { continue }

    $name = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

$env:PATH = "$tools;$node;$env:PATH"

& turbo run $Task
exit $LASTEXITCODE
