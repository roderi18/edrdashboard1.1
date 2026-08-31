'use client';

import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useEntidadEnSuAlcance } from './use-entidad-en-su-alcance';

// ----------------------------------------------------------------------
// A lo ajeno no se entra, ni con el enlace pegado.
//
// La lista ya muestra solo lo suyo, pero la ficha se abria escribiendo la URL.
// Esto pregunta lo MISMO que la lista —los mismos filtros de alcance— y, si no
// es suyo, enseña el aviso en lugar de la ficha.
//
// Mientras se resuelve no se pinta nada: enseñar la ficha y quitarla despues
// seria enseñar justo lo que no se puede ver.
// ----------------------------------------------------------------------

export function CandadoDeAlcance({ tipo, id, titulo, volverA, etiquetaVolver, children }) {
  const estado = useEntidadEnSuAlcance({ tipo, id });

  if (estado === 'resolviendo') {
    return <DashboardContent />;
  }

  if (estado === 'fuera') {
    return (
      <DashboardContent>
        <CustomBreadcrumbs
          heading={etiquetaVolver}
          links={[
            { name: 'Panel', href: paths.dashboard.root },
            { name: etiquetaVolver, href: volverA },
          ]}
          sx={{ mb: 3 }}
        />

        <Alert severity="info" sx={{ alignItems: 'center' }}>
          <AlertTitle>{titulo}</AlertTitle>
          Puedes ver que existe en la lista, pero su ficha solo la abre quien responde por ella.
        </Alert>
      </DashboardContent>
    );
  }

  return children;
}
