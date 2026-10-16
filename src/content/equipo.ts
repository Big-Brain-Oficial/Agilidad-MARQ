// Cuadros del equipo en la pared derecha del hall de la Torre Natalini. Al clickear (o tocar) uno,
// se abre el perfil de LinkedIn de la persona. Las fotos viven en public/equipo/*.webp.
//
// El orden del arreglo define la grilla: 4 cuadros arriba y 4 abajo, de izquierda a derecha.
// La ubicación en la escena la calcula Cuadros.tsx a partir de esa posición en la lista.

export interface MiembroEquipo {
  /** Identificador estable (coincide con public/equipo/<id>.webp). */
  id: string;
  nombre: string;
  /** Perfil de LinkedIn que abre el cuadro. */
  linkedin: string;
}

export const EQUIPO: MiembroEquipo[] = [
  // Fila de arriba
  { id: 'jeronimo-zapata', nombre: 'Jerónimo Zapata', linkedin: 'https://www.linkedin.com/in/jeronimo-zapata/' },
  { id: 'paula-kozak', nombre: 'Paula Kozak', linkedin: 'https://www.linkedin.com/in/paula-kozak/' },
  // Foto pendiente: mientras tanto, una «Mona Lisa» ficticia (public/equipo/matias-lima.webp).
  { id: 'matias-lima', nombre: 'Matías Lima', linkedin: 'https://www.linkedin.com/in/matias-lima-266108375/' },
  { id: 'tomas-duarte', nombre: 'Tomás Duarte', linkedin: 'https://www.linkedin.com/in/tomas-duarte-27a133237/' },
  // Fila de abajo
  { id: 'lorenzo-arduino', nombre: 'Lorenzo Arduino', linkedin: 'https://www.linkedin.com/in/lorenzo-arduino-773432406/' },
  { id: 'matias-rodriguez-scornik', nombre: 'Matías Rodríguez Scornik', linkedin: 'https://www.linkedin.com/in/matias-rodriguez-scornik-/' },
  { id: 'ivo-sodja', nombre: 'Ivo Sodja', linkedin: 'https://www.linkedin.com/in/ivo-sodja-a94b2b306/' },
  { id: 'gonzalo-orban', nombre: 'Gonzalo Orban', linkedin: 'https://www.linkedin.com/in/gonzaorban/' },
];
