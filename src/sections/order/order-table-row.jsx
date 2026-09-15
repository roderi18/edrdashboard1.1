import { useBoolean, usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import MenuList from '@mui/material/MenuList';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';

import { RouterLink } from 'src/routes/components';

import { fDate, fTime } from 'src/utils/format-time';
import { fDopCurrency } from 'src/utils/format-number';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';

import { metodoDePago } from './order-list-filters';
import { ESTADOS_DE_ORDEN } from './order-status-nav';

// ----------------------------------------------------------------------

// EL ESTADO SALE DE LA MISMA LISTA que las pastillas de arriba y la columna de
// la izquierda. Tenerlo escrito aqui otra vez era pedir que un pedido cancelado
// acabara siendo rojo en un sitio y gris en otro.
const estadoDeOrden = (valor) =>
  ESTADOS_DE_ORDEN.find((estado) => estado.value === valor) || {
    label: valor,
    color: 'default',
    icono: '',
  };

/**
 * Los cuatro ultimos digitos, y nada mas.
 *
 * El numero llegaba entero —"**** **** **** 5678"— y ocupaba media columna para
 * decir lo mismo que dicen los cuatro ultimos, que es lo unico que sirve para
 * reconocer la tarjeta. Un numero de tarjeta completo, ademas, no tiene por que
 * estar en una lista que se mira en pantalla compartida.
 */
// El ancho de la etiqueta de estado: el que necesita la palabra mas larga
// —"Reembolsado"— con su icono delante. Las demas se quedan del mismo tamaño.
const ANCHO_DE_ETIQUETA = 132;

// Cuantas fotos caben sin empujar el resto de la fila fuera de la pantalla.
// Tres: a partir de la cuarta ya no se distingue una insignia de otra al tamaño
// que quedan, y lo que dice algo es CUANTAS mas hay.
const FOTOS_VISIBLES = 3;

const ultimosCuatro = (numero) => {
  const digitos = String(numero || '').replace(/\D/g, '');

  return digitos.length >= 4 ? `•••• ${digitos.slice(-4)}` : '';
};

export function OrderTableRow({
  row,
  selected,
  onSelectRow,
  onDeleteRow,
  detailsHref,
  canDelete = true,
}) {
  const confirmDialog = useBoolean();
  const menuActions = usePopover();
  const collapseRow = useBoolean();

  const estado = estadoDeOrden(row.status);
  const pago = metodoDePago(row.payment);
  const productos = row.items || [];

  const renderPrimaryRow = () => (
    <TableRow hover selected={selected}>
      <TableCell padding="checkbox">
        <Checkbox
          checked={selected}
          onClick={onSelectRow}
          slotProps={{
            input: {
              id: `${row.id}-checkbox`,
              'aria-label': `${row.id} checkbox`,
            },
          }}
        />
      </TableCell>

      <TableCell>
        <ListItemText
          primary={
            <Link component={RouterLink} href={detailsHref} color="inherit" underline="hover">
              {row.orderNumber}
            </Link>
          }
          // CUANTOS ARTICULOS LLEVA, debajo del numero. Era una columna entera
          // para un numero de una cifra, y donde de verdad se busca es pegado al
          // pedido: "el 6010, el de cinco cosas".
          secondary={`${productos.length} ${productos.length === 1 ? 'producto' : 'productos'}`}
          slotProps={{
            primary: { sx: { typography: 'subtitle2' } },
            secondary: { sx: { mt: 0.25, typography: 'caption', color: 'text.disabled' } },
          }}
        />
      </TableCell>

      <TableCell>
        {/* LAS FOTOS DE LO COMPRADO. Un pedido se reconoce por lo que lleva
            mucho antes que por su numero; el "+N" evita que una compra grande
            empuje el resto de la fila fuera de la pantalla. */}
        {productos.length ? (
          /* DE IZQUIERDA A DERECHA, Y EL "+N" AL FINAL. `AvatarGroup` apila al
             reves y pone el sobrante DELANTE: la primera foto quedaba a la
             derecha y el "+3" abria la fila, que es justo el orden contrario al
             que se lee. */
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {productos.slice(0, FOTOS_VISIBLES).map((item, indice) => (
              <Tooltip key={item.id} title={`${item.name} × ${item.quantity}`}>
                <Avatar
                  variant="rounded"
                  alt={item.name}
                  src={item.coverUrl}
                  sx={{
                    // MAS GRANDES: a 40 px una insignia bordada es una mancha de
                    // color. El pedido se reconoce por lo que lleva, asi que la
                    // foto tiene que poder mirarse sin abrir la ficha.
                    width: 56,
                    height: 56,
                    ...(indice > 0 && { ml: -1.5 }),
                    border: (theme) => `solid 2px ${theme.vars.palette.background.paper}`,
                  }}
                />
              </Tooltip>
            ))}

            {productos.length > FOTOS_VISIBLES && (
              <Box
                sx={{
                  ml: -1.5,
                  px: 1.25,
                  height: 56,
                  display: 'flex',
                  borderRadius: 1,
                  alignItems: 'center',
                  typography: 'caption',
                  color: 'text.secondary',
                  bgcolor: 'background.neutral',
                  border: (theme) => `solid 2px ${theme.vars.palette.background.paper}`,
                }}
              >
                {/* "2+" y no "+2": se lee de corrido con las fotos que tiene
                    al lado —tres fotos y dos mas—, en el mismo orden en que se
                    mira la fila. */}
                {productos.length - FOTOS_VISIBLES}+
              </Box>
            )}
          </Box>
        ) : (
          <Box sx={{ typography: 'caption', color: 'text.disabled' }}>Sin artículos</Box>
        )}
      </TableCell>

      <TableCell>
        {/* Sin icono de calendario: en una columna que se llama "Fecha" y que
            lleva una fecha debajo de otra, solo repite lo que ya dice el dato y
            se come el ancho. */}
        <ListItemText
          primary={fDate(row.createdAt)}
          secondary={fTime(row.createdAt)}
          slotProps={{
            primary: { noWrap: true, sx: { typography: 'body2' } },
            secondary: { sx: { mt: 0.25, typography: 'caption' } },
          }}
        />
      </TableCell>

      <TableCell>
        <ListItemText
          primary={fDopCurrency(row.totalAmount ?? row.subtotal)}
          // UNA SOLICITUD NO SE PAGA: debajo del total salia "solicitud" con el
          // icono de tarjeta, como si fuera una forma de pago. Se deja solo el
          // importe; el estado "Solicitado" ya dice lo que es.
          secondary={
            row.esSolicitud ? null : (
              <Box component="span" sx={{ gap: 0.5, display: 'inline-flex', alignItems: 'center' }}>
                <Iconify icon={pago.icono} width={16} />
                {pago.label}
                {!!ultimosCuatro(row.payment?.cardNumber) &&
                  ` · ${ultimosCuatro(row.payment.cardNumber)}`}
              </Box>
            )
          }
          slotProps={{
            primary: { sx: { typography: 'subtitle2' } },
            secondary: { sx: { mt: 0.25, typography: 'caption', color: 'text.disabled' } },
          }}
        />
      </TableCell>

      <TableCell>
        {/* TODAS LAS ETIQUETAS, DEL MISMO ANCHO. Ajustadas al texto, "Pendiente"
            y "Reembolsado" empezaban en el mismo sitio pero terminaban en dos
            distintos, y la columna quedaba con el borde derecho en zigzag. Con
            un ancho comun, el icono y la palabra caen siempre en la misma
            vertical y la columna se lee de arriba abajo. */}
        <Label
          variant="soft"
          color={estado.color}
          startIcon={estado.icono ? <Iconify icon={estado.icono} /> : null}
          sx={{ width: ANCHO_DE_ETIQUETA, justifyContent: 'flex-start' }}
        >
          {estado.label}
        </Label>
      </TableCell>

      <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }}>
        {/* "VER DETALLES" CON TODAS SUS LETRAS. Estaba escondido detras de los
            tres puntos, que es donde vive lo que casi nunca se usa, y resulta
            que es lo que mas se pulsa de la fila. */}
        <Button
          size="small"
          color="inherit"
          variant="outlined"
          component={RouterLink}
          href={detailsHref}
          sx={{ mr: 0.5 }}
        >
          Ver detalles
        </Button>

        <IconButton
          color={collapseRow.value ? 'inherit' : 'default'}
          onClick={collapseRow.onToggle}
          sx={{ ...(collapseRow.value && { bgcolor: 'action.hover' }) }}
        >
          <Iconify icon="eva:arrow-ios-downward-fill" />
        </IconButton>

        <IconButton color={menuActions.open ? 'inherit' : 'default'} onClick={menuActions.onOpen}>
          <Iconify icon="eva:more-vertical-fill" />
        </IconButton>
      </TableCell>
    </TableRow>
  );

  const renderSecondaryRow = () => (
    <TableRow>
      <TableCell sx={{ p: 0, border: 'none' }} colSpan={8}>
        <Collapse
          in={collapseRow.value}
          timeout="auto"
          unmountOnExit
          sx={{ bgcolor: 'background.neutral' }}
        >
          <Paper sx={{ m: 1.5 }}>
            {row.items.map((item) => (
              <Box
                key={item.id}
                sx={(theme) => ({
                  display: 'flex',
                  alignItems: 'center',
                  p: theme.spacing(1.5, 2, 1.5, 1.5),
                  '&:not(:last-of-type)': {
                    borderBottom: `solid 2px ${theme.vars.palette.background.neutral}`,
                  },
                })}
              >
                <Avatar
                  src={item.coverUrl}
                  variant="rounded"
                  sx={{ width: 48, height: 48, mr: 2 }}
                />

                <ListItemText
                  primary={item.name}
                  secondary={item.sku}
                  slotProps={{
                    primary: { sx: { typography: 'body2' } },
                    secondary: { sx: { color: 'text.disabled' } },
                  }}
                />

                <div>x{item.quantity} </div>

                <Box sx={{ width: 110, textAlign: 'right' }}>{fDopCurrency(item.price)}</Box>
              </Box>
            ))}
          </Paper>
        </Collapse>
      </TableCell>
    </TableRow>
  );

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'right-top' } }}
    >
      <MenuList>
        {canDelete ? (
          <MenuItem
            onClick={() => {
              confirmDialog.onTrue();
              menuActions.onClose();
            }}
            sx={{ color: 'error.main' }}
          >
            <Iconify icon="solar:trash-bin-trash-bold" />
            Eliminar
          </MenuItem>
        ) : null}

        <li>
          <MenuItem component={RouterLink} href={detailsHref} onClick={() => menuActions.onClose()}>
            <Iconify icon="solar:eye-bold" />
            Ver
          </MenuItem>
        </li>
      </MenuList>
    </CustomPopover>
  );

  const renderConfrimDialog = () => (
    <ConfirmDialog
      open={confirmDialog.value}
      onClose={confirmDialog.onFalse}
      title="Eliminar"
      content="Seguro que deseas eliminar este pedido?"
      action={
        <Button variant="contained" color="error" onClick={onDeleteRow}>
          Eliminar
        </Button>
      }
    />
  );

  return (
    <>
      {renderPrimaryRow()}
      {renderSecondaryRow()}
      {renderMenuActions()}
      {renderConfrimDialog()}
    </>
  );
}
