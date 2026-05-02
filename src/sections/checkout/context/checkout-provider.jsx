'use client';

import { union, isEqual } from 'es-toolkit';
import { useMemo, useState, Suspense, useEffect, useCallback } from 'react';

import { paths } from 'src/routes/paths';
import { useRouter, usePathname, useSearchParams } from 'src/routes/hooks';

import {
  crearOrdenFirestore,
} from 'src/services/order-service';
import {
  guardarCarritoUsuario,
  limpiarCarritoUsuario,
  obtenerCarritoUsuario,
} from 'src/services/cart-service';

import { SplashScreen } from 'src/components/loading-screen';

import { useAuthContext } from 'src/auth/hooks';

import { CheckoutContext } from './checkout-context';

// ----------------------------------------------------------------------

const CHECKOUT_STEPS = ['Carrito', 'Direccion', 'Pago'];

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
  return (
    <Suspense fallback={<SplashScreen />}>
      <CheckoutContainer>{children}</CheckoutContainer>
    </Suspense>
  );
}

// ----------------------------------------------------------------------

function CheckoutContainer({ children }) {
  const { user } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const checkoutPath = pathname.includes(paths.dashboard.checkout)
    ? paths.dashboard.checkout
    : paths.product.checkout;
  const activeStep = [paths.product.checkout, paths.dashboard.checkout].some((path) =>
    pathname.includes(path)
  )
    ? Number(searchParams.get('step') ?? 0)
    : null;

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
    const shipping = Number(nextState?.shipping ?? 0);

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

  const onChangeStep = useCallback(
    (type, step) => {
      const stepNumbers = {
        back: (activeStep ?? 0) - 1,
        next: (activeStep ?? 0) + 1,
        go: step ?? 0,
      };

      const targetStep = stepNumbers[type];
      const queryString = new URLSearchParams({ step: `${targetStep}` }).toString();
      const redirectPath = targetStep === 0 ? checkoutPath : `${checkoutPath}?${queryString}`;

      router.push(redirectPath);
    },
    [activeStep, checkoutPath, router]
  );

  const onAddToCart = useCallback(
    (newItem) => {
      commitState((previousState) => {
        const updatedItems = previousState.items.map((item) => {
          if (item.id === newItem.id) {
            return {
              ...item,
              colors: union(item.colors, newItem.colors),
              quantity: item.quantity + newItem.quantity,
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
        checkoutState: state,
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
      steps: CHECKOUT_STEPS,
      /********/
      canReset,
      loading,
      completed,
      /********/
      onAddToCart,
      onResetCart,
      onCreateOrder,
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
      onResetCart,
      onCreateOrder,
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
