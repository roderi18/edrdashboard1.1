'use client';

import { union, isEqual } from 'es-toolkit';
import { useMemo, useState, useEffect, useCallback } from 'react';

import { paths } from 'src/routes/paths';
import { useRouter, usePathname } from 'src/routes/hooks';

import {
  textoDeTallas,
  combinarTallas,
  carritoSinEntrega,
} from 'src/utils/combos-de-actividad.mjs';

import { useGetProducts } from 'src/actions/product';
import { crearOrdenFirestore, crearSolicitudProductoFirestore } from 'src/services/order-service';
import {
  guardarCarritoUsuario,
  limpiarCarritoUsuario,
  obtenerCarritoUsuario,
} from 'src/services/cart-service';

import { useAuthContext } from 'src/auth/hooks';

import { CheckoutContext } from './checkout-context';

// ----------------------------------------------------------------------

const CHECKOUT_STEPS = ['Carrito', 'Direccion', 'Pago'];

// Un carrito solo de combos de campamento no pasa por "Direccion": se recoge
// en la actividad. La URL sigue contando 0, 1, 2 (el paso 1 se salta) para que
// los enlaces y "completado" (3) valgan igual; lo que cambia es lo que se ve.
const PASOS_SIN_ENTREGA = ['Carrito', 'Pago'];
const PASO_DIRECCION = 1;

const initialState = {
  items: [],
  order: null,
  receipt: null,
  subtotal: 0,
  total: 0,
  discount: 0,
  shipping: 0,
  billing: null,
  totalItems: 0,
};

// ----------------------------------------------------------------------

export function CheckoutProvider({ children }) {
  return <CheckoutContainer>{children}</CheckoutContainer>;
}

// ----------------------------------------------------------------------

