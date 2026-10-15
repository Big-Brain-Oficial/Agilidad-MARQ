"""Ejecutar después de rebuild_archviz.py, en la misma sesión de Blender.

Verifica los solados, el apoyo de tomas y la circulación al pie de las camas.
No modifica el modelo; escribe el resultado en .cache/models.
"""
import json
from itertools import combinations
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
EPS = .0001
bpy.context.view_layer.update()


def bounds(obj):
    points = [obj.matrix_world @ Vector(p) for p in obj.bound_box]
    return ([min(p[i] for p in points) for i in range(3)],
            [max(p[i] for p in points) for i in range(3)])


floors = [o for o in bpy.data.objects if o.name.startswith(('COTA__', 'Suelo circulacion', 'Umbral continuo'))]
for a, b in combinations(floors, 2):
    amin, amax = bounds(a)
    bmin, bmax = bounds(b)
    overlap = [min(amax[i], bmax[i]) - max(amin[i], bmin[i]) for i in (0, 1)]
    assert not (abs(amax[2] - bmax[2]) < EPS and min(overlap) > EPS), (a.name, b.name, overlap)

# Conservar la cobertura original, descontando solo la doble superficie.
# Unión de los rectángulos anteriores (incluye umbrales, no es superficie neta).
assert abs(sum(o.dimensions.x * o.dimensions.y for o in floors) - 70.8353) < .001

outlets = []
for obj in bpy.data.objects:
    if not obj.name.startswith('Toma electrico'):
        continue
    backing = bpy.data.objects[obj['archviz_wall']]
    point = backing.matrix_world.inverted() @ obj.matrix_world.translation
    assert abs(point.x) + obj.dimensions.x / 2 < backing.dimensions.x / 2
    assert abs(point.z) + obj.dimensions.z / 2 < backing.dimensions.z / 2
    gap = abs(point.y) - backing.dimensions.y / 2 - obj.dimensions.y / 2
    assert abs(gap) < EPS, (obj.name, backing.name, gap)
    outlets.append({'wall': backing.name, 'gap': round(gap, 6)})
assert len(outlets) == 3

beds = sorted((o for o in bpy.data.objects if o.name.startswith('Proxy cama')), key=lambda o: o.location.y, reverse=True)
assert len(beds) == 2
clearances = []
for bed, room_id, wall_name in zip(beds, ['bedroom1', 'bedroom2'], ['Norte dormitorios', 'Divisor dormitorios']):
    floor_min, _ = bounds(bpy.data.objects['COTA__' + room_id])
    bed_min, bed_max = bounds(bed)
    wall_min, _ = bounds(bpy.data.objects[wall_name])
    clearance = bed_min[1] - floor_min[1]
    assert clearance >= .65, (room_id, clearance)
    # El respaldo sobresale 10 cm más allá de la base.
    assert bed_max[1] + .10 <= wall_min[1] + EPS, room_id
    clearances.append({'room': room_id, 'footClearance': round(clearance, 3), 'width': round(bed.dimensions.x, 3), 'length': round(bed.dimensions.y, 3)})

report = {'floorPieces': len(floors), 'outlets': outlets, 'beds': clearances}
out = ROOT / '.cache/models/apartment-verification.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print('APARTMENT_VERIFY_OK', json.dumps(report), flush=True)
