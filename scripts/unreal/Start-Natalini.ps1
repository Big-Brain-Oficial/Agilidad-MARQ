param(
    [string]$SignallingUrl = 'ws://127.0.0.1:8888',
    [ValidateSet('equilibrado', 'calidad')][string]$Profile = 'equilibrado'
)
. (Join-Path $PSScriptRoot 'Unreal-Paths.ps1')
$engine = Get-NataliniEngine
if (!(Test-Path -LiteralPath (Join-Path $NataliniRoot 'unreal/Natalini/Content/Natalini/Maps/Natalini.umap'))) {
    throw 'Falta el nivel. Ejecutá npm run unreal:prepare y npm run unreal:import.'
}
$uri = [Uri]$SignallingUrl
if (!$uri.IsAbsoluteUri -or $uri.Scheme -notin @('ws', 'wss')) { throw 'SignallingUrl debe ser ws:// o wss://.' }
$editor = Join-Path $engine 'Engine/Binaries/Win64/UnrealEditor.exe'
$resolution = if ($Profile -eq 'calidad') { @('-ResX=1920', '-ResY=1080') } else { @('-ResX=1600', '-ResY=900') }
$scale = if ($Profile -eq 'calidad') { 100 } else { 75 }
$argsList = @("`"$NataliniProject`"", '/Game/Natalini/Maps/Natalini', '-game', '-RenderOffscreen', '-AudioMixer',
    '-ForceRes', '-Windowed', '-Unattended', "`"-PixelStreamingURL=$SignallingUrl`"",
    "`"-ExecCmds=t.MaxFPS 30,r.ScreenPercentage $scale,PixelStreaming2.Encoder.Codec H264,PixelStreaming2.WebRTC.Fps 30`"") + $resolution
$process = Start-Process -FilePath $editor -ArgumentList $argsList -WindowStyle Hidden -PassThru
Write-Host "Unreal iniciado (PID $($process.Id)). El reproductor confirmará cuándo hay video. Para detenerlo: Stop-Process -Id $($process.Id)"
Write-Host 'También debe estar encendido el servidor de señalización UE5.7. Ver docs/UNREAL-NATALINI.md.'
