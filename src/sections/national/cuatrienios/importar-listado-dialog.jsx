'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { nombreCompleto } from 'src/utils/directiva-cuatrienios.mjs';

import { ID_CUATRIENIO_LISTADO } from 'src/catalogs/directiva-2022-2026.mjs';
import {
  ejecutarImportacion,
  puedeImportarListado,
  planificarImportacion,
} from 'src/services/directiva-importacion-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Carga del listado 2022-2026, en dos pasos: primero se ENSEÑA lo que va a pasar
// (que se crea en el padron, quien ya existe, que se ignora) y solo al confirmar
// se escribe. Crear secciones y miembros en el padron es irreversible desde
// aqui, asi que nada se crea sin haberlo visto antes.
// ----------------------------------------------------------------------

function Resumen({ titulo, cantidad, color = 'default', children }) {
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="subtitle2">{titulo}</Typography>
        <Label color={color} variant="soft">
          {cantidad}
        </Label>
      </Stack>
      {children}
    </Box>
  );
}

function ListaCorta({ filas }) {
  if (!filas.length) return null;

  return (
    <List dense disablePadding sx={{ maxHeight: 180, overflow: 'auto' }}>
      {filas.map((texto, indice) => (
        <ListItem key={`${texto}-${indice}`} disableGutters sx={{ py: 0 }}>
          <ListItemText primary={texto} slotProps={{ primary: { variant: 'body2' } }} />
        </ListItem>
      ))}
    </List>
  );
}

export function ImportarListadoDialog({ usuario, onClose, onTerminado }) {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [progreso, setProgreso] = useState('');
  const puedeCargar = puedeImportarListado(usuario);

  useEffect(() => {
    let cancelado = false;

    planificarImportacion()
      .then((resultado) => {
        if (!cancelado) setPlan(resultado);
      })
      .catch((errorPlan) => {
        if (!cancelado) setError(errorPlan?.message || 'No se pudo revisar el padrón.');
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const cargar = async () => {
    setProgreso('Empezando…');

    try {
      const resultado = await ejecutarImportacion({ usuario, alAvanzar: setProgreso });

      toast.success(
        `Directiva ${ID_CUATRIENIO_LISTADO} cargada: ${resultado.integrantes} integrantes, ${resultado.creadas} miembros nuevos.`
      );
      onTerminado();
    } catch (errorCarga) {
      setError(errorCarga?.message || 'La carga se detuvo.');
      setProgreso('');
    }
  };

  const entidadesACrear = plan?.entidades.filter((entidad) => !entidad.existente) ?? [];
  const personasACrear = plan?.personas.filter((persona) => persona.accion === 'crear') ?? [];
  const personasExistentes = plan?.personas.filter((persona) => persona.accion === 'existe') ?? [];
  const personasDudosas = plan?.personas.filter((persona) => persona.accion === 'dudosa') ?? [];

  return (
    <Dialog open fullWidth maxWidth="md" onClose={progreso ? undefined : onClose}>
      <DialogTitle>Cargar la Directiva {ID_CUATRIENIO_LISTADO}</DialogTitle>

      <DialogContent>
        {!plan && !error && (
          <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Revisando el padrón…
            </Typography>
          </Stack>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {plan && (
          <Stack spacing={2.5}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Esto es lo que va a pasar. Nada se escribe hasta que pulses «Cargar». Se puede
              repetir: lo que ya exista no se vuelve a crear.
            </Typography>

            <Resumen titulo="Integrantes que se guardan" cantidad={plan.integrantes.length}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {plan.integrantes.filter((fila) => fila.yaGuardado).length} ya estaban guardados y
                se actualizan. {plan.vacantes} casillas vacantes no se agregan.
              </Typography>
            </Resumen>

            <Resumen
              titulo="Regiones y secciones que se crean en el padrón"
              cantidad={entidadesACrear.length}
              color={entidadesACrear.length ? 'warning' : 'default'}
            >
              <ListaCorta
                filas={entidadesACrear.map((entidad) =>
                  entidad.region ? `${entidad.nombre} (en ${entidad.region})` : entidad.nombre
                )}
              />
            </Resumen>

            <Resumen
              titulo="Miembros nuevos en el destacamento Provisional"
              cantidad={personasACrear.length}
              color={personasACrear.length ? 'warning' : 'default'}
            >
              <ListaCorta filas={personasACrear.map((persona) => nombreCompleto(persona))} />
            </Resumen>

            <Resumen
              titulo="Ya están en el padrón"
              cantidad={personasExistentes.length}
              color="success"
            >
              <ListaCorta
                filas={personasExistentes.map(
                  (persona) => `${nombreCompleto(persona)} · ${persona.miembro?.memberId || ''}`
                )}
              />
            </Resumen>

            {personasDudosas.length > 0 && (
              <Resumen
                titulo="Nombre repetido en el padrón"
                cantidad={personasDudosas.length}
                color="error"
              >
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Hay más de un miembro con ese nombre. Se guardan sin enlazar y se corrigen a mano.
                </Typography>
                <ListaCorta filas={personasDudosas.map((persona) => nombreCompleto(persona))} />
              </Resumen>
            )}

            <Resumen titulo="Posiciones ignoradas por repetidas" cantidad={plan.ignorados.length}>
              <ListaCorta
                filas={plan.ignorados.map(
                  (fila) => `${fila.nombre} — ${fila.posicion}. ${fila.motivo}`
                )}
              />
            </Resumen>

            {!puedeCargar && (
              <Alert severity="info">
                La carga crea secciones y miembros en el padrón: solo la puede hacer el
                Administrador Global. Puedes revisar el plan y corregir la directiva a mano.
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        {progreso && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" noWrap>
              {progreso}
            </Typography>
          </Stack>
        )}
        <Button color="inherit" onClick={onClose} disabled={Boolean(progreso)}>
          Cerrar
        </Button>
        {puedeCargar && (
          <Button variant="contained" color="primary" onClick={cargar} disabled={!plan} loading={Boolean(progreso)}>
            Cargar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
