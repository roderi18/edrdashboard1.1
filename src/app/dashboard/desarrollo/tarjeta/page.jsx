import { redirect } from 'next/navigation';

import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------

// LA TARJETA EDITABLE SE MUDÓ A EXPEDITION DESIGNER (pestaña "Tarjeta"). La
// dirección vieja solo redirige: sin esto, un enlace guardado daba 404.
export default function Page() {
  redirect(paths.dashboard.everestTarjeta);
}
