import { useState } from 'react';

import Menu from '@mui/material/Menu';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';

import {
  formatearFechaHoraOnerrd,
  restaurarDePapeleraOnerrd,
  quitarCamposAPapeleraOnerrd,
} from 'src/utils/certificado-onerrd.mjs';

import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------
// ELIMINAR TEXTOS CON PAPELERA, para el diseño del certificado y el de la
// factura (el mismo componente). Eliminar pregunta antes; lo eliminado va a la
// papelera del diseño y vuelve desde "Eliminados (n)", en su sitio. Se guarda
// con "Guardar diseño". Reglas en `certificado-onerrd.mjs` (papelera).
//
// Uso: const papelera = usePapeleraOnerrd({ diseno, onCambiarDiseno, onEliminados });
//   papelera.pedirEliminar(ids) · {papelera.boton} · {papelera.dialogo}
// ----------------------------------------------------------------------

export function usePapeleraOnerrd({ diseno, onCambiarDiseno, onEliminados, onRestaurado }) {
  const [pendientes, setPendientes] = useState(null);
  const [menu, setMenu] = useState(null);
  const papelera = diseno.papelera || [];

  const pedirEliminar = (ids) => {
    if (ids?.length) setPendientes(ids);
  };

  const confirmar = () => {
    onCambiarDiseno((actual) => quitarCamposAPapeleraOnerrd(actual, pendientes));
    setPendientes(null);
    onEliminados?.();
  };

  const nombres = (pendientes || [])
    .map((id) => diseno.campos.find((campo) => campo.id === id)?.etiqueta)
    .filter(Boolean);

  const dialogo = (
    <ConfirmDialog
      open={!!pendientes}
      onClose={() => setPendientes(null)}
      title={nombres.length > 1 ? `¿Eliminar ${nombres.length} textos?` : '¿Eliminar este texto?'}
      content={`${nombres.join(', ') || 'El texto'} sale del diseño. Puedes volver a ponerlo desde «Eliminados».`}
      action={
        <Button variant="contained" color="error" onClick={confirmar}>
          Eliminar
        </Button>
      }
    />
  );

  const boton = papelera.length ? (
    <>
      <Button
        size="small"
        color="inherit"
        startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
        onClick={(event) => setMenu(event.currentTarget)}
      >
        Eliminados ({papelera.length})
      </Button>
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
        {papelera.map((item, indice) => (
          <MenuItem
            key={`${item.campo.id}-${item.eliminadoEn}`}
            onClick={() => {
              onCambiarDiseno((actual) => restaurarDePapeleraOnerrd(actual, indice));
              setMenu(null);
              onRestaurado?.(item.campo.id);
            }}
          >
            <ListItemText
              primary={`Restaurar «${item.campo.etiqueta}»`}
              secondary={
                item.eliminadoEn ? `Eliminado ${formatearFechaHoraOnerrd(item.eliminadoEn)}` : ''
              }
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  ) : null;

  return { pedirEliminar, dialogo, boton };
}
