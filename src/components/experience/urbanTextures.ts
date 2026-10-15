import * as THREE from 'three';

export function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Texturas originales, generadas una vez al montar el entorno. No requieren descargas.
// Cada fachada cubre cuatro módulos de 3 × 3,2 m; las UV conservan esa escala.
export function createUrbanTextures(anisotropy: number) {
  const textures: THREE.CanvasTexture[] = [];
  const paint = (name: string, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudieron crear las texturas del entorno.');
    draw(ctx);
    const texture = new THREE.CanvasTexture(canvas);
    texture.name = name;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = anisotropy;
    textures.push(texture);
    return texture;
  };
  const grain = (ctx: CanvasRenderingContext2D, seed: number, count: number, strength: number) => {
    const random = seededRandom(seed);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = `rgba(${random() > .5 ? '255,255,255' : '0,0,0'},${random() * strength})`;
      ctx.fillRect(random() * 512, random() * 512, 1 + random() * 2, 1 + random() * 2);
    }
  };
  const facades = ['#c8bca8', '#b6b9b5', '#b18d76'].map((wall, style) => paint(`Fachada urbana ${style}`, (ctx) => {
    const random = seededRandom(54 + style);
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, 512, 512);
    grain(ctx, style + 8, 18000, .10);
    for (let row = 0; row < 4; row++) {
      const y = row * 128;
      ctx.fillStyle = 'rgba(40,35,30,.18)';
      ctx.fillRect(0, y + 121, 512, 4);
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.fillRect(0, y + 125, 512, 3);
      for (let col = 0; col < 4; col++) {
        const x = col * 128 + 26;
        ctx.fillStyle = 'rgba(30,26,22,.25)';
        ctx.fillRect(x - 5, y + 22, 82, 88);
        ctx.fillStyle = '#d0cbc1';
        ctx.fillRect(x - 3, y + 24, 78, 82);
        const glass = ctx.createLinearGradient(x, y + 28, x + 65, y + 100);
        glass.addColorStop(0, random() > .5 ? '#71868c' : '#526770');
        glass.addColorStop(.48, '#40545d');
        glass.addColorStop(1, '#29383d');
        ctx.fillStyle = glass;
        ctx.fillRect(x, y + 27, 72, 76);
        if (random() > .4) {
          ctx.fillStyle = random() > .5 ? '#a9a494' : '#7c8986';
          ctx.fillRect(x + 1, y + 28, 70, 15 + random() * 42);
        }
        ctx.fillStyle = '#c0c3bc';
        ctx.fillRect(x + 34, y + 27, 3, 76);
        ctx.fillRect(x, y + 66, 72, 2);
        ctx.fillStyle = 'rgba(220,235,236,.16)';
        ctx.fillRect(x + 4, y + 29, 4, 72);
        ctx.fillStyle = '#e0d8c9';
        ctx.fillRect(x - 5, y + 104, 82, 4);
        if (style === 2) {
          ctx.fillStyle = '#343c3d';
          ctx.fillRect(x - 9, y + 89, 90, 3);
          for (let bar = 0; bar < 8; bar++) ctx.fillRect(x - 8 + bar * 12, y + 90, 2, 22);
          ctx.fillRect(x - 9, y + 111, 90, 4);
        }
      }
    }
  }));
  const asphalt = paint('Asfalto granulado', (ctx) => {
    ctx.fillStyle = '#505456';
    ctx.fillRect(0, 0, 512, 512);
    grain(ctx, 602, 70000, .23);
    ctx.strokeStyle = 'rgba(28,31,31,.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(80, 160); ctx.lineTo(118, 174); ctx.lineTo(135, 210);
    ctx.lineTo(176, 225); ctx.lineTo(183, 252); ctx.stroke();
  });
  const paving = paint('Baldosas de vereda', (ctx) => {
    ctx.fillStyle = '#ada99e';
    ctx.fillRect(0, 0, 512, 512);
    const random = seededRandom(90);
    for (let y = 0; y < 512; y += 64) for (let x = 0; x < 512; x += 64) {
      const tone = 159 + Math.floor(random() * 23);
      ctx.fillStyle = `rgb(${tone + 8},${tone + 5},${tone})`;
      ctx.fillRect(x + 1, y + 1, 62, 62);
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.fillRect(x + 2, y + 2, 60, 1);
    }
    grain(ctx, 45, 25000, .12);
  });
  return { facades, asphalt, paving, dispose: () => textures.forEach((texture) => texture.dispose()) };
}
