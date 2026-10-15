$ErrorActionPreference = 'Stop'
$NataliniRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$NataliniProject = Join-Path $NataliniRoot 'unreal/Natalini/Natalini.uproject'

function Get-NataliniEngine {
    $candidates = @($env:UE_ROOT, 'C:/Program Files/Epic Games/UE_5.7')
    $registry = Get-ItemProperty 'HKLM:/SOFTWARE/EpicGames/Unreal Engine/5.7' -ErrorAction SilentlyContinue
    if ($registry) { $candidates += $registry.InstalledDirectory }
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'Engine/Binaries/Win64/UnrealEditor.exe'))) {
            $version = Get-Content -Raw -LiteralPath (Join-Path $candidate 'Engine/Build/Build.version') | ConvertFrom-Json
            if ($version.MajorVersion -ne 5 -or $version.MinorVersion -ne 7) {
                throw 'Este prototipo requiere Unreal 5.7 y la infraestructura Pixel Streaming UE5.7.'
            }
            return $candidate
        }
    }
    throw 'No se encontró Unreal 5.7. Instalalo con Epic Games Launcher o indicá su carpeta con $env:UE_ROOT.'
}
