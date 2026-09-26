'use client';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import ListItem from '@mui/material/ListItem';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import RadioGroup from '@mui/material/RadioGroup';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import {
  TIPOS_CASILLA,
  LARGO_NOMBRE_CASILLA,
  limpiarNombreCasilla,
  nodosParaElegirPadre,
} from 'src/utils/casillas-personalizadas.mjs';

import {
  crearCasillaPersonalizada,
  quitarCasillaPersonalizada,
  renombrarCasillaPersonalizada,
} from 'src/services/directivas-organizacionales-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// "Agregar casilla": el Administrador Global añade una casilla (cargo que se
// asigna) o un contenedor (caja que agrupa) a TODOS los organigramas de un
// nivel. Al crearse sale también en la ficha del miembro, en "Cargo Nacional"
// o en "Nivel posición en tu Destacamento" según el nivel.
// ----------------------------------------------------------------------

const DONDE_SALE = {
  nacional: 'la Directiva Nacional y en "Cargo Nacional" de la ficha del miembro',
  regional: 'todas las regiones y en "Cargo Nacional" de la ficha del miembro',
  seccional: 'todas las secciones y en "Cargo Nacional" de la ficha del miembro',
  destacamento:
    'todos los destacamentos y en "Nivel posición en tu Destacamento" de la ficha del miembro',
};

const BOTON_SX = {
  width: 42,
  height: 42,
  display: 'flex',
  bgcolor: 'background.paper',
  color: 'text.primary',
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 3,
  '&:hover': { bgcolor: 'background.paper' },
};

export function CasillasDirectivaBoton({ nivel, arboles, casillas = [], onCambio }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Tooltip title="Agregar casilla o contenedor" placement="left">
        <IconButton
          size="small"
          aria-label="Agregar casilla o contenedor"
          onClick={() => setAbierto(true)}
          sx={BOTON_SX}
        >
          <Iconify width={22} icon="solar:add-circle-bold" />
        </IconButton>
      </Tooltip>

      {abierto && (
        <CasillasDirectivaDialog
          open={abierto}
          onClose={() => setAbierto(false)}
          nivel={nivel}
          arboles={arboles}
          casillas={casillas}
          onCambio={onCambio}
        />
      )}
    </>
  );
}

