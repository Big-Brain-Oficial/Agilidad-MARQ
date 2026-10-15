"""Genera el nivel de evaluación en UE 5.7. Ejecutar mediante unreal:import."""
import json
import os
from pathlib import Path
import unreal

ROOT = Path(__file__).resolve().parents[4]
CACHE = ROOT / '.cache/unreal'
LEVEL = '/Game/Natalini/Maps/Natalini'
ASSETS = '/Game/Natalini/Imported'


def require(value, message):
    if not value:
        raise RuntimeError(message)
    return value


def blueprint(name, parent):
    factory = unreal.BlueprintFactory()
    factory.set_editor_property('parent_class', parent)
    path = '/Game/Natalini/Navigation'
    asset = unreal.load_asset(f'{path}/{name}')
    if not asset:
        asset = unreal.AssetToolsHelpers.get_asset_tools().create_asset(name, path, unreal.Blueprint, factory)
    require(asset, f'No se pudo crear {name}')
    unreal.BlueprintEditorLibrary.compile_blueprint(asset)
    return asset, unreal.load_class(None, f'{path}/{name}.{name}_C')


def main():
    for filename in ['natalini.glb', 'entorno.glb', 'source.json']:
        require((CACHE / filename).exists(), f'Falta {filename}. Ejecutá npm run unreal:prepare.')
    if unreal.EditorAssetLibrary.does_asset_exist(LEVEL) and os.environ.get('MARQ_UNREAL_REPLACE') != '1':
        raise RuntimeError('El nivel ya existe. Para regenerar sus assets usá unreal:import -- -Replace.')

    world = require(unreal.EditorLoadingAndSavingUtils.new_blank_map(False), 'No se pudo crear el nivel.')
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    manager = unreal.InterchangeManager.get_interchange_manager_scripted()
    options = unreal.ImportAssetParameters()
    options.set_editor_property('is_automated', True)
    options.set_editor_property('replace_existing', True)
    for filename in ['natalini.glb', 'entorno.glb']:
        source = unreal.InterchangeManager.create_source_data(str(CACHE / filename))
        require(manager.import_scene(ASSETS + '/' + Path(filename).stem, source, options), f'Falló la importación de {filename}')

    imported = list(actors.get_all_level_actors())
    require(any(a.get_components_by_class(unreal.StaticMeshComponent) for a in imported), 'La importación no produjo mallas.')

    def named(name):
        return next((a for a in imported if a.get_actor_label() == name), None)

    start = require(named('ANCLA__inicio'), 'No se importó el ancla de inicio.')
    access = require(named('ANCLA__acceso'), 'No se importó el ancla del acceso.')
    # Usamos las transformaciones importadas; Interchange resuelve ejes y metros a centímetros.
    position = start.get_actor_location() + unreal.Vector(0, 0, 165)
    rotation = unreal.MathLibrary.find_look_at_rotation(position, access.get_actor_location())
    player_start = actors.spawn_actor_from_class(unreal.PlayerStart, position, rotation)
    player_start.set_actor_label('Inicio de evaluación')

    # Navegación libre sin colisiones: permite inspeccionar interiores y el departamento
    # mientras se adapta el recorrido guiado y su ascensor a Unreal.
    pawn, pawn_class = blueprint('BP_VisitaLibre', unreal.SpectatorPawn)
    default_pawn = unreal.get_default_object(pawn_class)
    movement = default_pawn.get_component_by_class(unreal.FloatingPawnMovement)
    require(movement, 'No se encontró el movimiento del visitante.')
    movement.set_editor_property('max_speed', 250.0)
    movement.set_editor_property('acceleration', 1000.0)
    movement.set_editor_property('deceleration', 1500.0)
    unreal.BlueprintEditorLibrary.compile_blueprint(pawn)
    require(unreal.EditorAssetLibrary.save_loaded_asset(pawn, False), 'No se pudo guardar el visitante.')
    pawn_class = unreal.load_class(None, '/Game/Natalini/Navigation/BP_VisitaLibre.BP_VisitaLibre_C')
    mode, mode_class = blueprint('BP_Evaluacion', unreal.GameModeBase)
    unreal.get_default_object(mode_class).set_editor_property('default_pawn_class', pawn_class)
    unreal.BlueprintEditorLibrary.compile_blueprint(mode)
    require(unreal.EditorAssetLibrary.save_loaded_asset(mode, False), 'No se pudo guardar el modo de evaluación.')
    world.get_world_settings().set_editor_property('default_game_mode', mode_class)

    for actor in imported:
        label = actor.get_actor_label()
        if label.startswith('PHY__'):
            actor.set_actor_hidden_in_game(True)
            actor.set_is_temporarily_hidden_in_editor(True)
        for component in actor.get_components_by_class(unreal.StaticMeshComponent):
            # Este prototipo es de vuelo libre; la navegación de producción es otra fase.
            component.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
            if label.startswith(('PHY__', 'UE_Panorama')):
                component.set_cast_shadow(False)
        if label.startswith('VISTA__'):
            location = actor.get_actor_location() + unreal.Vector(0, 0, 165)
            camera = actors.spawn_actor_from_class(unreal.CameraActor, location, rotation)
            camera.set_actor_label('Evaluar_' + label.removeprefix('VISTA__'))

    sun = actors.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 1000), unreal.Rotator(-35, -40, 0))
    sun.set_actor_label('Sol de la tarde')
    sun.light_component.set_mobility(unreal.ComponentMobility.MOVABLE)
    sun.light_component.set_editor_property('intensity', 35000.0)
    sun.light_component.set_editor_property('atmosphere_sun_light', True)
    sun.light_component.set_editor_property('use_temperature', True)
    sun.light_component.set_editor_property('temperature', 5700.0)
    actors.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector())
    sky = actors.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 500))
    sky.light_component.set_mobility(unreal.ComponentMobility.MOVABLE)
    sky.light_component.set_editor_property('real_time_capture', True)
    sky.light_component.set_editor_property('intensity', 1.0)

    # Pocas luces sin sombras para el interior; el sol aporta la sombra principal.
    for anchor in [a for a in imported if a.get_actor_label().startswith('LUZ__')][:8]:
        light = actors.spawn_actor_from_class(unreal.PointLight, anchor.get_actor_location())
        light.set_actor_label('Luz interior ' + anchor.get_actor_label())
        light.light_component.set_mobility(unreal.ComponentMobility.MOVABLE)
        light.light_component.set_editor_property('intensity_units', unreal.LightUnits.LUMENS)
        light.light_component.set_editor_property('intensity', 600.0)
        light.light_component.set_editor_property('attenuation_radius', 700.0)
        light.light_component.set_cast_shadows(False)

    post = actors.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector())
    post.set_editor_property('unbound', True)
    settings = post.get_editor_property('settings')
    settings.set_editor_property('override_motion_blur_amount', True)
    settings.set_editor_property('motion_blur_amount', 0.0)
    post.set_editor_property('settings', settings)
    require(unreal.EditorLoadingAndSavingUtils.save_map(world, LEVEL), 'No se pudo guardar el nivel.')
    require(unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True), 'No se pudieron guardar los assets.')
    report = {'run': os.environ.get('MARQ_UNREAL_IMPORT_RUN'), 'level': LEVEL, 'actors': len(actors.get_all_level_actors()),
              'source': json.loads((CACHE / 'source.json').read_text(encoding='utf-8'))}
    (CACHE / 'import-result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    unreal.log('NATALINI_IMPORT_OK')


main()
