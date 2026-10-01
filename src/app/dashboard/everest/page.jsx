import { redirect } from 'next/navigation';

import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------

// EXPLORA DESIGNER SE LLAMA /dashboard/explora-designer. La dirección vieja solo
// redirige, con su `?seccion=`: el Historial y los enlaces guardados apuntan aquí.
export default async function Page({ searchParams }) {
  const parametros = new URLSearchParams();
  Object.entries((await searchParams) || {}).forEach(([clave, valor]) => {
    [].concat(valor).forEach((v) => parametros.append(clave, v));
  });
  const consulta = parametros.toString();

  redirect(consulta ? `${paths.dashboard.everest}?${consulta}` : paths.dashboard.everest);
}
