. (Join-Path $PSScriptRoot 'Unreal-Paths.ps1')
$lock = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'streaming.lock.json') | ConvertFrom-Json
$infrastructure = Join-Path $NataliniRoot '.cache/PixelStreamingInfrastructure'
if (!(Test-Path -LiteralPath $infrastructure)) {
    & git clone --depth 1 --branch $lock.branch $lock.repository $infrastructure
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo descargar la infraestructura de Epic.' }
}
$revision = & git -C $infrastructure rev-parse HEAD
if ($revision -ne $lock.commit) {
    $changes = & git -C $infrastructure status --porcelain
    if ($changes) { throw 'Hay cambios locales en la infraestructura de Epic. Conservá esos cambios antes de actualizarla.' }
    & git -C $infrastructure fetch --depth 1 origin $lock.commit
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo descargar la revisión fijada.' }
    & git -C $infrastructure checkout --detach $lock.commit
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo seleccionar la revisión fijada.' }
}
Push-Location $infrastructure
try {
    & npm.cmd ci --ignore-scripts --workspace Common --workspace Signalling --workspace SignallingWebServer --workspace Frontend/library --workspace Frontend/ui-library --workspace Frontend/implementations/typescript --include-workspace-root
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias de Epic.' }
    & npm.cmd run build:all:cjs
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar el reproductor y el servidor de Epic.' }
} finally { Pop-Location }
$envFile = Join-Path $NataliniRoot '.env.local'
$text = if (Test-Path -LiteralPath $envFile) { [IO.File]::ReadAllText($envFile) } else { '' }
if ($text -notmatch '(?m)^\s*MARQ_UNREAL_PLAYER_URL\s*=') {
    [IO.File]::AppendAllText($envFile, "`nMARQ_UNREAL_PLAYER_URL=http://localhost:8080/player.html`n", [Text.UTF8Encoding]::new($false))
}
Write-Host 'Conexión preparada. Reiniciá Next y ejecutá npm run unreal:server, seguido de npm run unreal:stream.'
