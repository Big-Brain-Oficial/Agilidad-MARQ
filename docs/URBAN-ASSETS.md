# Árboles y horizonte de Natalini

Imágenes originales generadas con la herramienta integrada ImageGen el 15 de octubre de 2026. El fondo es una interpretación de una ciudad del nordeste argentino, no una fotografía ni un relevamiento de Resistencia.

Archivos finales: `public/archviz/urban/foliage.webp` (768 × 768, canal alfa) y `public/archviz/urban/city-panorama.webp` (2048 px de ancho). Conversión a WebP con Sharp, calidad 82; alfa del follaje conservado a calidad 100. No se necesitan servicios externos durante el recorrido.

## Prompt de follaje

Use case: photorealistic-natural. Asset type: transparent foliage texture for low-poly 3D tree canopy cards in an architectural web walkthrough. Create one irregular natural cluster of many small mature green broad leaves on thin branching twigs, like an urban subtropical shade tree in northeastern Argentina. Front-facing botanical photographic cutout, about 60 small leaves forming an airy roughly oval branch cluster, natural gaps and negative space between leaves, several shades of muted olive green, realistic leaf veins and edges, soft neutral diffuse daylight without hard baked shadows. Cluster fills 85 percent of a square frame, all leaves fully inside frame. Genuine transparent background, including holes between leaves. No pot, no soil, no full tree trunk, no sky, no border, no text, no watermark, no cartoon, no solid green mass. This will be repeated on small planes distributed through a volumetric tree crown; give individually readable leaves and a natural broken silhouette.

## Prompt de ciudad

Use case: photorealistic-natural. Asset type: wide panoramic distant city backdrop texture for an architectural 3D walkthrough. Create a photorealistic horizontally continuous city horizon inspired by Resistencia, Chaco, Argentina, illustrative rather than an exact real location. Wide 3:1 panoramic image, level camera from about 30 metres above ground, distant flat subtropical city extending to infinity. Lower 40 percent shows dense ordinary low-rise buildings, pale concrete rooftops, leafy green treetops and a few scattered slender residential mid-rise towers, upper 60 percent is pale blue daylight sky with soft sparse white clouds and atmospheric haze toward the horizon. No mountains, no ocean, no landmarks, no close foreground building, no dramatic skyscraper skyline, no roads converging at the camera. Soft afternoon-neutral daylight compatible with a realistic architectural scene, muted natural colors and distant detail. Edges should match in overall brightness, skyline height and sky color for a wraparound background. No sun disk, no text, no watermark, no frame.

## Comprobación

`scripts/verify-nature.mjs` recorre calle y balcón en ambas calidades, inspecciona cuatro direcciones del fondo y el modo tarde, y guarda capturas y métricas en `.cache/nature-qa`. Usar `NATURE_QA_LABEL=before` o `after` para conservar comparaciones, y `ARCHVIZ_TEST_URL` para elegir un servidor local de producción. Los FPS son mediciones locales a 1440 × 900 con DPR 1, no predicciones universales.

### Resultado local del 15 de octubre de 2026

Chrome sin interfaz, ANGLE/Direct3D 11 sobre NVIDIA GeForce GTX 1050. Cada muestra reúne 180 cuadros después de estabilizar la vista. Las llamadas y triángulos incluyen los pases de postproceso.

| Vista / calidad | FPS antes → después | p95 de cuadro después | Llamadas de dibujo antes → después | Triángulos antes → después |
|---|---|---|---|---|
| Calle / alta | 60 → 60 | 16,8 ms | 75 → 76 | 46.336 → 41.854 |
| Balcón / alta | 60 → 60 | 16,8 ms | 88 → 89 | 487.957 → 481.937 |
| Calle / fluida | 60 → 60 | 16,8 ms | 37 → 39 | 23.221 → 21.813 |
| Balcón / fluida | 60 → 60 | 16,8 ms | 57 → 59 | 325.303 → 322.357 |

Sin errores de navegador ni respuestas HTTP fallidas. La descarga adicional es de 378.132 bytes. No se midieron dispositivos móviles, gráficas integradas ni redes lentas. Mantener 60 FPS con sincronización vertical no cuantifica el margen de GPU disponible; el dato verifica estas vistas en este equipo.
