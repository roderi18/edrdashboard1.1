import { redirect } from 'next/navigation';

// La ficha real se carga en la ruta padre. Esta variante heredada solo
// buscaba miembros de prueba y podía fallar por una función inexistente.
export default async function Page({ params }) {
  const { id } = await params;
  redirect(`/dashboard/level/member/${encodeURIComponent(id)}/edit`);
}
