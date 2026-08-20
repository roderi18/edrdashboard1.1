import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { getLeadershipShortName } from 'src/utils/leadership-assignments';
import { getAvisoDatosPendientes } from 'src/utils/member-datos-pendientes';

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
    // Vacio cuando la ficha esta completa, y entonces no se pinta el aviso.
    avisoDatosPendientes: miembroAsignado ? getAvisoDatosPendientes(miembroAsignado) : '',
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
export function LeadershipNodeName({ identity, children, mostrarAvisoDatos = false, ...other }) {
  // Un cargo vacante no tiene ficha que completar.
  const aviso = !identity.vacante && mostrarAvisoDatos ? identity.avisoDatosPendientes : '';

  return renderNombre({ identity, children, aviso, other });
}

function renderNombre({ identity, children, aviso, other }) {
  return (
    <Typography
      variant="subtitle2"
      noWrap
      title={identity.nombreCompleto || undefined}
      sx={{
        mb: 0.5,
        pr: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        ...(identity.vacante && {
          fontStyle: 'italic',
          fontWeight: 'fontWeightRegular',
          color: 'text.secondary',
        }),
      }}
      {...other}
    >
      <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {identity.vacante ? identity.displayName : (children ?? identity.displayName)}
      </Box>

      {/* Aviso de ficha incompleta, a la derecha del nombre. */}
      {aviso && (
        <Tooltip title={aviso} placement="top" arrow>
          <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0 }}>
            <Iconify width={16} icon="solar:danger-triangle-bold" sx={{ color: 'warning.main' }} />
          </Box>
        </Tooltip>
      )}
    </Typography>
  );
}

// ----------------------------------------------------------------------
// Tarjeta de ESTRUCTURA: el Concilio, el Consejo Nacional, el Consejo Ejecutivo
// de una region... Cuerpos de los que cuelga la directiva, no cargos que alguien
// ocupe. Se dibujan con su logo y su nombre, sin "Vacante" y sin menu de
// asignar, para que no inviten a poner a nadie dentro.
//
// Vive aqui porque la usan los organigramas de nacion y de region; tenerla dos
// veces era garantia de que acabaran distintas.
// ----------------------------------------------------------------------
export function LeadershipStructureNode({ name, role, avatarUrl, sx, ...other }) {
  return (
    <Card
      sx={{
        px: 1.5,
        py: 1,
        gap: 1,
        ...LEADERSHIP_NODE_SIZE_SX,
        borderRadius: 1.5,
        textAlign: 'left',
        alignItems: 'center',
        display: 'inline-flex',
        ...sx,
      }}
      {...other}
    >
      {/* Sin logo no se pinta el hueco: un `img` sin `src` deja el icono de
          imagen rota. */}
      {avatarUrl && (
        <Box
          component="img"
          alt={name}
          src={avatarUrl}
          sx={{ width: 36, height: 36, flexShrink: 0, objectFit: 'contain' }}
        />
      )}

      <Box sx={{ minWidth: 0 }}>
        {/* El nombre se recorta para no ensanchar la tarjeta, asi que al pasar
            por encima se muestra entero. Tooltip de MUI y no el `title` del
            navegador: aquel tarda un segundo largo en aparecer, se ve distinto en
            cada sistema y no sigue el tema de la aplicacion. */}
        <Tooltip title={name} placement="top" arrow>
          <Typography variant="subtitle2" noWrap>
            {name}
          </Typography>
        </Tooltip>

        {/* El subtitulo solo cuando aporta algo: repetir el nombre debajo del
            nombre gasta una linea para no decir nada. */}
        {role && role !== name && (
          <Typography
            variant="caption"
            component="div"
            noWrap
            title={role}
            sx={{ color: 'text.secondary' }}
          >
            {role}
          </Typography>
        )}
      </Box>
    </Card>
  );
}
