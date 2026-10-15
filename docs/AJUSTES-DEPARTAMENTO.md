# Piso, tomacorrientes y circulación de los dormitorios

Rama `fix/departamento-pisos-mobiliario`, creada desde `origin/main` en `051c777`.

## Correcciones

- **Baño:** el piso de roble de circulación llegaba a `y=6,42`, aunque el piso de piedra comienza en `y=6,17`. Esos 25 cm de superficies coplanares producían franjas al mover la cámara. Ahora los paños se encuentran sin superponerse. Se ajustan también los umbrales que duplicaban piso de circulación; se conserva la cobertura del solado.
- **Tomacorrientes:** el del pasillo de dormitorios estaba en `x=3,575` cuando su pared está en `x=2,76`; el de la zona del baño estaba fuera del tramo de pared. Los tres se posicionan sobre la cara de su tabique, calculando el apoyo a partir de su ubicación, giro y espesor.
- **Camas:** la matrimonial pasa de 1,55 × 2,00 m a 1,40 × 1,90 m; la individual, de 1,00 × 1,90 m a 0,90 × 1,90 m. Ambas se acercan a la pared de la cabecera. El paso al pie de las bases aumenta de 38 y 26 cm a 69 cm. Las colisiones se generan con las mismas dimensiones que las bases.

Se conservan las medidas del plano, los tabiques y las puertas. Las medidas del mobiliario son decisiones de ambientación del modelo interpretativo.

## Verificación

La comprobación de geometría se ejecuta sobre la escena reconstruida en memoria:

```powershell
& $env:BLENDER_PATH --background --factory-startup modelos/Torre_Natalini/Torre_Natalini_Interpretativa.blend --python-exit-code 1 --python scripts/blender/rebuild_archviz.py --python scripts/blender/verify_apartment.py
```

Verifica que los solados no se superpongan y conserven la cobertura, que los tomacorrientes estén apoyados en sus paredes y que el paso al pie de las camas sea de al menos 65 cm. El informe queda en `.cache/models/apartment-verification.json`.

Después de `npm run model:build`, `npm run typecheck` y `npm run build`, servir el resultado:

```powershell
node node_modules/next/dist/bin/next start -p 3100
```

En otra terminal:

```powershell
node scripts/verify-apartment.mjs
node scripts/verify-performance.mjs
```

La prueba del departamento usa la API de depuración para ubicar al visitante y luego cruza a pie el frente y el lateral de ambas camas con las colisiones reales. También cruza el umbral del baño en ambos sentidos y captura los sectores corregidos. Con el GLB anterior reproduce el bloqueo frente a la cama principal. El informe y las capturas quedan en `.cache/apartment/verification/`. La prueba de rendimiento comprueba además el inicio y la pausa sin `?debug`.

Resultado local: geometría, `model:build`, tipos, build y ambas pruebas de Chrome aprobados. Se revisaron las capturas del piso, las camas y los tomacorrientes. Los hashes SHA-256 de los dos `.blend` permanecieron iguales y no se generó ningún `.blend1`. El modelo publicado por el pipeline es `torre-natalini.8725103013.glb` (31.751.400 bytes).
