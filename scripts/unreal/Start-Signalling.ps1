param([ValidateRange(1024,65535)][int]$PlayerPort = 8080)
. (Join-Path $PSScriptRoot 'Unreal-Paths.ps1')
$infrastructure = Join-Path $NataliniRoot '.cache/PixelStreamingInfrastructure'
$server = Join-Path $infrastructure 'SignallingWebServer/dist/index.js'
$frontend = Join-Path $infrastructure 'SignallingWebServer/www'
if (!(Test-Path -LiteralPath $server) -or !(Test-Path -LiteralPath (Join-Path $frontend 'player.html'))) {
    throw 'Falta compilar la infraestructura. Ejecutá npm run unreal:setup-streaming.'
}
foreach ($port in @($PlayerPort, 8888)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        throw "El puerto $port está ocupado. Si ya iniciaste el servidor, podés ejecutar unreal:stream directamente."
    }
}
$logs = Join-Path $NataliniRoot '.cache/unreal'
[IO.Directory]::CreateDirectory($logs) | Out-Null
$configFile = Join-Path $logs 'signalling.json'
$config = @{
    serve = $true; player_port = "$PlayerPort"; streamer_port = '8888'; sfu_port = '8889'
    http_root = $frontend; homepage = 'player.html'; https = $false; https_redirect = $false
    max_players = '1'; log_folder = $logs; log_level_console = 'info'; log_level_file = 'info'
}
[IO.File]::WriteAllText($configFile, ($config | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
$node = (Get-Command node -ErrorAction Stop).Source
$process = Start-Process -FilePath $node -ArgumentList @("`"$server`"", '--config_file', "`"$configFile`"") -WorkingDirectory $infrastructure -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'signalling.stdout.log') -RedirectStandardError (Join-Path $logs 'signalling.stderr.log')
Write-Host "Servidor iniciado (PID $($process.Id)). Reproductor: http://localhost:$PlayerPort/player.html"
Write-Host "Para detenerlo: Stop-Process -Id $($process.Id)"
