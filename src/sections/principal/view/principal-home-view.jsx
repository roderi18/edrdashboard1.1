'use client';

import { useMemo } from 'react';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

import { isAdminGlobal } from 'src/utils/org-level-access';

import { DashboardContent } from 'src/layouts/dashboard';

import { useSettingsContext } from 'src/components/settings';

import { useAuthContext } from 'src/auth/hooks';

import { ProfileHome } from '../../user/profile-home';
import { HAY_DATOS_DE_EJEMPLO } from '../datos-de-ejemplo';
import { identidadDeLaSesion } from '../identidad-de-la-sesion';
import { useContenidoDePortada } from '../use-contenido-de-portada';
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
//
// Cada uno de esos bloques se puede publicar desde EVEREST Designer. Hasta que
// alguien lo publique, sale exactamente lo de siempre: la pantalla ya no importa
// los datos a mano, se los pide a `useContenidoDePortada`.
// ----------------------------------------------------------------------

// La marca "Ejemplo" solo tiene sentido sobre lo inventado: un bloque publicado
// desde EVEREST Designer ya no es un ejemplo, aunque la bandera vuelva a encenderse.
const esDeEjemplo = (bloque) => HAY_DATOS_DE_EJEMPLO && bloque.origen === 'codigo';

export function PrincipalHomeView() {
  const { user } = useAuthContext();
  const settings = useSettingsContext();
  const accesosVisibles = settings.state.accesosRapidos === true;
  // CADA BLOQUE, DE LO PUBLICADO O DE LO DE SIEMPRE. Mientras nadie publique nada
  // desde EVEREST Designer, esto devuelve exactamente los mismos datos que antes
  // se importaban a mano de `datos-de-ejemplo.js` (ver `useContenidoDePortada`).
  const portada = useContenidoDePortada();

  const identidad = useMemo(() => identidadDeLaSesion(user), [user]);

  return (
    <DashboardContent maxWidth="xl">
      <Stack spacing={3}>
        <PrincipalBienvenida
          nombre={identidad.nombre}
          destacamento={identidad.destacamento}
          region={identidad.region}
          foto={identidad.foto}
          resumen={portada.bienvenida.contenido}
          esEjemplo={esDeEjemplo(portada.bienvenida)}
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
                  son atajos a sitios que tambien estan en el menu. Solo aparecen
                  cuando el usuario los activa de forma expresa. */}
              {accesosVisibles && (
                <PrincipalAccesos accesos={portada['accesos-rapidos'].contenido} />
              )}

              {/* LA ACTIVIDAD Y EL PROGRESO, EN LA MISMA FILA. Las dos responden
                  a "¿que tengo por delante?" desde dos lados: la fecha que viene
                  y lo que falta para el siguiente nivel.

                  El hueco entre las dos es el MISMO que separa "Mi progreso" de la
                  columna de eventos (`spacing={3}`, 24px): se probo con mas aire y
                  la fila se leia descuadrada respecto al resto de la pantalla. */}
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 7 }}>
                  <PrincipalProximaActividad
                    actividad={portada['proxima-actividad'].contenido}
                    puedeEditar={isAdminGlobal(user)}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>
                  <PrincipalMiProgreso
                    progreso={portada['mi-progreso'].contenido}
                    esEjemplo={esDeEjemplo(portada['mi-progreso'])}
                  />
                </Grid>
              </Grid>

              <PrincipalHistorias
                historias={portada.historias.contenido}
                esEjemplo={esDeEjemplo(portada.historias)}
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
              <PrincipalEventos
                eventos={portada['proximos-eventos'].contenido}
                esEjemplo={esDeEjemplo(portada['proximos-eventos'])}
              />

              <PrincipalDestacado
                destacado={portada['destacamento-destacado'].contenido}
                esEjemplo={esDeEjemplo(portada['destacamento-destacado'])}
              />

              <PrincipalComunicados
                comunicados={portada.comunicados.contenido}
                esEjemplo={esDeEjemplo(portada.comunicados)}
              />

              <PrincipalLema lema={portada.lema.contenido} />
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    </DashboardContent>
  );
}
