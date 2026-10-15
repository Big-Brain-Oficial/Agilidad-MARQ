# Revisión de las issues #9 y #10

Revisión del 15 de octubre de 2026, sobre `1f6ca8e`. Los cuatro pendientes seguían presentes en ese checkout. El estado remoto de las issues no se pudo consultar; esta revisión contrasta el texto de las issues con el código local.

## Cambios

- `rebuild_archviz.py` reconstruye en memoria y deja que `export_web.py` exporte esa escena. Ya no guarda ni empaqueta `Torre_Natalini_ArchViz.blend`. El informe generado pasa a `.cache/models/archviz-verification.json`; el informe versionado conserva su valor histórico.
- Se elimina el respaldo automático `.blend1` y se ignoran futuros respaldos de ese tipo.
- El recorrido usa `hdri-1k.hdr` (1.545.499 bytes), frente a los 6.155.760 bytes del HDR 2K que sigue usando Blender. Ahorro por carga sin caché: 4.610.261 bytes, aproximadamente 75 %. `archviz:assets` puede recuperar ambas variantes y `sources.json` registra origen, licencia y SHA-256.
- Se eliminan `brown_photostudio_02/hdri.hdr` (6.492.863 bytes) y `torre-natalini.0156ebf42d.glb` (20.462.516 bytes). No tienen referencias actuales; el GLB no aparece en el historial local de `modelos.generated.json`. Los demás GLB publicados se conservan.
- Se consulta el renderer del contexto real antes de montar la escena. Basic Render Driver y SwiftShader (también llvmpipe, softpipe y Software Rasterizer) arrancan en «Fluida» y muestran el aviso en inicio y pausa. Una extensión ausente o bloqueada por privacidad no se interpreta como renderizado por software.
- «Fluida» desactiva ahora las sombras, además del SSAO que ya desactivaba, y mantiene DPR 1. El usuario conserva la posibilidad de elegir «Alta» manualmente.

La eliminación de archivos reduce el checkout; no elimina los binarios de commits anteriores.

## Verificación reproducible

```powershell
npm run typecheck
npm run build
node node_modules/next/dist/bin/next start -p 3100
```

En otra terminal, con Chrome instalado:

```powershell
node scripts/verify-performance.mjs --software
node scripts/verify-performance.mjs
```

El script comprueba los nombres de renderers y el caso de extensión no disponible. En Chrome real, sin `?debug`, verifica la calidad inicial, el aviso, la textura descargada, el clic de inicio, la captura del mouse y la pausa. Para software verifica además DPR 1 y que no se compilen shaders de sombras ni SSAO. Espera a que el HUD confirme el inicio antes de liberar el puntero; en Chrome headless usa `exitPointerLock()` si Escape no ejecuta su acción nativa. Los resultados y capturas quedan en `.cache/performance/`.

## Verificación pendiente en equipos de destino

En este entorno pasaron TypeScript, el build de producción, la revisión de sintaxis Python y las dos ejecuciones de Chrome headless: NVIDIA GeForce GTX 750 Ti por Direct3D11 y SwiftShader forzado. Ambas completaron inicio y pausa sin errores de página. No se ejecutó `model:build`: Blender no estaba disponible. Las pruebas de Chrome no sustituyen una medición de PMREM en la GPU integrada ni una prueba en macOS.

1. Windows con GPU integrada y macOS: confirmar la placa real en `chrome://gpu` → `GL_RENDERER`. No usar SwiftShader ni Basic Render Driver para medir el rendimiento de hardware.
2. Con build de producción, sin `?debug` y caché desactivada, grabar Performance al entrar al recorrido. Repetir al menos tres cargas y registrar GPU, navegador, calidad, tareas largas y duración de la generación del PMREM dentro de la preparación de la escena.
3. Comparar reflejos en metales, lacas y vidrios, entrada, pausa, cambio Alta/Fluida y viaje en ascensor. Si PMREM todavía bloquea alrededor de un segundo o más, evaluar por separado desactivarlo en «Fluida» y su impacto visual. Esta revisión conserva el entorno en ambas calidades.
4. Con Blender instalado, registrar el hash del `.blend`, ejecutar `npm run model:build`, volver a comparar el hash y revisar `git status`. No deberían aparecer cambios en `.blend`, `.blend1` ni en el informe versionado; sí puede actualizarse el GLB y su manifiesto.

La afirmación de la issue de que PMREM siempre genera caras de 256 px requiere un matiz: el código instalado de Three.js r186 (`PMREMGenerator._fromTexture`) calcula el tamaño a partir de `texture.image.width / 4`. El HDR 1K produce caras de 256 px; el anterior 2K producía 512 px. La documentación recomienda entrada equirectangular 1024 × 512: [PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html).