export function CasillasDirectivaDialog({
  open,
  onClose,
  nivel,
  arboles,
  casillas = [],
  onCambio,
}) {
  const { user } = useAuthContext();
  const opcionesPadre = useMemo(() => nodosParaElegirPadre(arboles), [arboles]);
  const delNivel = useMemo(
    () => casillas.filter((casilla) => casilla.nivel === nivel),
    [casillas, nivel]
  );
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState(TIPOS_CASILLA.casilla);
  const [idNodoPadre, setIdNodoPadre] = useState(() => opcionesPadre[0]?.id || '');
  const [guardando, setGuardando] = useState(false);
  const [aQuitar, setAQuitar] = useState(null);
  // La que se está renombrando: `{ id, nombre }` con el nombre que se escribe.
  const [renombrando, setRenombrando] = useState(null);

  const nombreLimpio = limpiarNombreCasilla(nombre);
  const nombreValido =
    nombreLimpio.length >= LARGO_NOMBRE_CASILLA.minimo &&
    nombreLimpio.length <= LARGO_NOMBRE_CASILLA.maximo;
  const padre = opcionesPadre.find((opcion) => opcion.id === idNodoPadre);

  const crear = async () => {
    if (!nombreValido || !padre || guardando) return;

    setGuardando(true);

    try {
      const creada = await crearCasillaPersonalizada({
        nivel,
        nombre: nombreLimpio,
        tipo,
        idNodoPadre,
        // En el destacamento la casilla hereda la división de donde cuelga
        // (bajo Exploradores es de Exploradores).
        division: nivel === 'destacamento' ? padre.division || null : null,
        usuario: user,
      });

      toast.success(
        `${creada.tipo === TIPOS_CASILLA.contenedor ? 'Contenedor' : 'Casilla'} "${creada.nombre}" añadido en ${DONDE_SALE[nivel] || 'todo el nivel'}.`
      );
      setNombre('');
      onCambio?.();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'No se pudo añadir la casilla.');
    } finally {
      setGuardando(false);
    }
  };

  const renombrar = async () => {
    const edicion = renombrando;

    if (!edicion) return;

    try {
      const despues = await renombrarCasillaPersonalizada({
        id: edicion.id,
        nombre: edicion.nombre,
        usuario: user,
      });

      setRenombrando(null);
      toast.success(
        `Ahora se llama "${despues.nombre}" en ${DONDE_SALE[nivel] || 'todo el nivel'}.`
      );
      onCambio?.();
    } catch (error) {
      toast.error(error?.message || 'No se pudo renombrar la casilla.');
    }
  };

  const quitar = async () => {
    const casilla = aQuitar;

    setAQuitar(null);

    try {
      await quitarCasillaPersonalizada({ id: casilla.id, usuario: user });
      toast.success(`"${casilla.nombre}" ya no sale en las directivas.`);
      onCambio?.();
    } catch (error) {
      toast.error(error?.message || 'No se pudo quitar la casilla.');
    }
  };

  return (
    <>
      <Dialog open={open} onClose={guardando ? undefined : onClose} fullWidth maxWidth="xs">
        <DialogTitle>Agregar casilla</DialogTitle>

        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Sale en {DONDE_SALE[nivel] || 'todo el nivel'}.
            </Typography>

            <TextField
              autoFocus
              fullWidth
              label="Nombre"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') crear();
              }}
              inputProps={{ maxLength: LARGO_NOMBRE_CASILLA.maximo }}
              helperText={`${nombreLimpio.length}/${LARGO_NOMBRE_CASILLA.maximo}`}
            />

            <RadioGroup value={tipo} onChange={(event) => setTipo(event.target.value)}>
              <FormControlLabel
                value={TIPOS_CASILLA.casilla}
                control={<Radio />}
                label={
                  <ListItemText primary="Casilla" secondary="Un cargo: se asigna a una persona." />
                }
              />
              <FormControlLabel
                value={TIPOS_CASILLA.contenedor}
                control={<Radio />}
                label={
                  <ListItemText
                    primary="Contenedor"
                    secondary="Una caja que agrupa casillas; no se asigna."
                  />
                }
              />
            </RadioGroup>

            <TextField
              select
              fullWidth
              label="Debajo de"
              value={idNodoPadre}
              onChange={(event) => setIdNodoPadre(event.target.value)}
            >
              {opcionesPadre.map((opcion) => (
                <MenuItem
                  key={opcion.id}
                  value={opcion.id}
                  sx={{ pl: 2 + opcion.profundidad * 1.5 }}
                >
                  {opcion.nombre}
                </MenuItem>
              ))}
            </TextField>

            {delNivel.length > 0 && (
              <Box>
                <Divider sx={{ mb: 1 }} />
                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                  Añadidas en este nivel
                </Typography>
                <List dense disablePadding>
                  {delNivel.map((casilla) =>
                    renombrando?.id === casilla.id ? (
                      <ListItem key={casilla.id} disableGutters sx={{ gap: 0.5 }}>
                        <TextField
                          autoFocus
                          fullWidth
                          size="small"
                          value={renombrando.nombre}
                          onChange={(event) =>
                            setRenombrando({ id: casilla.id, nombre: event.target.value })
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') renombrar();
                            if (event.key === 'Escape') {
                              event.stopPropagation();
                              setRenombrando(null);
                            }
                          }}
                          inputProps={{
                            maxLength: LARGO_NOMBRE_CASILLA.maximo,
                            'aria-label': `Nuevo nombre de ${casilla.nombre}`,
                          }}
                        />
                        <Tooltip title="Guardar nombre">
                          <IconButton
                            aria-label="Guardar nombre"
                            onClick={renombrar}
                            color="primary"
                          >
                            <Iconify icon="eva:checkmark-fill" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Cancelar">
                          <IconButton aria-label="Cancelar" onClick={() => setRenombrando(null)}>
                            <Iconify icon="solar:close-circle-bold" />
                          </IconButton>
                        </Tooltip>
                      </ListItem>
                    ) : (
                      <ListItem
                        key={casilla.id}
                        disableGutters
                        secondaryAction={
                          <Stack direction="row">
                            <Tooltip title="Renombrar en todas las directivas">
                              <IconButton
                                aria-label={`Renombrar ${casilla.nombre}`}
                                onClick={() =>
                                  setRenombrando({ id: casilla.id, nombre: casilla.nombre })
                                }
                              >
                                <Iconify icon="solar:pen-bold" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Quitar de todas las directivas">
                              <IconButton
                                edge="end"
                                aria-label={`Quitar ${casilla.nombre}`}
                                onClick={() => setAQuitar(casilla)}
                                sx={{ color: 'error.main' }}
                              >
                                <Iconify icon="solar:trash-bin-trash-bold" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        }
                      >
                        <ListItemText
                          primary={casilla.nombre}
                          secondary={
                            casilla.tipo === TIPOS_CASILLA.contenedor ? 'Contenedor' : 'Casilla'
                          }
                          sx={{ pr: 10 }}
                        />
                      </ListItem>
                    )
                  )}
                </List>
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={crear}
            disabled={!nombreValido || !padre}
            loading={guardando}
          >
            Agregar
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(aQuitar)}
        onClose={() => setAQuitar(null)}
        title="Quitar casilla"
        content={
          <>
            <strong>{aQuitar?.nombre}</strong> dejará de salir en {DONDE_SALE[nivel] || 'el nivel'}.
            Si alguien la ocupa no se quita: primero hay que retirarlo. Lo que cuelgue de ella sube
            a su lugar.
          </>
        }
        action={
          <Button variant="contained" color="error" onClick={quitar}>
            Quitar
          </Button>
        }
      />
    </>
  );
}
