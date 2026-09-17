'use client';

import Grid from '@mui/material/Grid';

import { identidadDeLaSesion } from 'src/sections/principal/identidad-de-la-sesion';
import { PrincipalAccesos, PrincipalBienvenida } from 'src/sections/principal/principal-bienvenida';
import {
  PrincipalHistorias,
  PrincipalMiProgreso,
  PrincipalProximaActividad,
} from 'src/sections/principal/principal-actividad';
import {
  PrincipalLema,
  PrincipalEventos,
  PrincipalDestacado,
  PrincipalComunicados,
} from 'src/sections/principal/principal-lateral';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// UN BLOQUE DE LA PORTADA, PINTADO COMO EN LA PORTADA.
//
// La vista previa del Designer no dibuja una imitacion: usa LOS MISMOS
// componentes de /principal, con el contenido que se esta editando. Y los coloca
// con el MISMO ancho de columna que tienen alli —la columna lateral es un tercio,
// la proxima actividad comparte fila con el progreso—, porque una tarjeta que se
// ve bien a todo lo ancho puede partir el titulo en tres lineas en su hueco real.
//
// Todo va sin lapices ni marca de ejemplo: en la vista previa no se sube nada.
// ----------------------------------------------------------------------

// El ancho de cada bloque en la rejilla de la portada (`principal-home-view.jsx`).
const COLUMNA_PRINCIPAL = { xs: 12, lg: 8 };
const COLUMNA_LATERAL = { xs: 12, lg: 4 };

const COLOCACION = {
  bienvenida: null,
  'accesos-rapidos': [COLUMNA_PRINCIPAL],
  historias: [COLUMNA_PRINCIPAL],
  // Dentro de la columna principal, en la fila que comparte con "Mi progreso".
  'proxima-actividad': [COLUMNA_PRINCIPAL, { xs: 12, md: 7 }],
  'mi-progreso': [COLUMNA_PRINCIPAL, { xs: 12, md: 5 }],
  'proximos-eventos': [COLUMNA_LATERAL],
  'destacamento-destacado': [COLUMNA_LATERAL],
  comunicados: [COLUMNA_LATERAL],
  lema: [COLUMNA_LATERAL],
};

/** Los bloques que se pueden pintar sueltos. */
export const BLOQUES_CON_VISTA_PREVIA = Object.keys(COLOCACION);

function ComponenteDelBloque({ idBloque, contenido, diseno }) {
  const { user } = useAuthContext();

  switch (idBloque) {
    case 'bienvenida': {
      const identidad = identidadDeLaSesion(user);

      return (
        <PrincipalBienvenida
          nombre={identidad.nombre}
          destacamento={identidad.destacamento}
          region={identidad.region}
          foto={identidad.foto}
          resumen={contenido}
          diseno={diseno}
        />
      );
    }
    case 'accesos-rapidos':
      return <PrincipalAccesos accesos={contenido} diseno={diseno} />;
    case 'proxima-actividad':
      return <PrincipalProximaActividad actividad={contenido} diseno={diseno} />;
    case 'mi-progreso':
      return <PrincipalMiProgreso progreso={contenido} diseno={diseno} />;
    case 'historias':
      return <PrincipalHistorias historias={contenido} diseno={diseno} />;
    case 'proximos-eventos':
      return <PrincipalEventos eventos={contenido} diseno={diseno} />;
    case 'destacamento-destacado':
      return <PrincipalDestacado destacado={contenido} diseno={diseno} />;
    case 'comunicados':
      return <PrincipalComunicados comunicados={contenido} diseno={diseno} />;
    case 'lema':
      return <PrincipalLema lema={contenido} diseno={diseno} />;
    default:
      return null;
  }
}

export function BloqueDeLaPortada({ idBloque, contenido, diseno }) {
  if (!BLOQUES_CON_VISTA_PREVIA.includes(idBloque) || contenido == null) return null;

  const bloque = (
    <ComponenteDelBloque idBloque={idBloque} contenido={contenido} diseno={diseno ?? {}} />
  );
  const columnas = COLOCACION[idBloque];

  if (!columnas) return bloque;

  // Cada nivel de la rejilla envuelve al siguiente, como en la portada.
  return columnas.reduceRight(
    (dentro, tamano) => (
      <Grid container spacing={3}>
        <Grid size={tamano}>{dentro}</Grid>
      </Grid>
    ),
    bloque
  );
}
