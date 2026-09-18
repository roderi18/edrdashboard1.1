import { redirect } from 'next/navigation';

import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------

// LA PALETA SE MUDO A EXPLORA DESIGNER (pestaña "Paleta"). La direccion vieja se
// queda solo para redirigir: habia enlaces y marcadores apuntando aqui, y sin
// esto daban 404.
export default function Page() {
  redirect(paths.dashboard.admin.paleta);
}
