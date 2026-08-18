import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';

import { getLeadershipShortName } from 'src/utils/leadership-assignments';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// Identidad del nodo del organigrama: quien ocupa el cargo, o la marca de
// vacante.
//
// Los nodos se rellenaban con `_mock.fullName()` y una foto de `_mock.image`, de
// modo que un cargo SIN ocupante mostraba el nombre y la cara de una persona
// inventada, indistinguible de una real en un organigrama que se imprime y se
// comparte. Ahora un cargo libre se ve como lo que es.
// ----------------------------------------------------------------------

export const ETIQUETA_VACANTE = 'Vacante';

// ----------------------------------------------------------------------
// Tamano de la tarjeta del organigrama.
//
// ANCHO FIJO, no minimo. Con `minWidth` la tarjeta se ensanchaba para que cupiera
// el nombre del ocupante, empujaba a sus hermanas y arrastraba las lineas del
// diagrama: el organigrama cambiaba de forma segun a quien se asignara, y con un
// nombre largo la fila se salia del contenedor. Con el ancho fijo la reticula no
// depende del contenido — las tarjetas y las lineas se quedan donde estan — y lo
// que no cabe se recorta DENTRO de la tarjeta, que ya lleva `noWrap` en el nombre
// y en el cargo (el nombre completo sigue disponible en el tooltip).
//
// Se comparte entre los cuatro organigramas (nacion, region, seccion y
// destacamento) para que todos tengan la misma reticula y el mismo hueco.
// ----------------------------------------------------------------------
export const LEADERSHIP_NODE_WIDTH = 200;

export const LEADERSHIP_NODE_SIZE_SX = {
  width: LEADERSHIP_NODE_WIDTH,
  // Por si el contenedor es mas estrecho que la tarjeta: antes que desbordar,
  // se encoge.
  maxWidth: '100%',
};

export { getLeadershipShortName };

// Nombre COMPLETO. Es el que va en los diálogos y en los avisos: abreviar ahí
// perdería información justo cuando hace falta identificar a la persona.
export const getMemberDisplayName = (member = {}) =>
  [member?.nombres ?? member?.firstName, member?.apellidos ?? member?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() ||
  member?.name ||
  member?.codigoMiembro ||
  '';

// `miembroAsignado` es null cuando el cargo esta libre.
export const getLeadershipNodeIdentity = (miembroAsignado) => {
  const displayName = miembroAsignado ? getLeadershipShortName(miembroAsignado) : '';

  return {
    vacante: !displayName,
    displayName: displayName || ETIQUETA_VACANTE,
    // El nombre completo queda en el tooltip: la tarjeta abrevia, pero saber de
    // quién se trata no debería obligar a abrir la ficha.
    nombreCompleto: miembroAsignado ? getMemberDisplayName(miembroAsignado) : '',
    avatarUrl: miembroAsignado
      ? miembroAsignado.avatarUrl || miembroAsignado.photoURL || ''
      : '',
  };
};

export function LeadershipNodeAvatar({ identity, size = 48 }) {
  if (identity.vacante) {
    return (
      <Avatar
        alt={ETIQUETA_VACANTE}
        sx={{
          width: 1,
          height: 1,
          color: 'text.disabled',
          bgcolor: 'action.selected',
        }}
      >
        <Iconify icon="solar:user-bold" width={Math.round(size * 0.58)} />
      </Avatar>
    );
  }

  return (
    <Avatar alt={identity.displayName} src={identity.avatarUrl} sx={{ width: 1, height: 1 }}>
      {String(identity.displayName || '?').charAt(0)}
    </Avatar>
  );
}

// `children` permite envolver el nombre (el organigrama del destacamento lo
// enlaza a la ficha del miembro). Sin ocupante nunca hay enlace, asi que la
// marca de vacante manda.
export function LeadershipNodeName({ identity, children, ...other }) {
  return (
    <Typography
      variant="subtitle2"
      noWrap
      title={identity.nombreCompleto || undefined}
      sx={{
        mb: 0.5,
        pr: 3,
        ...(identity.vacante && {
          fontStyle: 'italic',
          fontWeight: 'fontWeightRegular',
          color: 'text.secondary',
        }),
      }}
      {...other}
    >
      {identity.vacante ? identity.displayName : (children ?? identity.displayName)}
    </Typography>
  );
}
