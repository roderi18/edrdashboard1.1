'use client';

import { useRef, useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fDopCurrency } from 'src/utils/format-number';
import {
  sanearCombo,
  extrasDelCombo,
  pedidoDeCombos,
  estadoDeTallas,
  combosDeActividad,
  parcheAdicionalDe,
  camisetaAdicionalDe,
} from 'src/utils/combos-de-actividad.mjs';

import { azulLegible } from 'src/theme/azul-legible';
import { useGetProducts } from 'src/actions/product';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useCheckoutContext } from 'src/sections/checkout/context';

import { ComboDeActividad } from './combo-de-actividad';
import { ComboDeActividadEstilo2 } from './combo-de-actividad-estilo-2';
import { PasoDeTallas, ResumenDelPedido, PasosDeInscripcion } from './tallas-de-combos';

// ----------------------------------------------------------------------
// "INSCRIBIRME" EN UNA ACTIVIDAD = COMPRAR SUS COMBOS.
//
// Salen los combos del campamento (productos de la tienda con la categoría que
// se llama como la actividad; regla en `src/utils/combos-de-actividad.mjs`), se
// elige cuántos de cada uno —más de uno para inscribir a más personas—, sus
// extras opcionales, y todo va al carrito de siempre: misma orden, pago y recibo
// que cualquier compra.
//
// Sin combos, el botón de la tarjeta lleva a su enlace de siempre: este diálogo
// solo se abre cuando la tienda ya tiene la categoría de la actividad.
// ----------------------------------------------------------------------

// Un solo reloj para todos los conteos, y solo mientras el diálogo está abierto
// y algún combo tiene fecha de cierre: tres relojes por separado se desfasaban.
function useAhora(activo) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!activo) return undefined;

    setAhora(Date.now());
    const reloj = setInterval(() => setAhora(Date.now()), 1000);

    return () => clearInterval(reloj);
  }, [activo]);

  return ahora;
}

// LOS ESTILOS DE LOS COMBOS, a elegir en la cabecera. El 1 es el de siempre; el
// 2, la propuesta con "Incluye" en lista, extras compactos y subtotal por combo.
// Los dos pintan los mismos datos con las mismas cuentas, y el elegido vale para
// todos los combos. Se recuerda en este navegador (es una preferencia de quien
// mira, no un dato de nadie).
const ESTILOS_DE_COMBO = [
  { valor: '1', etiqueta: 'Estilo 1', Componente: ComboDeActividad, anchoMaximo: 1100 },
  { valor: '2', etiqueta: 'Estilo 2', Componente: ComboDeActividadEstilo2, anchoMaximo: 900 },
];
const CLAVE_ESTILO = 'inscripcion:estilo-de-combo';
// El que sale si la persona no ha elegido otro: el 2.
const ESTILO_POR_DEFECTO = '2';

const estiloGuardado = () => {
  try {
    const guardado = window.localStorage.getItem(CLAVE_ESTILO);
    return ESTILOS_DE_COMBO.some((estilo) => estilo.valor === guardado)
      ? guardado
      : ESTILO_POR_DEFECTO;
  } catch {
    return ESTILO_POR_DEFECTO;
  }
};

