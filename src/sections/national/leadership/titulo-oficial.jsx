'use client';

import { usePopover } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { normalizeText } from 'src/utils/normalize-text';
import { canManageDirectiva } from 'src/utils/admin-role-label';
import { isAdminGlobal, isOficinaNacional } from 'src/utils/org-level-access';
import { tituloDe, opcionesDeTitulo } from 'src/utils/titulos-oficiales-nacionales.mjs';

import {
  pintarTitulosYa,
  useTitulosOficiales,
  useOficialesVigentes,
  agregarTituloOficial,
  guardarTituloDeOficial,
} from 'src/services/titulos-oficiales-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

import { getMemberDisplayName } from 'src/sections/common/leadership-node-identity';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// "ASIGNAR TÍTULO" A UN OFICIAL DE LA NACIONAL.
//
// Los tres puntos de cada oficial abren "Asignar título", y este el desplegable
// con la lista. Un título lo pueden llevar varios (sin límite), así que todos se
// pueden elegir; cada uno dice cuántos lo llevan ya. El Administrador Global
// tiene además "Nuevo" para sumar un título a la lista. El desplegable es
// `SelectorDeTitulo`, el mismo de "Asignar miembros". La regla vive en
// `src/utils/titulos-oficiales-nacionales.mjs`.
// ----------------------------------------------------------------------

export const idDeOficial = (persona) =>
  String(persona?.idMiembros ?? persona?.idMiembro ?? persona?.id ?? '').trim();

/**
 * Quién toca los títulos: asignar, Administrador Global y Oficina Nacional;
 * "Nuevo" en la lista, solo el primero. Una sola pieza para la Jerarquía y la
 * ficha del miembro, que si no acababan pidiendo cosas distintas.
 */
export function permisosDeTitulo(user) {
  const esAdministradorGlobal =
    isAdminGlobal(user) ||
    canManageDirectiva(user) ||
    [user?.rolNombre, user?.roleName, user?.rolLabel, user?.roleLabel]
      .map((nombre) => normalizeText(nombre))
      .includes('administrador global');

  return {
    puedeAsignar: esAdministradorGlobal || isOficinaNacional(user),
    puedeAgregar: esAdministradorGlobal,
  };
}

const nombreDeOficial = (persona) => persona?.name || getMemberDisplayName(persona) || '';

/** El título que lleva la persona ('' si ninguno), en vivo. */
export function useTituloDeOficial(persona) {
  const { asignaciones } = useTitulosOficiales();

  return tituloDe(asignaciones, idDeOficial(persona));
}

/** Cuántos llevan el título, en palabras. */
const quienesLoLlevan = (personas = []) =>
  personas.length === 1
    ? `Lo lleva ${personas[0].nombre || '1 oficial'}`
    : `Lo llevan ${personas.length} oficiales`;

/**
 * El desplegable de títulos con "Nuevo" (Administrador Global). Lo comparten
 * "Asignar título" (una persona) y "Asignar miembros" (varias).
 */
export function SelectorDeTitulo({
  value,
  onChange,
  idMiembro = '',
  vigentes = null,
  puedeAgregar = false,
  disabled = false,
}) {
  const { user } = useAuthContext();
  const { catalogo, asignaciones } = useTitulosOficiales();
  const [nuevo, setNuevo] = useState(null);
  const [agregando, setAgregando] = useState(false);
  const bloqueado = disabled || agregando;

  const opciones = useMemo(
    () => opcionesDeTitulo({ catalogo, asignaciones, idMiembro, vigentes }),
    [catalogo, asignaciones, idMiembro, vigentes]
  );

  const agregar = async () => {
    setAgregando(true);

    try {
      await agregarTituloOficial({ nombre: nuevo, usuario: user });
      toast.success('Título añadido a la lista.');
      onChange(String(nuevo).replace(/\s+/g, ' ').trim());
      setNuevo(null);
    } catch (error) {
      toast.error(error?.message || 'No se pudo añadir el título.');
    } finally {
      setAgregando(false);
    }
  };

  return (
    <>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          select
          fullWidth
          label="Título"
          value={opciones.some((opcion) => opcion.titulo === value) ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          disabled={bloqueado}
          slotProps={{
            select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: 360 } } } } },
          }}
        >
          {opciones.map((opcion) => (
            <MenuItem
              key={opcion.titulo}
              value={opcion.titulo}
              sx={{ whiteSpace: 'normal', display: 'block' }}
            >
              {opcion.titulo}
              {opcion.personas.length > 0 && (
                <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
                  {quienesLoLlevan(opcion.personas)}
                </Typography>
              )}
            </MenuItem>
          ))}
        </TextField>

        {puedeAgregar && nuevo === null && (
          <Button
            variant="outlined"
            disabled={bloqueado}
            startIcon={<Iconify icon="solar:add-circle-bold" />}
            onClick={() => setNuevo('')}
            sx={{ height: 54, flexShrink: 0 }}
          >
            Nuevo
          </Button>
        )}
      </Stack>

      {puedeAgregar && nuevo !== null && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Nombre del título nuevo"
            value={nuevo}
            disabled={bloqueado}
            onChange={(event) => setNuevo(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && nuevo.trim()) agregar();
            }}
          />
          <Button variant="contained" disabled={bloqueado || !nuevo.trim()} onClick={agregar}>
            Agregar
          </Button>
          <IconButton disabled={bloqueado} onClick={() => setNuevo(null)}>
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </Stack>
      )}
    </>
  );
}

