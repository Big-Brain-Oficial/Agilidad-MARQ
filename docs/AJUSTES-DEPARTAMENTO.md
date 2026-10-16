# Correcciones y ambientación del departamento

Rama `fix/departamento-pisos-mobiliario`, creada desde `origin/main` en `051c777`.

## Correcciones

- **Baño:** el piso de roble de circulación llegaba a `y=6,42`, aunque el piso de piedra comienza en `y=6,17`. Esos 25 cm de superficies coplanares producían franjas al mover la cámara. Ahora los paños se encuentran sin superponerse. Se ajustan también los umbrales que duplicaban piso de circulación; se conserva la cobertura del solado.
- **Tomacorrientes:** el del pasillo de dormitorios estaba en `x=3,575` cuando su pared está en `x=2,76`; el de la zona del baño estaba fuera del tramo de pared. Los tres se posicionan sobre la cara de su tabique, calculando el apoyo a partir de su ubicación, giro y espesor.
- **Camas:** la matrimonial pasa de 1,55 × 2,00 m a 1,40 × 1,90 m; la individual, de 1,00 × 1,90 m a 0,90 × 1,90 m. Ambas se acercan a la pared de la cabecera. El paso al pie de las bases aumenta de 38 y 26 cm a 69 cm. Las colisiones se generan con las mismas dimensiones que las bases.

Se conservan las medidas interiores de los ambientes. Las medidas del mobiliario y su ambientación son decisiones del modelo interpretativo.

## Entrada, encuentro de paredes y estar

- **Puerta de entrada:** hoja de 86 cm, laqueada con molduras y manijas a ambos lados. Abre hacia adentro, sobre la bisagra del lado del dormitorio. Al apuntarla de cerca, E/clic abre o cierra; en iPhone/iPad se usa el botón de interacción. El ancla y las medidas salen de Blender; la hoja se construye en la web con dos mallas y materiales existentes.
- **Colisiones:** la hoja cerrada impide atravesar el vano y su colisión gira al abrir. El movimiento espera si el visitante ocupa el barrido y continúa cuando se aparta. Mantener E pulsada no alterna la puerta repetidamente. Los muros bloquean la interacción con la puerta a través de ellos.
- **Pared junto a cocina y toilette:** el extremo del tabique sur llegaba a `x=8,34`, dejando 21 cm hasta la cara interior de la pared de cocina (`x=8,55`). Se prolonga hasta su eje (`x=8,64`) para cerrar el encuentro a toda altura, sin cambiar el interior del baño.
- **Estar:** se retiran la butaca negra y su colisionador para liberar el paso junto al comedor y al ventanal.
- **Decoración:** cuadros de tonos tierra y oliva sobre el sofá, lámpara en la mesa lateral, ramas en el jarrón y accesorios sobre la mesada. Se reutilizan materiales; no se agregan texturas ni luces dinámicas.

## Verificación

### Puerta del vecino y botonera del ascensor

Agregadas en `feat/puerta-vecino-botonera-ascensor`, desde `main` en `65f6590`.

- La puerta del vecino está enfrentada a la entrada del departamento. Su posición se obtiene del muro existente por raycast; tiene marco, molduras, manija y mirilla. Es decorativa, no ofrece ninguna acción y conserva la colisión del muro.
- La botonera está sobre el lateral derecho de la cabina, cerca del acceso, y viaja con ella. Al apuntarla desde dentro, E/clic inicia el viaje hacia la otra parada; en celular se usa el botón del HUD. Apuntar a otra parte de la cabina no activa el ascensor.
- Se agregan cinco mallas agrupadas por material (dos para la puerta y tres para la botonera), sin texturas ni luces adicionales. El GLB y los archivos de Blender permanecen iguales.

Con el build servido en `:3100`, `node scripts/verify-elevator-panel.mjs` verifica subida y bajada, E/clic, botones táctiles emulados, ausencia de interacción en la puerta del vecino y paso libre por el pasillo. Las capturas y el informe quedan en `.cache/elevator-panel/`. La emulación no reemplaza la prueba en un dispositivo móvil real.

Resultado: tipos, build, viaje de ida y vuelta en escritorio y emulación táctil, colisión del frente decorativo e inicio/pausa sin `?debug` aprobados en Chrome. Se revisaron las capturas de ambas paradas y de la puerta del vecino.

### Geometría y circulación del departamento

La comprobación de geometría se ejecuta sobre la escena reconstruida en memoria:

```powershell
& $env:BLENDER_PATH --background --factory-startup modelos/Torre_Natalini/Torre_Natalini_Interpretativa.blend --python-exit-code 1 --python scripts/blender/rebuild_archviz.py --python scripts/blender/verify_apartment.py
```

Verifica que los solados no se superpongan y conserven la cobertura, que los tomacorrientes estén apoyados en sus paredes, que el paso al pie de las camas sea de al menos 65 cm y que el tabique del toilette conecte con la pared de cocina. También comprueba la retirada de la butaca y las medidas de la puerta. El informe queda en `.cache/models/apartment-verification.json`.

Después de `npm run model:build`, `npm run typecheck` y `npm run build`, servir el resultado:

```powershell
node node_modules/next/dist/bin/next start -p 3100
```

En otra terminal:

```powershell
node scripts/verify-apartment.mjs
node scripts/verify-apartment-door.mjs
node scripts/verify-performance.mjs
```

La prueba del departamento usa la API de depuración para ubicar al visitante y luego cruza a pie el frente y el lateral de ambas camas con las colisiones reales. También cruza el umbral del baño, comprueba la puerta desde ambos lados con E/clic, recorre el lugar que ocupaba la butaca y usa los botones táctiles en Chrome con emulación de iPhone. Esto último no reemplaza una prueba en Safari de un iPhone real. El informe y las capturas quedan en `.cache/apartment/verification/`. La prueba aislada de la puerta comprueba el barrido y las colisiones cuando alguien ocupa el vano. La prueba de rendimiento comprueba además el inicio y la pausa sin `?debug`.

Resultado local: geometría, `model:build`, tipos, build, colisiones de la puerta y pruebas de Chrome aprobados. Se revisaron las capturas del encuentro de paredes, el estar decorado y la puerta. El recorrido se probó en Windows con GTX 750 Ti; el control táctil se comprobó con emulación de iPhone en Chrome, pendiente de validación en un dispositivo real. Los hashes SHA-256 de los dos `.blend` permanecieron iguales y no se generó ningún `.blend1`.

El modelo generado es `torre-natalini.a427f7e80a.glb` (26.002.696 bytes), frente a 31.751.400 bytes de la primera corrección del departamento: aproximadamente 18 % menos. Las texturas pasan de 23 a 17 al retirar la butaca importada.
