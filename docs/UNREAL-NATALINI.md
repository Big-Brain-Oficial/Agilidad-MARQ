# Natalini en Unreal · evaluación visual

Rama `codex/unreal-natalini`. Proyecto Blueprint para **Unreal Engine 5.7**, con Pixel Streaming **2** e infraestructura **UE5.7**. No necesita un módulo C++ propio. La web existente continúa en Three.js; el prototipo tiene su propia ruta.

## Qué incluye y qué falta

- Proyecto `.uproject`, configuración de Lumen por software, sombras virtuales y TSR. Ray tracing por hardware desactivado.
- Exportación reproducible desde el Blender original y la reconstrucción ArchViz existente; imágenes de hasta 2K, sin extensiones de compresión exclusivas de la web.
- Edificio, materiales PBR, calles, edificios vecinos, árboles con hojas recortadas y panorama liviano de ciudad. El entorno es ilustrativo, no un relevamiento real.
- Importador de escena con Interchange; crea iluminación, punto de inicio y navegación libre. Los materiales de vidrio y follaje necesitan revisión visual en Unreal: la traducción desde glTF no garantiza equivalencia.
- Página `/evaluacion/natalini` para elegir versión y `/recorrido/torre-natalini/unreal` para abrir el reproductor oficial de Pixel Streaming.
- **Generado en Unreal 5.7.4:** nivel, geometría, materiales, navegación libre y cámaras. La importación finalizó con código 0 y comprobante de guardado. Se incorporan todas las luminarias interiores, incluido el hall y el pasillo, como luces rectangulares con sombras, temperatura de 3500 K y 4000 K en la cabina; sus intensidades son una adaptación artística de las del modelo, no un cálculo luminotécnico certificado.
- Cámara de 75°, adaptación progresiva de exposición entre exterior e interior, bloom leve y desenfoque/motion blur desactivados para poder recorrer y apreciar los ambientes con claridad. Las cámaras de evaluación miran a los puntos definidos en Blender.
- **Pendiente a cargo del usuario:** evaluación visual, fluidez y latencia. Estos resultados no se presentan como medidos.
- **Fuera de esta primera comparación visual:** ascensor funcional, puertas automáticas, bus interactivo, colisiones de caminata, HUD, puntos informativos y controles móviles. Se usa vuelo libre para recorrer interiores. La versión web conserva esas funciones existentes.

## 1. Preparar el edificio

Instalar Unreal Engine **5.7** desde Epic Games Launcher. Blender ya se utiliza en este repositorio (el exportador admite la ruta instalada de Blender 5.x).

Desde la raíz:

```powershell
npm run unreal:prepare
```

Si Blender está en otra ubicación:

```powershell
$env:BLENDER_PATH = 'D:/Blender/blender.exe'
npm run unreal:prepare
```

Se crean `.cache/unreal/natalini.glb`, `entorno.glb`, imágenes intermedias y un manifiesto con hashes. No se guardan los `.blend` ni se cambian los modelos web. Los archivos generados no se suben a Git.

## 2. Crear y abrir el nivel

Con el editor cerrado:

```powershell
# Solo si el motor está instalado en una ubicación distinta:
$env:UE_ROOT = 'D:/Epic Games/UE_5.7'
npm run unreal:import
```

La importación usa UnrealEditor-Cmd, genera materiales, crea `/Game/Natalini/Maps/Natalini` y guarda los assets. Puede demorar por la compilación inicial de shaders. Solo se informa éxito si el motor escribe el comprobante de esa ejecución.

Abrir `unreal/Natalini/Natalini.uproject`. Presionar **Play** y capturar el mouse dentro de la vista. WASD mueve, E sube y Q baja; Escape sale del modo Play. Es navegación libre, sin colisiones ni ascensor. Los actores `Evaluar_*` ubican cámaras en el departamento para inspeccionarlo desde el editor.

Para regenerar el contenido importado, descartando modificaciones manuales de los assets generados:

```powershell
npm run unreal:import -- -Replace
```

El importador se niega a sobrescribir el nivel por defecto. Conservar ajustes manuales en otra carpeta/mapa antes de regenerar. `Content/Python` contiene el código versionado; el resto de `Content`, `Saved`, cachés y binarios queda ignorado.

## 3. Usarlo desde la web

