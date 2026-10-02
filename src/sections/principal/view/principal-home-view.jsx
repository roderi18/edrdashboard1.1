'use client';

import { useRef, useMemo } from 'react';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

import { isAdminGlobal } from 'src/utils/org-level-access';

import { DashboardContent } from 'src/layouts/dashboard';

import { useAuthContext } from 'src/auth/hooks';

import { ProfileHome } from '../../user/profile-home';
import { LienzoDelBloque } from '../lienzo-del-bloque';
import { HAY_DATOS_DE_EJEMPLO } from '../datos-de-ejemplo';
import { PrincipalBienvenida } from '../principal-bienvenida';
import { useContenidoDePortada } from '../use-contenido-de-portada';
import { useAnaliticasDePortada } from '../use-analiticas-de-portada';
import { alcanceDeLaSesion, identidadDeLaSesion } from '../identidad-de-la-sesion';
import { PrincipalHistorias, PrincipalProximaActividad } from '../principal-actividad';
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
        <LienzoDelBloque diseno={portada.bienvenida.diseno}>
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
        </LienzoDelBloque>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Stack spacing={3}>
              {/* LA PRÓXIMA ACTIVIDAD, SOLA EN SU FILA Y EN 21:9, con sus combos a la
                  derecha dentro del mismo contenedor. "Mi progreso" salió de la
                  portada: sus cifras eran las mismas para todos; el bloque sigue
                  en el Designer. */}
              <LienzoDelBloque diseno={portada['proxima-actividad'].diseno}>
                <PrincipalProximaActividad
                  actividad={portada['proxima-actividad'].contenido}
                  diseno={portada['proxima-actividad'].diseno}
                  puedeEditar={esAdministradorGlobal}
                  // "Inscribirme" ofrece los combos de la tienda (solo aquí, no en
                  // la vista previa del Designer).
                  conInscripcion
                />
              </LienzoDelBloque>

              <LienzoDelBloque diseno={portada.historias.diseno}>
                <PrincipalHistorias
                  historias={portada.historias.contenido}
                  diseno={portada.historias.diseno}
                  esEjemplo={esDeEjemplo(portada.historias)}
                  puedeEditar={esAdministradorGlobal}
                />
              </LienzoDelBloque>

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
              <LienzoDelBloque diseno={portada['proximos-eventos'].diseno}>
                <PrincipalEventos
                  eventos={portada['proximos-eventos'].contenido}
                  diseno={portada['proximos-eventos'].diseno}
                  esEjemplo={esDeEjemplo(portada['proximos-eventos'])}
                  puedeEditar={esAdministradorGlobal}
                />
              </LienzoDelBloque>

              <LienzoDelBloque diseno={portada['destacamento-destacado'].diseno}>
                <PrincipalDestacado
                  destacado={portada['destacamento-destacado'].contenido}
                  diseno={portada['destacamento-destacado'].diseno}
                  esEjemplo={esDeEjemplo(portada['destacamento-destacado'])}
                  puedeEditar={esAdministradorGlobal}
                />
              </LienzoDelBloque>

              <LienzoDelBloque diseno={portada.comunicados.diseno}>
                <PrincipalComunicados
                  comunicados={portada.comunicados.contenido}
                  diseno={portada.comunicados.diseno}
                  esEjemplo={esDeEjemplo(portada.comunicados)}
                  puedeEditar={esAdministradorGlobal}
                />
              </LienzoDelBloque>

              <LienzoDelBloque diseno={portada.lema.diseno}>
                <PrincipalLema
                  lema={portada.lema.contenido}
                  diseno={portada.lema.diseno}
                  puedeEditar={esAdministradorGlobal}
                />
              </LienzoDelBloque>
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    </DashboardContent>
  );
}
