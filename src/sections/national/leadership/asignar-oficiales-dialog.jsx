'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { SelectorDeTitulo } from 'src/sections/national/leadership/titulo-oficial';

// ----------------------------------------------------------------------
// "ASIGNAR MIEMBROS" EN LA TARJETA "OFICIALES ESPECIALES".
//
// Antes cada oficial se daba de alta en dos pasos y de uno en uno: crear una
// casilla con "+" y asignarle a alguien desde su menú; el título, en un tercer
// paso. Aquí se elige un título y varias personas a la vez: a cada una se le da
// (o reutiliza) una casilla de Oficial Especial y se le pone el título. Un título
// lo pueden llevar varios, sin límite.
//
// Quien ya es Oficial Especial se puede elegir: solo se le cambia el título.
// Quien tiene un cargo en una SECCIÓN o REGIÓN también: ser Oficial Especial
// convive con él y lo conserva (`src/utils/cargos-compatibles.mjs`). Solo sale
// apagado quien tiene OTRO cargo del Consejo Ejecutivo: ahí sigue valiendo un
// cargo por persona, y moverlo se pregunta desde su casilla.
//
// Instantáneo: al pulsar "Asignar" el diálogo se cierra y la tarjeta ya enseña a
// las personas con su título; lo que se escribe va por detrás.
// ----------------------------------------------------------------------

const avatarDe = (miembro) => miembro?.avatarUrl || miembro?.photoURL || '';

export function AsignarOficialesDialog({
  open,
  onClose,
  opciones = [],
  cargando = false,
  // Ids de quienes ya son Oficiales Especiales hoy.
  idsOficiales = new Set(),
  // Casillas que quedan por crear (el organigrama admite veinte).
  casillasLibres = 20,
  puedeAgregarTitulo = false,
  onConfirmar,
}) {
  const [titulo, setTitulo] = useState('');
  const [elegidos, setElegidos] = useState([]);

  // Cada apertura empieza de cero.
  useEffect(() => {
    if (open) {
      setTitulo('');
      setElegidos([]);
    }
  }, [open]);

  const yaEsOficial = (opcion) => idsOficiales.has(String(opcion?.id));
  // Otro cargo del Consejo Ejecutivo (`rolActual`, de esta misma directiva).
  const tieneOtroCargo = (opcion) => !yaEsOficial(opcion) && Boolean(opcion?.rolActual);
  // Cargo en una sección o región (`rolEnOtroConsejo`): lo conserva.
  const conservaSuCargo = (opcion) =>
    !yaEsOficial(opcion) && !opcion?.rolActual && Boolean(opcion?.rolEnOtroConsejo);
  const nuevos = elegidos.filter((opcion) => !yaEsOficial(opcion)).length;
  const sinSitio = nuevos > casillasLibres;

  // `onConfirmar` pinta en el acto y devuelve si se aceptó; el guardado sigue por
  // detrás, así que el diálogo se cierra sin esperarlo.
  const confirmar = () => {
    const aceptado = onConfirmar?.({
      titulo,
      miembros: elegidos.map((opcion) => ({ ...opcion.member, id: opcion.id })),
    });

    if (aceptado) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      // Se abre desde una tarjeta que se arrastra: que el clic no llegue.
      onPointerDown={(event) => event.stopPropagation()}
    >
      <DialogTitle>Asignar miembros</DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Elige el título y a quiénes se lo das. Cada persona queda como Oficial Especial de la
            directiva actual con ese título.
          </Typography>

          <SelectorDeTitulo
            value={titulo}
            onChange={setTitulo}
            // Quién lo lleva, contado solo entre los Oficiales de hoy: sin esto
            // salía "Lo lleva" alguien que ya no es oficial.
            vigentes={idsOficiales}
            puedeAgregar={puedeAgregarTitulo}
          />

          <Autocomplete
            multiple
            options={opciones}
            value={elegidos}
            loading={cargando}
            onChange={(event, valor) => setElegidos(valor)}
            filterSelectedOptions
            disableCloseOnSelect
            getOptionLabel={(opcion) => opcion?.nombre || ''}
            getOptionKey={(opcion) => opcion?.id}
            getOptionDisabled={tieneOtroCargo}
            isOptionEqualToValue={(opcion, elegido) => opcion?.id === elegido?.id}
            noOptionsText="No hay miembros disponibles"
            renderValue={(valor, getItemProps) =>
              valor.map((opcion, index) => {
                const { key, ...itemProps } = getItemProps({ index });

                return (
                  <Chip
                    key={key}
                    {...itemProps}
                    size="small"
                    label={opcion.nombre}
                    avatar={<Avatar alt={opcion.nombre} src={avatarDe(opcion.member)} />}
                  />
                );
              })
            }
            renderOption={(optionProps, opcion) => {
              const { key, ...liProps } = optionProps;

              return (
                <Box
                  key={key}
                  component="li"
                  {...liProps}
                  sx={{ alignItems: 'flex-start', ...liProps.sx }}
                >
                  <Avatar
                    alt={opcion.nombre}
                    src={avatarDe(opcion.member)}
                    sx={{ width: 36, height: 36, mr: 1.5, mt: 0.25, flexShrink: 0 }}
                  />

                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2">{opcion.nombre}</Typography>
                    <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
                      {opcion.subtitulo}
                    </Typography>

                    {yaEsOficial(opcion) && (
                      <Typography variant="caption" component="div" sx={{ fontWeight: 600 }}>
                        Ya es Oficial Especial: solo se le cambia el título
                      </Typography>
                    )}

                    {tieneOtroCargo(opcion) && (
                      <Typography variant="caption" component="div" sx={{ fontWeight: 600 }}>
                        Ya es {opcion.rolActual}: se asigna desde su casilla
                      </Typography>
                    )}

                    {conservaSuCargo(opcion) && (
                      <Typography variant="caption" component="div" sx={{ fontWeight: 600 }}>
                        Sigue siendo {opcion.rolEnOtroConsejo}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField {...params} label="Miembros" placeholder="Buscar miembro" />
            )}
          />

          {sinSitio && (
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              {`Solo caben ${casillasLibres} oficiales nuevos más (el organigrama admite veinte).`}
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          disabled={!titulo || !elegidos.length || sinSitio}
          onClick={confirmar}
        >
          {elegidos.length > 1 ? `Asignar a ${elegidos.length}` : 'Asignar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
