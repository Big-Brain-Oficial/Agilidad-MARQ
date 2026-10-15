import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/components/unreal/UnrealExperience.module.css';

export const metadata: Metadata = {
  title: 'Natalini · Comparación de experiencias',
  robots: { index: false, follow: false },
};

export default function EvaluacionNatalini() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <Link href="/" className={styles.back}>← Volver al mapa</Link>
        <p className={styles.kicker}>MARQ · Evaluación interna</p>
        <h1>Una torre. Dos experiencias.</h1>
        <p className={styles.lead}>Compará los materiales, la luz y la respuesta al moverte antes de elegir la presentación para el cliente.</p>
        <div className={styles.cards}>
          <section className={styles.card}>
            <span className={styles.badge}>Recorrido actual</span>
            <h2>Three.js</h2>
            <p>Edificio, entorno urbano y ascensor. Se ejecuta directamente en tu navegador.</p>
            <Link className="btn btn-primary" href="/recorrido/torre-natalini">Abrir Three.js</Link>
          </section>
          <section className={styles.card}>
            <span className={styles.badge}>Prototipo visual</span>
            <h2>Unreal Engine</h2>
            <p>Iluminación con Lumen y navegación libre. Requiere que la sesión de Unreal esté encendida.</p>
            <p className={styles.note}>El ascensor y las interacciones todavía no están adaptados a esta versión.</p>
            <Link className="btn btn-primary" href="/recorrido/torre-natalini/unreal">Abrir Unreal Engine</Link>
          </section>
        </div>
        <p className={styles.note}>Usá el mismo equipo y conexión para comparar. Revisá el acceso, el estar y el balcón, tanto al detenerte como al girar la cámara.</p>
      </div>
    </main>
  );
}
