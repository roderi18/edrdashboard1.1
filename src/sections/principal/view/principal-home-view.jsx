'use client';

import { useRef, useMemo } from 'react';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

import { isAdminGlobal } from 'src/utils/org-level-access';

import { DashboardContent } from 'src/layouts/dashboard';

import { useSettingsContext } from 'src/components/settings';

import { useAuthContext } from 'src/auth/hooks';

import { ProfileHome } from '../../user/profile-home';
import { HAY_DATOS_DE_EJEMPLO } from '../datos-de-ejemplo';
import { useContenidoDePortada } from '../use-contenido-de-portada';
import { useAnaliticasDePortada } from '../use-analiticas-de-portada';
import { PrincipalAccesos, PrincipalBienvenida } from '../principal-bienvenida';
import { alcanceDeLaSesion, identidadDeLaSesion } from '../identidad-de-la-sesion';
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
// Cada uno de esos bloques se puede publicar desde EXPLORA Designer —contenido y
// diseño—. Hasta que alguien lo publique, sale exactamente lo de siempre: la
// pantalla ya no importa los datos a mano, se los pide a `useContenidoDePortada`.
//
// El Administrador Global ve un lapiz en cada tarjeta que lleva a ese bloque en
// el Designer. Los demas no ven nada distinto.
// ----------------------------------------------------------------------

// La marca "Ejemplo" solo tiene sentido sobre lo inventado: un bloque publicado
// desde EXPLORA Designer ya no es un ejemplo, aunque la bandera vuelva a encenderse.
const esDeEjemplo = (bloque) => HAY_DATOS_DE_EJEMPLO && bloque.origen === 'codigo';

export function PrincipalHomeView() {
  const { user } = useAuthContext();
  const settings = useSettingsContext();
  const accesosVisibles = settings.state.accesosRapidos === true;
  // CADA BLOQUE, DE LO PUBLICADO O DE LO DE SIEMPRE. Mientras nadie publique nada
  // desde EXPLORA Designer, esto devuelve exactamente los mismos datos que antes
  // se importaban a mano de `datos-de-ejemplo.js` (ver `useContenidoDePortada`).
  const quien = useMemo(() => alcanceDeLaSesion(user), [user]);
  const portada = useContenidoDePortada({ quien });

  const identidad = useMemo(() => identidadDeLaSesion(user), [user]);
  const esAdministradorGlobal = isAdminGlobal(user);

  // Cuantas veces se ve y se pulsa cada bloque (sin contar al Administrador Global).
  const raizRef = useRef(null);
  const alPulsar = useAnaliticasDePortada({ raizRef, portada, activo: !esAdministradorGlobal });

  return (
    <DashboardContent maxWidth="xl">
      <Stack ref={raizRef} spacing={3} onClickCapture={alPulsar}>
        <PrincipalBienvenida
          nombre={identidad.nombre}
          destacamento={identidad.destacamento}
          region={identidad.region}
          foto={identidad.foto}
          resumen={portada.bienvenida.contenido}
          diseno={portada.bienvenida.diseno}
          esEjemplo={esDeEjemplo(portada.bienvenida)}
          puedeEditar={esAdministradorGlobal}
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
                <PrincipalAccesos
                  accesos={portada['accesos-rapidos'].contenido}
                  diseno={portada['accesos-rapidos'].diseno}
                  puedeEditar={esAdministradorGlobal}
                />
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
                    diseno={portada['proxima-actividad'].diseno}
                    puedeEditar={esAdministradorGlobal}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>
                  <PrincipalMiProgreso
                    progreso={portada['mi-progreso'].contenido}
                    diseno={portada['mi-progreso'].diseno}
                    esEjemplo={esDeEjemplo(portada['mi-progreso'])}
                    puedeEditar={esAdministradorGlobal}
                  />
                </Grid>
              </Grid>

              <PrincipalHistorias
                historias={portada.historias.contenido}
                diseno={portada.historias.diseno}
                esEjemplo={esDeEjemplo(portada.historias)}
                puedeEditar={esAdministradorGlobal}
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
                diseno={portada['proximos-eventos'].diseno}
                esEjemplo={esDeEjemplo(portada['proximos-eventos'])}
                puedeEditar={esAdministradorGlobal}
              />

              <PrincipalDestacado
                destacado={portada['destacamento-destacado'].contenido}
                diseno={portada['destacamento-destacado'].diseno}
                esEjemplo={esDeEjemplo(portada['destacamento-destacado'])}
                puedeEditar={esAdministradorGlobal}
              />

              <PrincipalComunicados
                comunicados={portada.comunicados.contenido}
                diseno={portada.comunicados.diseno}
                esEjemplo={esDeEjemplo(portada.comunicados)}
                puedeEditar={esAdministradorGlobal}
              />

              <PrincipalLema
                lema={portada.lema.contenido}
                diseno={portada.lema.diseno}
                puedeEditar={esAdministradorGlobal}
              />
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    </DashboardContent>
  );
}
