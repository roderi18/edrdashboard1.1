import { redirect } from 'next/navigation';

import { paths } from 'src/routes/paths';

// El mapa se mudó a "Datos demográficos" (debajo de Asistencias). Los enlaces
// viejos a /pruebas siguen funcionando: llevan allí.
export default function Page() {
  redirect(paths.dashboard.level.datosDemograficos);
}
