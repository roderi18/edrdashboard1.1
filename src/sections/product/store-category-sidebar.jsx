'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Typography from '@mui/material/Typography';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// LAS CATEGORIAS, A LA VISTA.
//
// Son las MISMAS que ofrece el desplegable de la barra —salen de los productos,
// no de una lista escrita a mano— y escriben en el MISMO filtro: elegir aqui es
// exactamente lo que hace elegir alli, y los chips de "filtros activos" lo
// reflejan igual.
//
// Se elige de una en una: la columna existe para entrar rapido a una categoria.
// Quien quiera varias a la vez las tiene en el desplegable, que sigue siendo
// multiple. Volver a pulsar la categoria activa la quita.
// ----------------------------------------------------------------------

// UN ICONO POR CATEGORIA, y uno de repuesto para las que vengan despues.
//
// La columna es una lista de nombres parecidos —"Insignias-Emblemas",
// "Materiales-Manuales", "Campamentos-Especiales"— que empiezan por letras
// distintas pero se leen igual de largo: el ojo tenia que leer palabra por
// palabra para encontrar la suya. Con un dibujo delante se va directo.
//
// La clave se busca por el NOMBRE guardado, en minusculas y sin acentos, que es
// como llega de la tienda; si algun dia entra una categoria nueva sale con el
// icono generico en vez de con un hueco.
// DE LINEA, NO RELLENOS: diez iconos macizos en fila pesan tanto como el texto
// y la columna se vuelve una pared de manchas. Estan dibujados en el paquete del
// proyecto (`icon-sets.js`), no cargados por internet.
const ICONOS_DE_CATEGORIA = {
  accesorios: 'custom:categoria-accesorios',
  'barras-numeros': 'custom:categoria-barras',
  'campamentos-especiales': 'custom:categoria-campamentos',
  cintas: 'custom:categoria-cintas',
  'insignias-emblemas': 'custom:categoria-insignias',
  'materiales-manuales': 'custom:categoria-materiales',
  parches: 'custom:categoria-parches',
  't-shirts': 'custom:categoria-camisetas',
  uniformes: 'custom:categoria-uniformes',
};

const ICONO_GENERICO = 'custom:categoria-todas';

const iconoDeCategoria = (categoria) => {
  const clave = String(categoria || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return ICONOS_DE_CATEGORIA[clave] || ICONO_GENERICO;
};

export function StoreCategorySidebar({ options = [], value = [], onChange, total = 0, sx }) {
  const seleccionada = value.length === 1 ? value[0] : '';

  const handleSelect = (categoria) => () => {
    onChange?.(seleccionada === categoria ? [] : [categoria]);
  };

  return (
    <Card sx={[{ p: 1 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.5, py: 1.25 }}>
        <Iconify icon="custom:categoria-todas" width={20} sx={{ color: 'text.secondary' }} />
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          Categorías
        </Typography>
      </Stack>

      <Divider sx={{ borderStyle: 'dashed' }} />

      <MenuList sx={{ p: 0.5 }}>
        <MenuItem
          selected={!seleccionada}
          onClick={() => onChange?.([])}
          sx={{ borderRadius: 1, gap: 1 }}
        >
          <Iconify icon="custom:categoria-todas" width={20} sx={{ color: 'text.secondary' }} />

          <Box component="span" sx={{ flexGrow: 1, typography: 'body2' }}>
            Todas
          </Box>

          <Label variant="soft" color="default">
            {total}
          </Label>
        </MenuItem>

        {options.map((option) => (
          <MenuItem
            key={option.value}
            selected={seleccionada === option.value}
            onClick={handleSelect(option.value)}
            sx={{ borderRadius: 1, gap: 1 }}
          >
            <Iconify
              width={20}
              icon={iconoDeCategoria(option.value)}
              sx={{
                flexShrink: 0,
                color: seleccionada === option.value ? 'primary.main' : 'text.secondary',
              }}
            />

            <Box
              component="span"
              sx={{
                flexGrow: 1,
                minWidth: 0,
                overflow: 'hidden',
                typography: 'body2',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {option.label}
            </Box>

            <Label variant="soft" color={seleccionada === option.value ? 'primary' : 'default'}>
              {option.count}
            </Label>
          </MenuItem>
        ))}
      </MenuList>
    </Card>
  );
}
