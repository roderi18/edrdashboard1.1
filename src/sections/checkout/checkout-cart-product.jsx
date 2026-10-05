import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { fDopCurrency } from 'src/utils/format-number';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { ColorPreview } from 'src/components/color-utils';
import { NumberInput } from 'src/components/number-input';

// ----------------------------------------------------------------------

export function CheckoutCartProduct({ row, onDeleteCartItem, onChangeItemQuantity }) {
  return (
    <TableRow>
      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          <Avatar
            variant="rounded"
            alt={row.name}
            src={row.coverUrl}
            sx={{ width: 64, height: 64 }}
          />

          <Stack spacing={0.5}>
            <Typography noWrap variant="subtitle2" sx={{ maxWidth: 240 }}>
              {row.name}
            </Typography>

            {/* LAS TALLAS COMO EN EL RESUMEN DE "INSCRIBIRME": un combo o las
                camisetas adicionales traen su reparto ("M×2 · L×1") y sale como
                etiquetas sueltas. Antes salía "talla:" con una etiqueta vacía
                en cualquier producto, tuviera talla o no. */}
            {(!!row.size || !!row.colors?.length) && (
              <Box
                sx={{
                  gap: 0.5,
                  display: 'flex',
                  flexWrap: 'wrap',
                  typography: 'body2',
                  alignItems: 'center',
                  color: 'text.secondary',
                }}
              >
                {!!row.size && (
                  <>
                    {String(row.size).includes('×') ? 'tallas:' : 'talla:'}
                    {String(row.size)
                      .split(' · ')
                      .filter(Boolean)
                      .map((pieza) => (
                        <Label key={pieza} variant="soft" color="primary">
                          {pieza}
                        </Label>
                      ))}
                  </>
                )}
                {!!row.size && !!row.colors?.length && (
                  <Divider orientation="vertical" sx={{ mx: 1, height: 16 }} />
                )}
                {!!row.colors?.length && <ColorPreview colors={row.colors} />}
              </Box>
            )}
          </Stack>
        </Box>
      </TableCell>

      <TableCell>{fDopCurrency(row.price)}</TableCell>

      <TableCell>
        <Box sx={{ width: 100, textAlign: 'right' }}>
          <NumberInput
            hideDivider
            value={row.quantity}
            onChange={(event, quantity) => onChangeItemQuantity(row.id, quantity)}
            max={row.available}
          />

          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            disponible: {row.available}
          </Typography>
        </Box>
      </TableCell>

      <TableCell align="right">{fDopCurrency(row.price * row.quantity)}</TableCell>

      <TableCell align="right" sx={{ px: 1 }}>
        <IconButton onClick={() => onDeleteCartItem(row.id)}>
          <Iconify icon="solar:trash-bin-trash-bold" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}