export function InscripcionActividadDialog({ abierto, onCerrar, actividad, destinoSinCombos }) {
  const router = useRouter();
  const { onAddToCart } = useCheckoutContext();
  const { products, productsLoading } = useGetProducts();
  const [cantidades, setCantidades] = useState({});
  const [cantidadesExtras, setCantidadesExtras] = useState({});
  const [estilo, setEstilo] = useState(estiloGuardado);
  // PASO 1, los combos; PASO 2, tallas y adicionales (si hay camisetas o
  // adicionales que ofrecer); PASO 3, el resumen de lo que irá al carrito.
  // Volver atrás conserva todo lo elegido.
  const [paso, setPaso] = useState(1);
  // UN reparto para todas las camisetas de los combos: `{ M: 2, L: 1 }`.
  const [tallas, setTallas] = useState({});
  // Los adicionales, cerrados hasta que se responde "Sí".
  const [camisetasExtra, setCamisetasExtra] = useState({ abierto: false, reparto: {} });
  const [parchesExtra, setParchesExtra] = useState({ abierto: false, cantidad: 0 });
  // LOS PASOS 2 Y 3 MIDEN LO MISMO QUE EL 1: se mide el contenido al salir de él
  // y los siguientes toman ese alto (con su propio desplazamiento si no cabe).
  // Sin esto el diálogo se encogía de golpe al cambiar de paso.
  const contenidoRef = useRef(null);
  const [altoDelPaso1, setAltoDelPaso1] = useState(null);

  // Cada estilo trae su ancho: el 1 pone el conteo y la cantidad en la misma fila
  // y necesita más sitio; el 2 apila y se lee mejor más estrecho.
  const estiloElegido =
    ESTILOS_DE_COMBO.find((opcion) => opcion.valor === estilo) ??
    ESTILOS_DE_COMBO.find((opcion) => opcion.valor === ESTILO_POR_DEFECTO);
  const ComboDelEstilo = estiloElegido.Componente;

  const cambiarEstilo = (valor) => {
    setEstilo(valor);
    try {
      window.localStorage.setItem(CLAVE_ESTILO, valor);
    } catch {
      // Sin almacenamiento (ventana privada): el estilo vale solo hasta cerrar.
    }
  };

  const combos = useMemo(
    () => combosDeActividad(products, actividad?.titulo, actividad?.categoriaCombos),
    [products, actividad?.titulo, actividad?.categoriaCombos]
  );
  const ahora = useAhora(abierto && combos.some((combo) => sanearCombo(combo.combo)?.finVenta));

  // Sin combos en la tienda, el botón hace lo de siempre: su enlace.
  useEffect(() => {
    if (abierto && !productsLoading && !combos.length) {
      onCerrar();
      router.push(destinoSinCombos);
    }
  }, [abierto, productsLoading, combos.length, onCerrar, router, destinoSinCombos]);

  // Se abre siempre en cero: empezar con uno de cada llevaba a comprar de más
  // sin darse cuenta.
  useEffect(() => {
    if (!abierto) {
      setCantidades({});
      setCantidadesExtras({});
      setTallas({});
      setCamisetasExtra({ abierto: false, reparto: {} });
      setParchesExtra({ abierto: false, cantidad: 0 });
      setPaso(1);
    }
  }, [abierto]);

  const camisetaAdicional = camisetaAdicionalDe({ combos, cantidades, productos: products });
  const parcheAdicional = parcheAdicionalDe({ combos, cantidades, productos: products });
  const { items, personas, total } = pedidoDeCombos({
    combos,
    productos: products,
    cantidades,
    cantidadesExtras,
    tallas,
    adicionales: {
      camiseta: {
        producto: camisetaAdicional,
        reparto: camisetasExtra.abierto ? camisetasExtra.reparto : {},
      },
      parche: {
        producto: parcheAdicional,
        cantidad: parchesExtra.abierto ? parchesExtra.cantidad : 0,
      },
    },
  });
  const estadoTallas = estadoDeTallas({ combos, cantidades, tallas });
  // El paso 2 solo existe si hay camisetas que repartir o adicionales que ofrecer.
  const hayPaso2 = estadoTallas.hacenFalta || Boolean(camisetaAdicional || parcheAdicional);

  const avanzar = () => {
    if (paso === 1) setAltoDelPaso1(contenidoRef.current?.offsetHeight ?? null);
    setPaso(paso === 1 && hayPaso2 ? 2 : 3);
  };
  const retroceder = () => setPaso(paso === 3 && hayPaso2 ? 2 : 1);

  const SUBTITULOS = {
    1: 'Elige tu combo. Puedes llevar más de uno para inscribir a otras personas.',
    2: 'Elige la talla de las camisetas y, si quieres, camisetas o parches adicionales.',
    3: 'Revisa lo que se agregará al carrito.',
  };

  // DOS SALIDAS DEL RESUMEN: "Agregar al carrito" lo deja en el carrito y sigue
  // en la portada (por si quiere seguir comprando); "Pagar ahora" lo agrega y
  // salta la revisión del carrito y la dirección, directo al pago: un combo se
  // recoge en el campamento (ver `carritoSinEntrega`).
  const agregarAlCarrito = ({ pagarAhora = false } = {}) => {
    items.forEach((item) => onAddToCart(item));
    toast.success(
      personas === 1 ? 'Combo agregado al carrito.' : `${personas} combos agregados al carrito.`
    );
    onCerrar();

    if (pagarAhora) router.push(`${paths.dashboard.checkout}?step=2`);
  };

  return (
    <Dialog
      open={abierto && (productsLoading || combos.length > 0)}
      onClose={onCerrar}
      fullWidth
      maxWidth="lg"
      slotProps={{
        paper: {
          sx: {
            width: 'calc(100% - 32px)',
            maxWidth: estiloElegido.anchoMaximo,
            borderRadius: 2.5,
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Box
            sx={(theme) => ({
              width: 52,
              height: 52,
              flexShrink: 0,
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 2,
              bgcolor: 'background.neutral',
              ...azulLegible(theme),
            })}
          >
            <Iconify icon="custom:categoria-campamentos" width={30} />
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h5" sx={(theme) => azulLegible(theme)}>
              Inscribirme · {actividad?.titulo}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
              {SUBTITULOS[paso]}
            </Typography>
            <Stack
              direction="row"
              spacing={2}
              sx={{ mt: 1.25, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
            >
              <PasosDeInscripcion paso={paso} conPaso2={hayPaso2} />
              {paso === 2 && estadoTallas.hacenFalta && (
                <Label color={estadoTallas.completo ? 'success' : 'warning'}>
                  Camisetas asignadas {estadoTallas.asignadas} de {estadoTallas.unidades}
                </Label>
              )}
            </Stack>
          </Box>

          <TextField
            select
            size="small"
            label="Estilo"
            value={estilo}
            onChange={(event) => cambiarEstilo(event.target.value)}
            sx={{ minWidth: 120, flexShrink: 0, alignSelf: 'flex-start' }}
          >
            {ESTILOS_DE_COMBO.map((opcion) => (
              <MenuItem key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogTitle>

      <DialogContent
        ref={contenidoRef}
        dividers
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2.5,
          ...(paso > 1 && altoDelPaso1 && { height: altoDelPaso1, flex: 'none' }),
        }}
      >
        {productsLoading && (
          <Stack spacing={2}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={150} />
            ))}
          </Stack>
        )}

        {!productsLoading && paso === 2 && (
          <PasoDeTallas
            estilo={estilo}
            estado={estadoTallas}
            tallas={tallas}
            onCambiarTalla={(talla, valor) =>
              setTallas((actual) => ({ ...actual, [talla]: valor }))
            }
            camiseta={{
              producto: camisetaAdicional,
              ...camisetasExtra,
              // "No" cierra y borra lo elegido.
              onAbrir: (siAbre) =>
                setCamisetasExtra((actual) => ({
                  abierto,
                  reparto: abierto ? actual.reparto : {},
                })),
              onCambiar: (talla, valor) =>
                setCamisetasExtra((actual) => ({
                  ...actual,
                  reparto: { ...actual.reparto, [talla]: valor },
                })),
            }}
            parche={{
              producto: parcheAdicional,
              ...parchesExtra,
              onAbrir: (siAbre) =>
                setParchesExtra((actual) => ({
                  abierto: siAbre,
                  cantidad: siAbre ? actual.cantidad : 0,
                })),
              onCambiar: (cantidad) => setParchesExtra((actual) => ({ ...actual, cantidad })),
            }}
          />
        )}

        {!productsLoading && paso === 3 && <ResumenDelPedido items={items} total={total} />}

        {!productsLoading && paso === 1 && (
          <Stack spacing={2}>
            {combos.map((combo, puesto) => (
              <ComboDelEstilo
                key={combo.id}
                combo={combo}
                puesto={puesto}
                ahora={ahora}
                cantidad={cantidades[combo.id] ?? 0}
                onCantidad={(valor) =>
                  setCantidades((actual) => ({ ...actual, [combo.id]: valor }))
                }
                extras={extrasDelCombo(combo, products)}
                cantidadesExtras={cantidadesExtras}
                onExtra={(idExtra, valor) =>
                  setCantidadesExtras((actual) => ({
                    ...actual,
                    [`${combo.id}:${idExtra}`]: valor,
                  }))
                }
              />
            ))}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, justifyContent: 'space-between' }}>
        <Typography variant="h6">{personas > 0 ? `Total: ${fDopCurrency(total)}` : ''}</Typography>

        <Stack direction="row" spacing={1}>
          {paso > 1 ? (
            <Button
              color="inherit"
              startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
              onClick={retroceder}
            >
              Volver
            </Button>
          ) : (
            <Button color="inherit" onClick={onCerrar}>
              Cancelar
            </Button>
          )}

          {paso < 3 ? (
            <Button
              size="large"
              variant="contained"
              // En el paso 2, solo con todas las camisetas de los combos asignadas.
              disabled={!personas || (paso === 2 && !estadoTallas.completo)}
              endIcon={<Iconify icon="eva:arrow-ios-forward-fill" />}
              onClick={avanzar}
            >
              {paso === 1 && hayPaso2 ? 'Siguiente: tallas' : 'Siguiente: resumen'}
            </Button>
          ) : (
            <>
              <Button
                size="large"
                variant="outlined"
                color="inherit"
                disabled={!personas}
                startIcon={<Iconify icon="solar:cart-plus-bold" />}
                onClick={() => agregarAlCarrito()}
              >
                Agregar al carrito
              </Button>
              <Button
                size="large"
                variant="contained"
                disabled={!personas}
                startIcon={<Iconify icon="solar:card-bold" />}
                onClick={() => agregarAlCarrito({ pagarAhora: true })}
              >
                Pagar ahora
              </Button>
            </>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
