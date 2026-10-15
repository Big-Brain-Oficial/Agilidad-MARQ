// Entrada táctil del recorrido. Los controles HTML (TouchControls) escriben acá y el visitante
// (Player) lo lee en cada cuadro: es un objeto mutable para no volver a dibujar React al mover el dedo.

export const touchInput = {
  /** Joystick: x hacia la derecha, y hacia adelante, cada uno entre -1 y 1. */
  moveX: 0,
  moveY: 0,
  /** El pulgar se estiró más allá del aro del joystick. */
  run: false,
  /** Arrastre para mirar, en píxeles acumulados desde el último cuadro. */
  lookX: 0,
  lookY: 0,
  reset() {
    this.moveX = this.moveY = this.lookX = this.lookY = 0;
    this.run = false;
  },
};

/**
 * iPhone o iPad. La primera versión táctil se limita a iOS; el resto de los celulares sigue con el
 * aviso. iPadOS se presenta como Mac, así que se reconoce por la pantalla táctil.
 */
export function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
