import { redirect } from 'next/navigation';

// Conservar el enlace heredado, pero abrir el editor que consulta la sección
// real en vez de depender de la lista de demostración.
export default async function Page({ params }) {
  const { id } = await params;
  redirect(`/dashboard/level/sectional/${encodeURIComponent(id)}/edit`);
}
