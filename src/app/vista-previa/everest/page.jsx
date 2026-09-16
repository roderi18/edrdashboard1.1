import { CONFIG } from 'src/global-config';

import { EverestVistaPreviaView } from 'src/sections/everest/view';

import { AuthGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------
// LA VISTA PREVIA DE EVEREST DESIGNER, la que va dentro de su iframe.
//
// Vive FUERA de /dashboard a proposito: alli cada pagina lleva el menu lateral y
// la cabecera, y dentro del recuadro de la vista previa solo tiene que estar el
// bloque. El tema, la sesion y los ajustes llegan igual, del layout raiz; la
// proteccion de sesion se pone aqui a mano, como la pone el panel.
// ----------------------------------------------------------------------

export const metadata = { title: `Vista previa | EVEREST Designer - ${CONFIG.appName}` };

export default function Page() {
  if (CONFIG.auth.skip) {
    return <EverestVistaPreviaView />;
  }

  return (
    <AuthGuard>
      <EverestVistaPreviaView />
    </AuthGuard>
  );
}
