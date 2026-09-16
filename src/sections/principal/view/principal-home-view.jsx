'use client';

import { useMemo } from 'react';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

import { isAdminGlobal } from 'src/utils/org-level-access';

import { DashboardContent } from 'src/layouts/dashboard';

import { useSettingsContext } from 'src/components/settings';

import { useAuthContext } from 'src/auth/hooks';

import { ProfileHome } from '../../user/profile-home';
import { PrincipalAccesos, PrincipalBienvenida } from '../principal-bienvenida';
import {
  PrincipalHistorias,
  PrincipalMiProgreso,
  PrincipalProximaActividad,
} from '../principal-actividad';
import {
  PrincipalLema,
  PrincipalEventos,
  PrincipalDestacado,
  PrincipalComunicados,
} from '../principal-lateral';
import {
  ACCESOS_RAPIDOS,
  EVENTOS_DE_EJEMPLO,
  RESUMEN_DE_EJEMPLO,
  HAY_DATOS_DE_EJEMPLO,
  HISTORIAS_DE_EJEMPLO,
  COMUNICADOS_DE_EJEMPLO,
  MI_PROGRESO_DE_EJEMPLO,
  PROXIMA_ACTIVIDAD_DE_EJEMPLO,
  DESTACAMENTO_DESTACADO_DE_EJEMPLO,
} from '../datos-de-ejemplo';

// ----------------------------------------------------------------------
// LA PANTALLA PRINCIPAL.
//
// Se rediseño a partir de una maqueta. Lo que manda es el ORDEN: al entrar, uno
// quiere saber en este orden quien es y como va, que puede hacer ahora mismo,
// que tiene por delante, y que se cuenta la gente. Por eso la bienvenida arriba,
// los accesos debajo, y el muro al final —que es lo que mas espacio pide y lo
// unico que uno se queda leyendo—.
//
// El muro NO se rehizo: es `ProfileHome`, el mismo de siempre, con publicar,
// comentar, reaccionar y paginar funcionando. Entra con `soloMuro` para que no
// pinte su propia columna lateral, que aqui la pone esta pantalla.
//
// Lo que sale de datos de verdad: tu nombre, tu destacamento, tu region, tu foto
// y el muro entero. Lo demas son datos de EJEMPLO y cada panel lo dice encima
// (ver `datos-de-ejemplo.js`).
// ----------------------------------------------------------------------

const nombreDeLaSesion = (user) =>
  user?.displayName ||
  [user?.nombres, user?.apellidos].filter(Boolean).join(' ').trim() ||
  user?.nombre ||
  user?.email ||
  'Explorador';

const destacamentoDeLaSesion = (user) => {
  const nombre =
    user?.nombreDestacamento || user?.destacamentoName || user?.destName || user?.destacamento;

  if (nombre) return String(nombre);

  const numero = user?.numeroDestacamento || user?.destNumber;

  return numero ? `Destacamento ${numero}` : '';
};

const regionDeLaSesion = (user) =>
  user?.nombreRegion || user?.regionName || user?.regionalName || user?.region || '';

