import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { Iconify } from 'src/components/iconify';

import { estadosVisibles } from './order-status-nav';

// ----------------------------------------------------------------------
// LOS FILTROS DE LA LISTA DE PEDIDOS.
//
// En una sola fila que se parte sola: buscar, el rango de fechas, el estado, el
// metodo de pago y el orden. Repartidos entre una barra y un cajon, habia que
// acordarse de en cual estaba cada uno.
//
// Las fechas van con el CALENDARIO DEL PROYECTO, no con el del navegador: es la
// regla de la casa —el nativo cambia de forma en cada sistema— y aqui ademas
// conviven con los demas campos, que son de MUI.
// ----------------------------------------------------------------------

// COMO SE PAGO: un catalogo y no dos.
//
// El desplegable ofrecia tres formas y la columna "Total" enseñaba cuatro
// —PayPal faltaba en el filtro—, asi que habia pedidos que se veian en la lista
// y no habia manera de aislarlos. Ahora la etiqueta de la fila y las opciones
// del filtro salen de aqui, y filtrar por "Tarjeta" devuelve exactamente los
// pedidos que la fila llama "Tarjeta".
//
// `alias` recoge las formas en que el dato llega guardado: los pedidos de
// ejemplo escriben la marca ("visa", "mastercard") donde los de verdad escriben
// el metodo, y el ingles se cuela desde la pasarela ("cash", "card").
export const METODOS_DE_PAGO = [
  {
    value: 'efectivo',
    label: 'Efectivo',
    icono: 'solar:wad-of-money-bold',
    alias: ['efectivo', 'cash'],
  },
  {
    value: 'transferencia',
    label: 'Transferencia',
    icono: 'solar:transfer-horizontal-bold-duotone',
    alias: ['transferencia', 'transfer', 'transferencia_bancaria'],
  },
  {
    value: 'tarjeta',
    label: 'Tarjeta',
    icono: 'solar:card-bold',
    alias: ['tarjeta', 'card', 'visa', 'mastercard'],
  },
  { value: 'paypal', label: 'PayPal', icono: 'payments:paypal', alias: ['paypal'] },
];

export const METODOS_DE_PAGO_FILTRO = [
  { value: 'all', label: 'Todos los métodos' },
  ...METODOS_DE_PAGO.map(({ value, label }) => ({ value, label })),
];

/** El metodo con el que se pago, venga escrito como venga. */
export const metodoDePago = (pago) => {
  const guardado = String(pago?.cardType || '')
    .trim()
    .toLowerCase();

  return (
    METODOS_DE_PAGO.find((metodo) => metodo.alias.includes(guardado)) || {
      value: guardado,
      label: guardado || 'Sin registrar',
      icono: 'solar:card-bold',
    }
  );
};

export const ORDENES_DE_LISTA = [
  { value: 'recientes', label: 'Más recientes' },
  { value: 'antiguos', label: 'Más antiguos' },
  { value: 'mayor', label: 'Mayor importe' },
  { value: 'menor', label: 'Menor importe' },
];

export function OrderListFilters({
  filters,
  onResetPage,
  dateError,
  acciones,
  atiendeSolicitudes = false,
}) {
  const { state: actuales, setState: cambiar } = filters;

  const aplicar = (cambios) => {
    onResetPage?.();
    cambiar(cambios);
  };

  return (
    <Box
      sx={{
        gap: 2,
        display: 'grid',
        alignItems: 'center',
        // La ultima columna es para la accion —descargar—: `auto` para que ocupe
        // lo que ocupe su boton y no un sexto del ancho, que es lo que pasaba
        // cuando todas las columnas median igual.
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: '1.4fr repeat(2, 1fr)',
          lg: '1.6fr repeat(2, 0.9fr) repeat(3, 1fr) auto',
        },
      }}
    >
      <TextField
        fullWidth
        size="small"
        value={actuales.name}
        onChange={(evento) => aplicar({ name: evento.target.value })}
        placeholder="Buscar por número de pedido, producto…"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          },
        }}
      />

      <DatePicker
        label="Fecha inicial"
        format="DD/MM/YYYY"
        value={actuales.startDate}
        onChange={(valor) => aplicar({ startDate: valor })}
        slotProps={{ textField: { fullWidth: true, size: 'small' } }}
      />

      <DatePicker
        label="Fecha final"
        format="DD/MM/YYYY"
        value={actuales.endDate}
        onChange={(valor) => aplicar({ endDate: valor })}
        slotProps={{
          textField: {
            fullWidth: true,
            size: 'small',
            error: dateError,
            // El aviso va en el campo que esta mal, no en una linea suelta:
            // "revisa las fechas" obliga a adivinar cual de las dos.
            helperText: dateError ? 'Es anterior a la inicial' : null,
          },
        }}
      />

      <TextField
        select
        fullWidth
        size="small"
        label="Estado"
        value={actuales.status}
        onChange={(evento) => aplicar({ status: evento.target.value })}
      >
        {estadosVisibles(atiendeSolicitudes).map((estado) => (
          <MenuItem key={estado.value} value={estado.value}>
            {estado.label}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        fullWidth
        size="small"
        label="Método de pago"
        value={actuales.payment}
        onChange={(evento) => aplicar({ payment: evento.target.value })}
      >
        {METODOS_DE_PAGO_FILTRO.map((metodo) => (
          <MenuItem key={metodo.value} value={metodo.value}>
            {metodo.label}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        fullWidth
        size="small"
        label="Ordenar por"
        value={actuales.orden}
        onChange={(evento) => cambiar({ orden: evento.target.value })}
      >
        {ORDENES_DE_LISTA.map((orden) => (
          <MenuItem key={orden.value} value={orden.value}>
            {orden.label}
          </MenuItem>
        ))}
      </TextField>

      {/* DESCARGAR, PEGADO A LOS FILTROS. Es lo que se hace DESPUES de acotar
          —"esto es lo que quiero, dámelo en una hoja"—, asi que vive al final de
          la misma fila y no en una barra aparte. */}
      {acciones}
    </Box>
  );
}
