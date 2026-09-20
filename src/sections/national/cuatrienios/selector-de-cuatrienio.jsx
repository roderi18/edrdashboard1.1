'use client';

import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import ButtonBase from '@mui/material/ButtonBase';
import ListItemText from '@mui/material/ListItemText';

import { CUATRIENIOS, esCuatrienioVigente } from 'src/utils/directiva-cuatrienios.mjs';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

// ----------------------------------------------------------------------
// EL TÍTULO DE LA LISTA ES EL SELECTOR: "Directiva Nacional 2026-2030 · Actual ▾".
// Se abre y se elige el cuatrienio; la tabla de debajo es la misma.
// ----------------------------------------------------------------------

const aFecha = (iso) => iso.split('-').reverse().join('/');

export function SelectorDeCuatrienio({ titulo, cuatrienio, onCambiar }) {
  const menu = usePopover();

  return (
    <>
      <ButtonBase
        disableRipple
        onClick={menu.onOpen}
        aria-haspopup="menu"
        sx={{
          gap: 1,
          font: 'inherit',
          textAlign: 'left',
          borderRadius: 1,
          flexWrap: 'wrap',
          '&:hover .flecha': { bgcolor: 'action.hover' },
        }}
      >
        {titulo} {cuatrienio}
        {esCuatrienioVigente(cuatrienio) && (
          <Label color="success" variant="soft">
            Actual
          </Label>
        )}
        <Box
          className="flecha"
          sx={{
            display: 'inline-flex',
            borderRadius: '50%',
            p: 0.25,
            transition: 'background-color .2s',
          }}
        >
          <Iconify
            width={22}
            icon="eva:arrow-ios-downward-fill"
            sx={{ transition: 'transform .2s', ...(menu.open && { transform: 'rotate(180deg)' }) }}
          />
        </Box>
      </ButtonBase>

      <CustomPopover
        open={menu.open}
        anchorEl={menu.anchorEl}
        onClose={menu.onClose}
        slotProps={{ arrow: { placement: 'top-left' } }}
      >
        <MenuList>
          {[...CUATRIENIOS].reverse().map((item) => (
            <MenuItem
              key={item.id}
              selected={item.id === cuatrienio}
              onClick={() => {
                menu.onClose();
                if (item.id !== cuatrienio) onCambiar(item.id);
              }}
            >
              <ListItemText
                primary={`Directiva Nacional ${item.id}`}
                secondary={`${aFecha(item.inicio)} – ${aFecha(item.fin)}`}
              />
              {esCuatrienioVigente(item.id) && (
                <Label color="success" variant="soft" sx={{ ml: 2 }}>
                  Actual
                </Label>
              )}
            </MenuItem>
          ))}
        </MenuList>
      </CustomPopover>
    </>
  );
}