El navegador recibe video y envía teclado/mouse mediante WebRTC. El cliente **no instala Unreal**. La aplicación Unreal debe permanecer ejecutándose en una PC o servidor con GPU y codificador compatible. Vercel aloja la web, no ese proceso.

Preparar la [infraestructura oficial UE5.7](https://github.com/EpicGamesExt/PixelStreamingInfrastructure/tree/UE5.7):

```powershell
npm run unreal:setup-streaming
```

El comando descarga la revisión de Epic fijada en `scripts/unreal/streaming.lock.json`, instala los paquetes necesarios y compila el servidor y el reproductor. Se guarda en `.cache/PixelStreamingInfrastructure`, fuera de Git. También agrega la URL local a `.env.local` si todavía no existe esa variable; conserva cualquier configuración previa. No usar una versión distinta del motor: el frontend y la infraestructura deben coincidir.

Iniciar el servidor y la aplicación:

```powershell
npm run unreal:server
npm run unreal:stream
```

Ambos procesos quedan en segundo plano y devuelven su PID para detenerlos. El servidor sirve el reproductor en el puerto 8080 y recibe Unreal en el 8888. Los logs quedan en `.cache/unreal`. Se permite un único visitante para evitar que dos personas muevan la misma cámara. El arranque de un proceso no confirma conexión: el reproductor oficial muestra el estado real.

Crear `.env.local` en la raíz:

```dotenv
MARQ_UNREAL_PLAYER_URL=http://localhost:8080/player.html
```

Reiniciar el servidor de Next (o reconstruir producción). Abrir `/evaluacion/natalini`. La URL configura la **página del reproductor**, no `ws://localhost:8888`. El iframe se monta al pulsar «Abrir Unreal»; cerrarlo libera la conexión del navegador, pero no detiene el proceso Unreal. «Reconectar» vuelve a cargar el reproductor. No se interpreta la carga del iframe como confirmación de video.

Si la configuración de seguridad del servidor impide mostrar el reproductor en un iframe, usar «Abrir aparte» o permitir el origen de MARQ en su política `frame-ancestors`. Para una demo externa se requiere HTTPS para la página del reproductor, WSS para señalización y STUN/TURN según la red; cambiar la URL local por la del servidor. `localhost` en el equipo del cliente no apunta a tu PC. No poner credenciales privadas en la URL: es pública para el navegador.

Una sesión estándar comparte cámara y controles entre los visitantes. Para recorridos independientes hay que asignar una instancia de Unreal por sesión y resolver el acceso/capacidad del servidor antes de publicarlo ampliamente.

## Rendimiento y evaluación

Perfil inicial `equilibrado`: salida 1600×900, resolución interna 75%, calidad High y límite de 30 FPS. `npm run unreal:stream -- -Profile calidad` usa 1920×1080 al 100%, también limitado a 30 FPS. Son configuraciones de partida, **no mediciones ni garantías**.

En una GTX 1050 Lumen puede resultar demasiado costoso. La primera evaluación debe separar la calidad visual de la capacidad del equipo. Para una presentación remota, elegir la GPU del servidor después de medir; no comprometer costo ni fluidez sin esa prueba.

Comparar acceso, estar y balcón, con la misma conexión y equipo del visitante. Registrar calidad percibida, tiempo hasta ver imagen, FPS del motor, resolución del video y latencia de entrada desde las estadísticas del reproductor oficial. La tasa de refresco de la página no mide los FPS de Unreal. No se ejecutan pruebas visuales automatizadas: quedan a cargo del usuario.

## Referencias

- [Inicio de Pixel Streaming](https://dev.epicgames.com/documentation/unreal-engine/getting-started-with-pixel-streaming-in-unreal-engine)
- [Migración a Pixel Streaming 2](https://github.com/EpicGamesExt/PixelStreamingInfrastructure/blob/UE5.7/Docs/pixel-streaming-2-migration-guide.md)
- [Importación con Interchange](https://dev.epicgames.com/documentation/unreal-engine/importing-assets-using-interchange-in-unreal-engine)
- [API Python InterchangeManager 5.7](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/InterchangeManager?application_version=5.7)
- [Rendimiento de Lumen](https://dev.epicgames.com/documentation/en-us/unreal-engine/lumen-performance-guide-for-unreal-engine)