export function PrincipalHomeView() {
  const { user } = useAuthContext();
  const settings = useSettingsContext();
  const accesosVisibles = settings.state.accesosRapidos !== false;

  const identidad = useMemo(
    () => ({
      nombre: nombreDeLaSesion(user),
      destacamento: destacamentoDeLaSesion(user),
      region: regionDeLaSesion(user),
      foto: user?.photoURL || user?.avatarUrl || '',
    }),
    [user]
  );

  return (
    <DashboardContent maxWidth="xl">
      <Stack spacing={3}>
        <PrincipalBienvenida
          nombre={identidad.nombre}
          destacamento={identidad.destacamento}
          region={identidad.region}
          foto={identidad.foto}
          resumen={RESUMEN_DE_EJEMPLO}
          esEjemplo={HAY_DATOS_DE_EJEMPLO}
          puedeEditar={isAdminGlobal(user)}
        />

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Stack spacing={3}>
              {/* LOS ACCESOS, DENTRO DE ESTA COLUMNA Y NO A TODO LO ANCHO.
                  Ocupaban el ancho entero de la pagina, por encima de la rejilla,
                  y con cuatro tarjetas repartidas en 1045 pixeles quedaban
                  separadas por franjas de nada. Aqui miden lo mismo que la fila de
                  abajo y las tres piezas se leen como una sola columna.

                  Se pueden apagar desde el panel de ajustes ("Accesos rápidos"):
                  son atajos a sitios que tambien estan en el menu. Se pregunta por
                  `!== false` porque las sesiones que guardaron sus ajustes antes
                  de que existiera la clave no la tienen, y ahi vale "encendido". */}
              {accesosVisibles && <PrincipalAccesos accesos={ACCESOS_RAPIDOS} />}

              {/* LA ACTIVIDAD Y EL PROGRESO, EN LA MISMA FILA. Las dos responden
                  a "¿que tengo por delante?" desde dos lados: la fecha que viene
                  y lo que falta para el siguiente nivel.

                  El hueco entre las dos es el MISMO que separa "Mi progreso" de la
                  columna de eventos (`spacing={3}`, 24px): se probo con mas aire y
                  la fila se leia descuadrada respecto al resto de la pantalla. */}
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 7 }}>
                  <PrincipalProximaActividad
                    actividad={PROXIMA_ACTIVIDAD_DE_EJEMPLO}
                    puedeEditar={isAdminGlobal(user)}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>
                  <PrincipalMiProgreso
                    progreso={MI_PROGRESO_DE_EJEMPLO}
                    esEjemplo={HAY_DATOS_DE_EJEMPLO}
                  />
                </Grid>
              </Grid>

              <PrincipalHistorias
                historias={HISTORIAS_DE_EJEMPLO}
                esEjemplo={HAY_DATOS_DE_EJEMPLO}
              />

              {/* EL MURO, TAL CUAL. `posts` vacio: las publicaciones las trae el
                  propio componente de Firestore al montarse. */}
              <ProfileHome soloMuro user={user} posts={[]} info={{}} />
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }}>
            {/* LA COLUMNA FIJA SE DESPLAZA SOLA. Iba `sticky` sin tope de alto y
                es mas alta que la pantalla: se quedaba quieta mientras bajaba el
                muro, y los comunicados y el lema no se alcanzaban hasta el final
                de la pagina. Ahora mide como mucho lo que queda de ventana bajo la
                cabecera y tiene su propio desplazamiento: con el raton encima, la
                rueda la mueve a ella, y al llegar a su final sigue la pagina.

                Sin barra visible, como el muro de al lado. El relleno de 4px y su
                margen negativo son para que el recorte no se coma la sombra de las
                tarjetas. */}
            <Stack
              spacing={3}
              sx={{
                top: 96,
                alignSelf: 'flex-start',
                position: { lg: 'sticky' },
                maxHeight: { lg: 'calc(100vh - 96px)' },
                overflowY: { lg: 'auto' },
                p: { lg: 0.5 },
                m: { lg: -0.5 },
                pb: { lg: 3 },
                // Sin esto las tarjetas se aplastaban para caber en vez de
                // desbordar: una `Card` recorta lo suyo, asi que la columna flex
                // la encogia y no quedaba nada que desplazar.
                '& > *': { flexShrink: 0 },
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              <PrincipalEventos eventos={EVENTOS_DE_EJEMPLO} esEjemplo={HAY_DATOS_DE_EJEMPLO} />

              <PrincipalDestacado
                destacado={DESTACAMENTO_DESTACADO_DE_EJEMPLO}
                esEjemplo={HAY_DATOS_DE_EJEMPLO}
              />

              <PrincipalComunicados
                comunicados={COMUNICADOS_DE_EJEMPLO}
                esEjemplo={HAY_DATOS_DE_EJEMPLO}
              />

              <PrincipalLema />
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    </DashboardContent>
  );
}
