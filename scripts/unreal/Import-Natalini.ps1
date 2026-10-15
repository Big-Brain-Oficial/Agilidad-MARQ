param([switch]$Replace)
. (Join-Path $PSScriptRoot 'Unreal-Paths.ps1')
$engine = Get-NataliniEngine
$source = Join-Path $NataliniRoot '.cache/unreal/source.json'
if (!(Test-Path -LiteralPath $source)) { throw 'Primero ejecutá npm run unreal:prepare.' }
$editor = Join-Path $engine 'Engine/Binaries/Win64/UnrealEditor-Cmd.exe'
$script = Join-Path $NataliniRoot 'unreal/Natalini/Content/Python/build_natalini.py'
$run = [Guid]::NewGuid().ToString()
$previousRun = $env:MARQ_UNREAL_IMPORT_RUN
$previousReplace = $env:MARQ_UNREAL_REPLACE
try {
    $env:MARQ_UNREAL_IMPORT_RUN = $run
    $env:MARQ_UNREAL_REPLACE = if ($Replace) { '1' } else { '0' }
    & $editor $NataliniProject '-run=pythonscript' "-script=$script" '-unattended' '-nop4' '-stdout' '-FullStdOutLogOutput'
    if ($LASTEXITCODE -ne 0) { throw "Unreal terminó con código $LASTEXITCODE. Revisá unreal/Natalini/Saved/Logs." }
    $report = Join-Path $NataliniRoot '.cache/unreal/import-result.json'
    if (!(Test-Path -LiteralPath $report) -or (Get-Content -Raw -LiteralPath $report | ConvertFrom-Json).run -ne $run) {
        throw 'Unreal no confirmó la creación del nivel. Revisá el log; no se considera importado.'
    }
    Write-Host 'Nivel creado. Abrí unreal/Natalini/Natalini.uproject y presioná Play para evaluarlo.'
} finally {
    $env:MARQ_UNREAL_IMPORT_RUN = $previousRun
    $env:MARQ_UNREAL_REPLACE = $previousReplace
}
