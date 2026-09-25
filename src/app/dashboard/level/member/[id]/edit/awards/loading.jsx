import { AwardsTabSkeleton } from 'src/sections/member/awards/awards-manager-skeleton';

// La forma de la pestaña (buscador, progreso y filas), no un esqueleto genérico:
// al llegar los datos no se mueve nada.
export default function Loading() {
  return <AwardsTabSkeleton />;
}
