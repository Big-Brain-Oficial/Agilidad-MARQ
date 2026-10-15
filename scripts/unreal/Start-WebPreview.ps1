param([ValidateRange(1024,65535)][int]$Port = 3114)
. (Join-Path $PSScriptRoot 'Unreal-Paths.ps1')
$address = "http://127.0.0.1:$Port/evaluacion/natalini"
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $address -TimeoutSec 3
        if ($response.StatusCode -eq 200 -and $response.Content.Contains('Una torre. Dos experiencias.')) { Write-Host "La página ya está disponible: $address"; exit 0 }
    } catch { }
    throw "El puerto $Port está ocupado pero la página no responde. Reiniciá ese servidor o elegí otro puerto con -Port."
}
if (!(Test-Path -LiteralPath (Join-Path $NataliniRoot '.next/BUILD_ID'))) { throw 'Primero ejecutá npm run build.' }
$logs = Join-Path $NataliniRoot '.cache/unreal'
[IO.Directory]::CreateDirectory($logs) | Out-Null
$node = (Get-Command node -ErrorAction Stop).Source
$next = Join-Path $NataliniRoot 'node_modules/next/dist/bin/next'
$process = Start-Process -FilePath $node -ArgumentList @("`"$next`"", 'start', '--hostname', '127.0.0.1', '--port', "$Port") -WorkingDirectory $NataliniRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'web.stdout.log') -RedirectStandardError (Join-Path $logs 'web.stderr.log')
$deadline = [DateTime]::UtcNow.AddSeconds(30)
while ([DateTime]::UtcNow -lt $deadline) {
    if ($process.HasExited) { throw "La página no pudo arrancar. Revisá $logs/web.stderr.log." }
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $address -TimeoutSec 2
        if ($response.StatusCode -eq 200 -and $response.Content.Contains('Una torre. Dos experiencias.')) {
            Write-Host "Página disponible: $address"
            Write-Host "Unreal: http://127.0.0.1:$Port/recorrido/torre-natalini/unreal"
            Write-Host "Para detenerla: Stop-Process -Id $($process.Id)"
            exit 0
        }
    } catch { }
    Start-Sleep -Milliseconds 300
}
throw "El proceso arrancó pero la página no respondió. Revisá $logs/web.stderr.log. PID: $($process.Id)"
