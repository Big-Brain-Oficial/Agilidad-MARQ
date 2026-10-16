# MARQ Experience

Plataforma inmobiliaria inmersiva para [MARQ](https://estudiomarq.com.ar): un **mapa geográfico en perspectiva** de Resistencia con los desarrollos del estudio y un **recorrido 3D en primera persona** por la Torre Natalini (vereda, hall, ascensor, pasillo y departamento muestra). El **MARQ Bus** estacionado frente al edificio lleva de vuelta al mapa.

Proyecto académico de la UTN, desarrollado en conjunto con MARQ.

**Producción:** https://estudiomarq.vercel.app

## Índice

- [Qué incluye](#qué-incluye)
- [Stack](#stack)
- [Correr el proyecto](#correr-el-proyecto)
- [Controles del recorrido](#controles-del-recorrido)
- [Estructura](#estructura)
- [Editar contenido](#editar-contenido)
- [Modelo 3D](#modelo-3d)
- [Verificación y depuración](#verificación-y-depuración)
- [Ramas y deploy](#ramas-y-deploy)
- [Documentación](#documentación)
- [Pendientes](#pendientes)
- [Equipo](#equipo)
- [Licencia y créditos](#licencia-y-créditos)

## Qué incluye

- **Mapa geográfico** (`/`): cartografía real de Resistencia con MapLibre y OpenFreeMap, cámara inclinada como una maqueta. Los 10 desarrollos tienen maquetas doradas que crecen al alejarse para seguir viéndose. Abre en una **vista general**; el marcador abre la ficha del desarrollo y, si tiene recorrido, el botón «Recorrer en 3D». Funciona en computadora y en celular.
- **Recorrido 3D** (`/recorrido/torre-natalini`): primera persona con colisiones, puertas automáticas en el acceso, ascensor entre el hall y el piso del departamento, textos por zona y objetos con información. En el hall hay cuadros del equipo que abren su perfil de LinkedIn.
- **Computadora y táctil**: teclado y mouse con captura del puntero; en Android, iPhone y iPad, joystick y arrastre para mirar.
- **Dos calidades**: «Alta» (sombras y SSAO, DPR hasta 1,5) y «Fluida» (DPR 1, sin sombras ni SSAO). Si el navegador dibuja por software, arranca en «Fluida» y avisa.
- **Transición** entre mapa y recorrido con una cortina que muestra el progreso real de carga del modelo.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript estricto |
| Mapa | MapLibre GL JS 6 · OpenFreeMap / OpenStreetMap (sin clave de API) |
| 3D | Three.js r186 · React Three Fiber 9 · drei |
| Colisiones | three-mesh-bvh (cápsula contra BVH, sin motor de física) |
| Estado | zustand (compartido entre el `<Canvas>` y el HUD) |
| Estilos | CSS Modules + variables de `src/app/globals.css` |
| Pipeline del modelo | Blender 4.5 LTS · gltf-transform · meshoptimizer · KTX2 (ktx2-encoder) · sharp |
| Pruebas en navegador | Scripts Node + Chrome (`scripts/verify-*.mjs`) |
| Deploy | Vercel |

Sin base de datos, backend propio ni variables de entorno: el contenido vive en archivos TypeScript/JSON del repositorio. El mapa necesita conexión para descargar la cartografía.

## Correr el proyecto

Requiere **Node 20 o superior**.

```bash
npm install
npm run dev        # http://localhost:3000
```

Versión de producción local:

```bash
npm run build
npm start
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (también chequea tipos) |
| `npm start` | Sirve el build de producción |
| `npm run typecheck` | Chequeo de tipos de TypeScript |
| `npm run model:build` | Regenera el GLB desde el `.blend` (necesita Blender) |
| `npm run archviz:assets` | Descarga las texturas y modelos CC0 de Poly Haven a `public/archviz/` |

No hay lint ni tests unitarios configurados. Antes de abrir un pull request, correr `npm run typecheck` y `npm run build`.

El aviso `THREE.Clock: This module has been deprecated` en la consola viene de React Three Fiber y no afecta el funcionamiento.

## Controles del recorrido

**Computadora**

| Tecla | Acción |
|---|---|
| Mouse | Mirar |
| W A S D o flechas | Caminar |
| Shift | Correr |
| E o clic | Usar el ascensor · abrir puertas · subir al MARQ Bus |
| I | Ver información del objeto cercano |
| Esc | Pausa (desde ahí se cambia la calidad o se vuelve al mapa) |

**Celular y tablet**

| Gesto | Acción |
|---|---|
| Dedo en la mitad izquierda | Joystick: caminar (estirar más allá del aro para correr) |
| Arrastre en la mitad derecha | Mirar |
| Toque sobre «i» | Ver información |
| Botones en pantalla | Ascensor, bus, puertas y pausa |

## Estructura

```
├── modelos/Torre_Natalini/     fuente del modelo: .blend, script generador, guía y referencias
├── scripts/
│   ├── blender/                export_web.py y rebuild_archviz.py (corren dentro de Blender)
│   ├── build-model.mjs         orquesta Blender + optimización + nombre con hash
│   ├── archviz-assets.mjs      descarga los assets CC0
│   └── verify-*.mjs            pruebas en Chrome contra el build de producción
├── public/
│   ├── models/                 GLB publicados (torre-natalini.<hash>.glb)
│   ├── archviz/                texturas, muebles, plantas, HDR y fondo urbano
│   ├── basis/                  transcodificador KTX2 (copiado de three)
│   ├── maps/resistencia.json   estilo del mapa
│   ├── brand/  equipo/         logo y fotos del equipo
├── src/
│   ├── app/                    rutas: / (mapa) y /recorrido/[slug] (3D), imágenes Open Graph
│   ├── content/                datos de desarrollos, recorrido, mapa y equipo
│   └── components/
│       ├── map/                mapa MapLibre, encuadre, tarjetas y ficha (no importa Three.js)
│       ├── experience/         escena 3D, visitante, colisiones, ascensor, puertas, bus y HUD
│       ├── transition/         cortina persistente entre rutas
│       ├── preview/            tarjeta de las imágenes Open Graph
│       ├── brand/  ui/         logo y botón de pantalla completa
├── docs/                       notas técnicas (mapa, rendimiento, assets, departamento)
└── ARQUITECTURA.md             decisiones técnicas en detalle
```

El recorrido se carga con `next/dynamic`: el mapa nunca descarga Three.js ni el modelo.

## Editar contenido

| Qué | Dónde |
|---|---|
| Desarrollos: textos, estado, ubicación, recorrido 3D | `src/content/desarrollos.ts` |
| Textos por zona y objetos con información | `src/content/recorridos.ts` |
| Maquetas del mapa y escala según el zoom | `src/content/mapa-resistencia.ts` |
| Estilo del mapa: calles, plazas, lagunas, rótulos | `public/maps/resistencia.json` |
| Cuadros del equipo en el hall | `src/content/equipo.ts` + `public/equipo/<id>.webp` |

Los textos salen de estudiomarq.com.ar y se validan con MARQ: no agregar datos (superficies, pisos, amenities) que no estén publicados. El mapa usa el campo `ubicacion` (longitud y latitud); las fuentes de cada coordenada están en [docs/MAPA.md](docs/MAPA.md).

`src/content/modelos.generated.json` y `public/models/*.glb` los escribe `model:build`: no se editan a mano.

## Modelo 3D

El GLB que usa la web ya está en `public/models/`. Solo hay que regenerarlo si cambia el `.blend`:

```bash
npm run model:build                 # ~10 min por la codificación KTX2
npm run model:build -- --sin-blender  # reusa el último export de .cache/models
```

Necesita **Blender 4.5 LTS**. El script lo busca en `BLENDER_PATH`, en `C:\Users\<usuario>\tools\blender-4.5.*` o en el `PATH`.

El pipeline limpia la escena, une ~2.000 objetos en pocas mallas por zona y material, comprime con meshopt y pasa las texturas a KTX2. Las mallas siguen convenciones de nombre que lee `prepareWorld.ts`:

| Prefijo | Uso |
|---|---|
| `COL__` | Malla visible que participa de las colisiones |
| `VIS__` | Solo visual |
| `ANCLA__` | Puntos clave: inicio, acceso, bus, ascensor |
| `ZONA__` | Cajas de zona (hall, pasillo, departamento) |
| `LUZ__` | Luces de Blender que se recrean en la web |

El modelo de la Torre Natalini es **interpretativo**: volumetría, piso y ubicación del departamento son aproximados. Ver [GUIA_MODELO.md](modelos/Torre_Natalini/GUIA_MODELO.md). Para sumar otro edificio con recorrido 3D, seguir la sección 7 de [ARQUITECTURA.md](ARQUITECTURA.md).

## Verificación y depuración

Los scripts de `scripts/verify-*.mjs` abren Chrome contra el build de producción servido localmente:

```bash
npm run build
node node_modules/next/dist/bin/next start -p 3100
# en otra terminal
node scripts/verify-performance.mjs            # inicio, captura del mouse y pausa
node scripts/verify-performance.mjs --software # simula renderizado por software
```

Capturas y resultados quedan en `.cache/`. Alcance de cada prueba en [docs/RENDIMIENTO-RECORRIDO.md](docs/RENDIMIENTO-RECORRIDO.md).

`/recorrido/torre-natalini?debug` permite moverse sin capturar el mouse y expone `window.marq` en la consola:

- `marq.state()`: posición, zona y fase.
- `marq.teleport(x, y, z)`: mueve al visitante.
- `marq.look(yaw, pitch)`: orienta la mirada.
- `marq.interact()`: equivale a apretar E.

`?debug` saltea la captura del mouse: un cambio que anda con `?debug` puede fallar sin él. Cualquier cambio en el inicio, la pausa o los controles se prueba también en un navegador real sin `?debug`.

Si el 3D anda muy lento en Windows, revisar `chrome://gpu`: si *GL_RENDERER* dice «Microsoft Basic Render Driver» o «SwiftShader», el navegador dibuja por software y hay que activar la aceleración por hardware.

## Ramas y deploy

El sitio está en **Vercel**, conectado a este repositorio:

| Rama | Resultado |
|---|---|
| `main` | Se publica automáticamente en **estudiomarq.vercel.app** |
| Cualquier otra | Versión de prueba (*Preview*) con su propia dirección |

1. Crear una rama desde `main` (`feat/...` o `fix/...`). No se commitea directo a `main`.
2. Abrir un pull request; el enlace a la versión de prueba aparece en él.
3. Probar ahí, sobre todo el recorrido 3D con un clic real en «Comenzar recorrido».
4. Hacer merge a `main` para publicar.

Commits en español, con un título corto y el porqué en el cuerpo.

## Documentación

| Archivo | Contenido |
|---|---|
| [ARQUITECTURA.md](ARQUITECTURA.md) | Stack, pipeline del modelo, rendimiento, colisiones, ascensor y transición |
| [docs/MAPA.md](docs/MAPA.md) | Representación del mapa y fuentes de cada ubicación |
| [docs/RENDIMIENTO-RECORRIDO.md](docs/RENDIMIENTO-RECORRIDO.md) | Optimizaciones de carga y verificación en equipos de destino |
| [docs/URBAN-ASSETS.md](docs/URBAN-ASSETS.md) | Origen de los árboles y el fondo urbano |
| [docs/AJUSTES-DEPARTAMENTO.md](docs/AJUSTES-DEPARTAMENTO.md) | Correcciones y ambientación del departamento |
| [GUIA_MODELO.md](modelos/Torre_Natalini/GUIA_MODELO.md) | Criterios del modelo interpretativo |

## Pendientes

- Regenerar el modelo con los planos reales de MARQ (planta tipo, cortes, piso del departamento).
- Evaluar memoria y fluidez del recorrido en celulares reales de distintas gamas.
- Recorridos 3D para otros desarrollos.
- Iluminación horneada en Blender.
- Lint, tests y CI (hoy solo hay chequeo de tipos y scripts de verificación manuales).

Detalle en la sección 9 de [ARQUITECTURA.md](ARQUITECTURA.md).

## Equipo

| Integrante | LinkedIn |
|---|---|
| Jerónimo Zapata | [jeronimo-zapata](https://www.linkedin.com/in/jeronimo-zapata/) |
| Paula Kozak | [paula-kozak](https://www.linkedin.com/in/paula-kozak/) |
| Matías Lima | [matias-lima](https://www.linkedin.com/in/matias-lima-266108375/) |
| Tomás Duarte | [tomas-duarte](https://www.linkedin.com/in/tomas-duarte-27a133237/) |
| Lorenzo Arduino | [lorenzo-arduino](https://www.linkedin.com/in/lorenzo-arduino-773432406/) |
| Matías Rodríguez Scornik | [matias-rodriguez-scornik](https://www.linkedin.com/in/matias-rodriguez-scornik-/) |
| Ivo Sodja | [ivo-sodja](https://www.linkedin.com/in/ivo-sodja-a94b2b306/) |
| Gonzalo Orban | [gonzaorban](https://www.linkedin.com/in/gonzaorban/) |

## Licencia y créditos

El **código fuente** se distribuye bajo licencia [MIT](LICENSE).

Quedan fuera de esa licencia el nombre, el logo y la identidad de MARQ, los textos e imágenes tomados de estudiomarq.com.ar, el modelo de la Torre Natalini y las fotos del equipo.

- Cartografía: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, servida por [OpenFreeMap](https://openfreemap.org/) / OpenMapTiles.
- Texturas, muebles, plantas y HDR: [Poly Haven](https://polyhaven.com/) (CC0). Origen y SHA-256 en `public/archviz/sources.json`.
- Árboles y fondo urbano: imágenes generadas para el proyecto ([docs/URBAN-ASSETS.md](docs/URBAN-ASSETS.md)).
