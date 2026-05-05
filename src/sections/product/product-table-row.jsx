import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Avatar from '@mui/material/Avatar';
import ListItemText from '@mui/material/ListItemText';
import LinearProgress from '@mui/material/LinearProgress';

import { RouterLink } from 'src/routes/components';

import { fDopCurrency } from 'src/utils/format-number';

import { Label } from 'src/components/label';

// ----------------------------------------------------------------------

export function RenderCellPrice({ params }) {
  if (params.field === 'precioNoRegistrado' && Number(params.value || 0) <= 0) {
    return 'N/A';
  }

  return fDopCurrency(params.value ?? params.row.price);
}

export function RenderCellCategory({ params }) {
  return toTitleCase(translateProductCategory(params.row.category));
}

export function RenderCellPublish({ params }) {
  const label = params.row.publish === 'published' ? 'Publicado' : 'Borrador';

  return (
    <Label variant="soft" color={params.row.publish === 'published' ? 'info' : 'default'}>
      {label}
    </Label>
  );
}

export function RenderCellRenglon({ params }) {
  const isRestricted = params.row.renglon === 'restringido';

  return (
    <Label variant="soft" color={isRestricted ? 'warning' : 'success'}>
      {isRestricted ? 'Restringido' : 'General'}
    </Label>
  );
}

export function RenderCellStock({ params }) {
  const stockLabel =
    (params.row.inventoryType === 'out of stock' && 'sin existencias') ||
    (params.row.inventoryType === 'low stock' && 'pocas existencias') ||
    'en existencia';
  const color =
    (params.row.inventoryType === 'out of stock' && 'error') ||
    (params.row.inventoryType === 'low stock' && 'warning') ||
    'success';

  return (
    <Box sx={{ width: 1, typography: 'caption', color: 'text.secondary' }}>
      <LinearProgress
        color={color}
        variant="determinate"
        value={(params.row.available * 100) / params.row.quantity}
        sx={[{ mb: 1, width: 80, height: 6 }]}
      />
      {!!params.row.available && params.row.available} {stockLabel}
    </Box>
  );
}

export function RenderCellProduct({ params, href }) {
  return (
    <Box
      sx={{
        py: 2,
        gap: 2,
        width: 1,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Avatar
        alt={params.row.name}
        src={params.row.coverUrl}
        variant="rounded"
        sx={{ width: 64, height: 64 }}
      />

      <ListItemText
        primary={
          <Link component={RouterLink} href={href} color="inherit">
            {params.row.name}
          </Link>
        }
        secondary={translateProductCategory(params.row.category)}
        slotProps={{
          primary: { noWrap: true },
          secondary: { sx: { color: 'text.disabled' } },
        }}
      />
    </Box>
  );
}

function translateProductCategory(category) {
  const categories = {
    Shose: 'Zapatos',
    Shoes: 'Zapatos',
    Apparel: 'Ropa',
    Accessories: 'Accesorios',
    Shirts: 'Camisas',
    'T-shirts': 'T-shirts',
    Jeans: 'Jeans',
    Leather: 'Cuero',
    Suits: 'Trajes',
    Blazers: 'Blazers',
    Trousers: 'Pantalones',
    Waistcoats: 'Chalecos',
    'Backpacks and bags': 'Mochilas y bolsos',
    Bracelets: 'Brazaletes',
    'Face masks': 'Mascarillas',
  };

  return categories[category] || category;
}

function toTitleCase(value = '') {
  return String(value)
    .split(/(\s+|\/|-)/)
    .map((part) =>
      /^[a-zA-ZÀ-ÿ]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part
    )
    .join('');
}
