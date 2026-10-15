import type { Metadata } from 'next';
import { UnrealExperience } from '@/components/unreal/UnrealExperience';

export const metadata: Metadata = {
  title: 'Natalini · Prototipo Unreal · MARQ',
  robots: { index: false, follow: false },
};

// URL del reproductor oficial de Epic, no del socket de señalización.
function playerUrl(): string | null {
  const value = process.env.MARQ_UNREAL_PLAYER_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) return null;
    return url.href;
  } catch {
    return null;
  }
}

export default function UnrealPage() {
  return <UnrealExperience playerUrl={playerUrl()} />;
}