function CheckoutContainer({ children }) {
  const { user } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();
  const [checkoutStep, setCheckoutStep] = useState(null);
  const checkoutPath = pathname.includes(paths.dashboard.checkout)
    ? paths.dashboard.checkout
    : paths.product.checkout;
  const isCheckoutPath = [paths.product.checkout, paths.dashboard.checkout].some((path) =>
    pathname.includes(path)
  );
  const activeStep = isCheckoutPath ? checkoutStep : null;

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState(initialState);

  const normalizeCheckoutState = useCallback((nextState = {}) => {
    const items = Array.isArray(nextState?.items) ? nextState.items : [];
    const totalItems = items.reduce((total, item) => total + Number(item.quantity || 0), 0);
    const subtotal = items.reduce(
      (total, item) => total + Number(item.quantity || 0) * Number(item.price || 0),
      0
    );
    const discount = Number(nextState?.discount ?? 0);
    // Sin entrega no hay envio: si antes se eligio "Expreso" con otro carrito,
    // no se cuela en el total de una inscripcion.
    const shipping = carritoSinEntrega(items) ? 0 : Number(nextState?.shipping ?? 0);

    return {
      ...initialState,
      ...nextState,
      items,
      subtotal,
      totalItems,
      discount,
      shipping,
      total: subtotal - discount + shipping,
    };
  }, []);

  const commitState = useCallback(
    (updater, { persist = true } = {}) => {
      setState((previousState) => {
        const nextCandidate =
          typeof updater === 'function'
            ? updater(previousState)
            : { ...previousState, ...updater };
        const nextState = normalizeCheckoutState(nextCandidate);

        if (persist && user) {
          void guardarCarritoUsuario({ user, state: nextState });
        }

        return nextState;
      });
    },
    [normalizeCheckoutState, user]
  );

  const setField = useCallback(
    (field, value) => {
      commitState({ [field]: value });
    },
    [commitState]
  );

  const sinEntrega = carritoSinEntrega(state.items);

  // EL PRECIO DE UN COMBO ES EL DE HOY. La línea guardaba el precio del momento
  // en que se agregó: si la tienda (o el Designer) lo cambiaba, el carrito seguía
  // cobrando el viejo. Solo las líneas de combos: los demás productos eligen su
  // precio (miembro registrado o no) al agregarse.
  const { products } = useGetProducts();

  useEffect(() => {
    if (loading || !products.length) return;

    const productoDe = new Map(products.map((producto) => [producto.id, producto]));
    // Una línea de combo agregada antes de la marca `sinEntrega` se reconoce por
    // su producto (lleva `combo`) y se marca de paso.
    const esCombo = (item) => item.sinEntrega || Boolean(productoDe.get(item.id)?.combo);
    const precioDe = (item) => Number(productoDe.get(item.id)?.price);
    const viejo = (item) =>
      esCombo(item) &&
      (!item.sinEntrega ||
        (Number.isFinite(precioDe(item)) && precioDe(item) !== Number(item.price)));

    if (!state.items.some(viejo)) return;

    commitState((previo) => ({
      ...previo,
      items: previo.items.map((item) => {
        if (!viejo(item)) return item;

        const price = Number.isFinite(precioDe(item)) ? precioDe(item) : Number(item.price);

        return {
          ...item,
          sinEntrega: true,
          price,
          subtotal: price * Number(item.quantity || 0),
        };
      }),
    }));
  }, [commitState, loading, products, state.items]);

  const canReset = !isEqual(state, initialState);
  const completed = activeStep === CHECKOUT_STEPS.length;

  useEffect(() => {
    const initializeCheckout = async () => {
      try {
        setLoading(true);
        if (!user) {
          setState(initialState);
          return;
        }

        const restoredValue = await obtenerCarritoUsuario(user);
        setState(normalizeCheckoutState(restoredValue));
      } finally {
        setLoading(false);
      }
    };

    initializeCheckout();
  }, [normalizeCheckoutState, user]);

  useEffect(() => {
    if (!isCheckoutPath || typeof window === 'undefined') {
      setCheckoutStep(null);
      return undefined;
    }

    const syncCheckoutStep = () => {
      const params = new URLSearchParams(window.location.search);
      setCheckoutStep(Number(params.get('step') ?? 0));
    };

    syncCheckoutStep();
    window.addEventListener('popstate', syncCheckoutStep);

    return () => {
      window.removeEventListener('popstate', syncCheckoutStep);
    };
  }, [isCheckoutPath, pathname]);

  const onChangeStep = useCallback(
    (type, step) => {
      const stepNumbers = {
        back: (activeStep ?? 0) - 1,
        next: (activeStep ?? 0) + 1,
        go: step ?? 0,
      };

      let targetStep = stepNumbers[type];

      if (sinEntrega && targetStep === PASO_DIRECCION) {
        targetStep = type === 'back' ? 0 : PASO_DIRECCION + 1;
      }
      const queryString = new URLSearchParams({ step: `${targetStep}` }).toString();
      const redirectPath = targetStep === 0 ? checkoutPath : `${checkoutPath}?${queryString}`;

      setCheckoutStep(targetStep);
      router.push(redirectPath);
    },
    [activeStep, checkoutPath, router, sinEntrega]
  );

  // Quien llega a "?step=1" con un carrito sin entrega (un enlace viejo, el
  // boton Atras del navegador) pasa directo al pago.
  useEffect(() => {
    if (!loading && sinEntrega && activeStep === PASO_DIRECCION) {
      const queryString = new URLSearchParams({ step: `${PASO_DIRECCION + 1}` }).toString();

      setCheckoutStep(PASO_DIRECCION + 1);
      router.replace(`${checkoutPath}?${queryString}`);
    }
  }, [activeStep, checkoutPath, loading, router, sinEntrega]);

  const onAddToCart = useCallback(
    (newItem) => {
      commitState((previousState) => {
        const updatedItems = previousState.items.map((item) => {
          if (item.id === newItem.id) {
            // Un combo con tallas ("M×2 · L×1") suma también su reparto: sin
            // esto, agregar el mismo combo dos veces dejaba solo las tallas de
            // la primera vez.
            const tallas =
              item.tallas || newItem.tallas ? combinarTallas(item.tallas, newItem.tallas) : null;

            return {
              ...item,
              colors: union(item.colors, newItem.colors),
              quantity: item.quantity + newItem.quantity,
              ...(newItem.sinEntrega && { sinEntrega: true }),
              ...(tallas && { tallas, size: textoDeTallas(tallas) }),
            };
          }
          return item;
        });

        if (!updatedItems.some((item) => item.id === newItem.id)) {
          updatedItems.push(newItem);
        }

        return { ...previousState, items: updatedItems };
      });
    },
    [commitState]
  );

  const onDeleteCartItem = useCallback(
    (itemId) => {
      commitState((previousState) => ({
        ...previousState,
        items: previousState.items.filter((item) => item.id !== itemId),
      }));
    },
    [commitState]
  );

  const onChangeItemQuantity = useCallback(
    (itemId, quantity) => {
      commitState((previousState) => ({
        ...previousState,
        items: previousState.items.map((item) =>
          item.id === itemId ? { ...item, quantity } : item
        ),
      }));
    },
    [commitState]
  );

  const onCreateBillingAddress = useCallback(
    (address) => {
      commitState({ billing: address });
    },
    [commitState]
  );

  const onApplyDiscount = useCallback(
    (discount) => {
      commitState({ discount });
    },
    [commitState]
  );

  const onApplyShipping = useCallback(
    (shipping) => {
      commitState({ shipping });
    },
    [commitState]
  );

  const onResetCart = useCallback(() => {
    if (completed) {
      setState(initialState);
      if (user) {
        void limpiarCarritoUsuario(user);
      }
    }
  }, [completed, user]);

  const onCreateOrder = useCallback(
    async (paymentData) => {
      const purchase = await crearOrdenFirestore({
        user,
        // Sin entrega, la orden no guarda una direccion que nadie pidio.
        checkoutState: sinEntrega ? { ...state, billing: null, shipping: 0 } : state,
        paymentData,
      });

      if (purchase) {
        commitState(
          {
            ...state,
            items: [],
            subtotal: 0,
            total: 0,
            totalItems: 0,
            order: purchase.order,
            receipt: purchase.invoice,
          },
          { persist: false }
        );
      }

      return purchase;
    },
    [commitState, sinEntrega, state, user]
  );

  const onCreateEvaluationOrder = useCallback(
    async ({ item }) => {
      const evaluationState = normalizeCheckoutState({
        ...state,
        items: [item],
        billing: state.billing,
        shipping: 0,
        discount: 0,
      });
      const purchase = await crearOrdenFirestore({
        user,
        checkoutState: evaluationState,
        paymentData: {
          payment: 'evaluacion',
          reference: 'Evaluación de producto restringido',
        },
      });

      if (purchase) {
        commitState(
          {
            ...evaluationState,
            items: [],
            subtotal: 0,
            total: 0,
            totalItems: 0,
            order: purchase.order,
            receipt: purchase.invoice,
          },
          { persist: false }
        );
      }

      return purchase;
    },
    [commitState, normalizeCheckoutState, state, user]
  );

  // SOLICITAR UN PRODUCTO AGOTADO. Termina en el mismo cierre del carrito que
  // una compra, pero con la orden en estado Solicitado. Los articulos que la
  // persona ya tenia en el carrito se quedan: la solicitud va aparte.
  const onCreateProductRequest = useCallback(
    async ({ item }) => {
      const request = await crearSolicitudProductoFirestore({ user, item });

      if (request) {
        commitState({ ...state, order: request.order, receipt: null }, { persist: false });
      }

      return request;
    },
    [commitState, state, user]
  );

  const memoizedValue = useMemo(
    () => ({
      state,
      setState: commitState,
      setField,
      /********/
      activeStep,
      onChangeStep,
      sinEntrega,
      steps: sinEntrega ? PASOS_SIN_ENTREGA : CHECKOUT_STEPS,
      // El paso que pinta el indicador: sin "Direccion", el pago es el segundo.
      pasoVisible: sinEntrega && (activeStep ?? 0) > PASO_DIRECCION ? activeStep - 1 : activeStep,
      /********/
      canReset,
      loading,
      completed,
      /********/
      onAddToCart,
      onResetCart,
      onCreateOrder,
      onCreateEvaluationOrder,
      onCreateProductRequest,
      onApplyDiscount,
      onApplyShipping,
      onDeleteCartItem,
      onChangeItemQuantity,
      onCreateBillingAddress,
    }),
    [
      state,
      loading,
      canReset,
      setField,
      commitState,
      completed,
      activeStep,
      sinEntrega,
      onResetCart,
      onCreateOrder,
      onCreateEvaluationOrder,
      onCreateProductRequest,
      onAddToCart,
      onChangeStep,
      onApplyDiscount,
      onApplyShipping,
      onDeleteCartItem,
      onChangeItemQuantity,
      onCreateBillingAddress,
    ]
  );

  return <CheckoutContext value={memoizedValue}>{children}</CheckoutContext>;
}
