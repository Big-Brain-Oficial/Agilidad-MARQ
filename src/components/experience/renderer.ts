/** Sin la extensión (privacidad) no se puede inferir que falta aceleración. */
export function isSoftwareRenderer(context: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const info = context.getExtension('WEBGL_debug_renderer_info');
    if (!info) return false;
    const renderer = context.getParameter(info.UNMASKED_RENDERER_WEBGL);
    return typeof renderer === 'string' && /basic render driver|swiftshader|llvmpipe|softpipe|software rasterizer/i.test(renderer);
  } catch {
    return false;
  }
}