export function TituloOficialDialog({ open, onClose, persona, puedeAgregar = false }) {
  const { user } = useAuthContext();
  const { asignaciones } = useTitulosOficiales();
  // Solo la directiva ACTUAL: un título que conserva quien ya no es Oficial
  // Especial queda libre, y a quien no lo es hoy no se le puede dar.
  const vigentes = useOficialesVigentes(open);
  const idMiembro = idDeOficial(persona);
  const esVigente = !vigentes || vigentes.has(idMiembro);
  const actual = tituloDe(asignaciones, idMiembro);
  const [elegido, setElegido] = useState(actual);

  // Al abrir, el que tiene hoy; no el que quedó elegido la vez anterior.
  useEffect(() => {
    if (open) setElegido(actual);
  }, [open, actual]);

  // Instantáneo: se pinta y se cierra en el acto; la escritura va por detrás y,
  // si falla, se deshace el pintado y se avisa.
  const guardar = (titulo) => {
    const nombre = nombreDeOficial(persona);
    const deshacer = pintarTitulosYa({ personas: [{ idMiembro, nombre }], titulo });

    onClose();

    guardarTituloDeOficial({ idMiembro, nombre, titulo, usuario: user })
      .then(() => toast.success(titulo ? 'Título asignado.' : 'Título quitado.'))
      .catch((error) => {
        deshacer();
        toast.error(error?.message || 'No se pudo guardar el título. Se deshizo el cambio.');
      });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      // El diálogo se abre desde tarjetas que se arrastran: que el clic no llegue.
      onPointerDown={(event) => event.stopPropagation()}
    >
      <DialogTitle>Asignar título</DialogTitle>

      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          {nombreDeOficial(persona) || 'Oficial de la Nacional'}
        </Typography>

        {!esVigente && (
          <Typography variant="body2" sx={{ mb: 2, color: 'warning.main' }}>
            No ocupa ninguna casilla de Oficial Especial en la directiva actual: solo quien lo es
            hoy lleva título.
          </Typography>
        )}

        <SelectorDeTitulo
          value={elegido}
          onChange={setElegido}
          idMiembro={idMiembro}
          vigentes={vigentes}
          puedeAgregar={puedeAgregar}
        />
      </DialogContent>

      <DialogActions>
        {actual && (
          <Button color="error" onClick={() => guardar('')} sx={{ mr: 'auto' }}>
            Quitar título
          </Button>
        )}
        <Button variant="outlined" color="inherit" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          disabled={!esVigente || !elegido || elegido === actual}
          onClick={() => guardar(elegido)}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Los tres puntos de la esquina de un oficial: "Asignar título" y, si se puede
 * gestionar, "Quitar de Oficiales Especiales" (su casilla ya no se dibuja).
 */
export function MenuTituloOficial({ persona, puedeAgregar = false, onQuitar, sx }) {
  const menu = usePopover();
  const [abierto, setAbierto] = useState(false);
  const noArrastrar = (event) => event.stopPropagation();

  return (
    <>
      <IconButton
        size="small"
        aria-label="Opciones del oficial"
        color={menu.open ? 'inherit' : 'default'}
        onPointerDown={noArrastrar}
        onClick={(event) => {
          noArrastrar(event);
          menu.onOpen(event);
        }}
        sx={{ position: 'absolute', top: 4, right: 4, ...sx }}
      >
        <Iconify icon="eva:more-vertical-fill" width={18} />
      </IconButton>

      <CustomPopover
        open={menu.open}
        anchorEl={menu.anchorEl}
        onClose={menu.onClose}
        slotProps={{ arrow: { placement: 'right-top' } }}
      >
        <MenuList onPointerDown={noArrastrar}>
          <MenuItem
            onClick={() => {
              menu.onClose();
              setAbierto(true);
            }}
          >
            <Iconify icon="solar:medal-ribbon-bold" />
            Asignar título
          </MenuItem>

          {onQuitar && (
            <MenuItem
              onClick={() => {
                menu.onClose();
                onQuitar();
              }}
              sx={{ color: 'error.main' }}
            >
              <Iconify icon="solar:trash-bin-trash-bold" />
              Quitar de Oficiales Especiales
            </MenuItem>
          )}
        </MenuList>
      </CustomPopover>

      <TituloOficialDialog
        open={abierto}
        onClose={() => setAbierto(false)}
        persona={persona}
        puedeAgregar={puedeAgregar}
      />
    </>
  );
}
