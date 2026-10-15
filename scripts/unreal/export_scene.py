"""Exporta edificio y ambientación para Interchange, con imágenes PNG y sin KTX2/meshopt."""
import bpy
import math
import random
import runpy
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[sys.argv.index('--') + 1])
# Se reutilizan las convenciones y el agrupamiento de la exportación existente.
sys.argv = [__file__, '--', str(OUT / 'natalini.glb')]
runpy.run_path(str(ROOT / 'scripts/blender/export_web.py'), run_name='__main__')

# Escena independiente; los archivos de autoría de Blender nunca se guardan.
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(718)

def material(name, color, image=None, alpha=False, emission=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1)
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = .85
    if image:
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(str(OUT / image), check_existing=True)
        mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        if alpha:
            mat.node_tree.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
            mat.surface_render_method = 'DITHERED'
        if emission:
            mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
            bsdf.inputs['Emission Strength'].default_value = 1
    mat.use_backface_culling = False
    return mat

asphalt = material('UE_Asfalto', (.095, .10, .11))
paving = material('UE_Vereda', (.43, .41, .36))
facade = material('UE_Fachada', (.6, .58, .5), 'facade.png')
bark = material('UE_Corteza', (.14, .10, .065))
foliage = material('UE_Follaje', (.3, .4, .25), 'foliage.png', alpha=True)
panorama = material('UE_Panorama', (1, 1, 1), 'city-panorama.png', emission=True)
paint = material('UE_Pintura', (.7, .68, .58))

def box(name, pos, size, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if mat == facade:
        uv = obj.data.uv_layers.active.data
        for face in obj.data.polygons:
            for index in face.loop_indices:
                co = obj.data.vertices[obj.data.loops[index].vertex_index].co
                uv[index].uv = ((co.y if abs(face.normal.x) > .5 else co.x) / 12, co.z / 12.8)
    return obj

# Coordenadas de Blender: X lateral, Y hacia el interior de la manzana, Z arriba.
box('UE_Terreno', (0, 0, -.35), (440, 440, .1), paving)
streets = [-113, -53, 7, 67, 127]
avenues = [-180, -120, -60, 60, 120, 180]
for z in streets:
    box('UE_Calle', (0, -z, -.16), (370, 10, .1), asphalt)
    for x in range(-175, 176, 7):
        if all(abs(x-a) > 8 for a in avenues):
            box('UE_Linea', (x, -z, -.102), (3, .12, .01), paint)
for x in avenues:
    box('UE_Avenida', (x, -7, -.17), (10, 300, .1), asphalt)
for z in streets[:-1]:
    for left, right in zip(avenues[:-1], avenues[1:]):
        for x in range(left+16, right-15, 22):
            for bz in [z+20, z+43]:
                if -49 < x < 49 and -35 < bz < 27:
                    continue
                height = random.choice([2, 3, 4, 5, 6, 12]) * 3.2
                box('UE_Edificio', (x, -bz, height/2), (16, 15, height), facade)

for x, y in [(-25, -1), (-17, -1), (17, -1), (25, -1), (-29, -14), (-18, -14), (-7, -14), (6, -14), (18, -14), (29, -14)]:
    scale = random.uniform(.85, 1.2)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=.16*scale, radius2=.06*scale, depth=4*scale, location=(x, y, 2*scale))
    bpy.context.object.data.materials.append(bark)
    for i in range(48):
        angle = i * 2.399963
        center = Vector((x + math.cos(angle)*random.uniform(.2, 1.7)*scale,
                         y + math.sin(angle)*random.uniform(.2, 1.7)*scale,
                         (3.4 + random.uniform(-.5, 1.6))*scale))
        bpy.ops.mesh.primitive_plane_add(size=random.uniform(1.3, 1.9)*scale, location=center,
            rotation=(random.uniform(0, math.pi), random.uniform(0, math.pi), angle))
        bpy.context.object.data.materials.append(foliage)

# Fondo fijo de 128 triángulos: no sigue a la cámara, conserva perspectiva en Unreal.
vertices, faces = [], []
for i in range(65):
    angle = i * math.tau / 64
    for height in [-80, 160]:
        vertices.append((420*math.cos(angle), 420*math.sin(angle), height))
for i in range(64):
    faces.append((2*i, 2*i+1, 2*i+3, 2*i+2))
mesh = bpy.data.meshes.new('UE_Horizonte')
mesh.from_pydata(vertices, [], faces)
mesh.uv_layers.new()
for face in mesh.polygons:
    for index in face.loop_indices:
        vertex = mesh.loops[index].vertex_index
        fraction = (vertex // 2) / 32
        mesh.uv_layers.active.data[index].uv = (fraction if fraction <= 1 else 2-fraction, vertex % 2)
obj = bpy.data.objects.new('UE_Horizonte', mesh)
bpy.context.scene.collection.objects.link(obj)
obj.data.materials.append(panorama)

# Una malla por material para reducir actores y llamadas de dibujo.
groups = {}
for obj in list(bpy.context.scene.objects):
    groups.setdefault(obj.active_material.name, []).append(obj)
for name, objects in groups.items():
    active = objects[0]
    with bpy.context.temp_override(active_object=active, object=active, selected_objects=objects, selected_editable_objects=objects):
        bpy.ops.object.join()
    active.name = name
bpy.ops.export_scene.gltf(filepath=str(OUT / 'entorno.glb'), export_format='GLB', export_yup=True,
    export_animations=False, export_materials='EXPORT', export_extras=True)
print('UNREAL_EXPORT_OK')
