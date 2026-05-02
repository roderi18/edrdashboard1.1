import { useState, useEffect, useCallback } from 'react';

import Grid from '@mui/material/Grid';

import {
  guardarDireccionUsuario,
  eliminarDireccionUsuario,
  marcarDireccionPredeterminadaUsuario,
} from 'src/services/address-service';

import { AccountBillingPlan } from './account-billing-plan';
import { AccountBillingPayment } from './account-billing-payment';
import { AccountBillingHistory } from './account-billing-history';
import { AccountBillingAddress } from './account-billing-address';

// ----------------------------------------------------------------------

const getAddressOrder = (address) => {
  if (address.id === 'dest-address') return 0;
  if (address.id === 'member-primary-address') return 1;
  return 2;
};

const sortBillingAddresses = (addresses = []) =>
  [...addresses].sort((a, b) => getAddressOrder(a) - getAddressOrder(b));

const normalizePrimaryAddress = (addresses = []) => {
  const primaryAddress = addresses.find((address) => address.primary) || addresses[0];

  return sortBillingAddresses(
    addresses.map((address) => ({
      ...address,
      primary: String(address.id) === String(primaryAddress?.id),
    }))
  );
};

export function AccountBilling({
  user,
  cards,
  plans,
  invoices,
  addressBook,
  loadingInvoices = false,
}) {
  const [billingAddresses, setBillingAddresses] = useState(() =>
    normalizePrimaryAddress(addressBook)
  );

  useEffect(() => {
    setBillingAddresses(normalizePrimaryAddress(addressBook));
  }, [addressBook]);

  const handleSetPrimaryAddress = useCallback(
    async (addressId) => {
      setBillingAddresses((current) =>
        normalizePrimaryAddress(
          current.map((address) => ({
            ...address,
            primary: String(address.id) === String(addressId),
          }))
        )
      );

      if (user) {
        await marcarDireccionPredeterminadaUsuario({ user, addressId });
      }
    },
    [user]
  );

  const handleCreateAddress = useCallback(
    async (address) => {
      const savedAddress = user
        ? await guardarDireccionUsuario({
            user,
            address: {
              ...address,
              locked: false,
              editLocked: false,
            },
          })
        : {
            ...address,
            id: address.id || `address-${Date.now()}`,
            locked: false,
            editLocked: false,
          };

      if (!savedAddress) return;

      setBillingAddresses((current) => {
        const nextAddresses = savedAddress.primary
          ? [...current.map((item) => ({ ...item, primary: false })), savedAddress]
          : [...current, savedAddress];

        return normalizePrimaryAddress(nextAddresses);
      });
    },
    [user]
  );

  const handleUpdateAddress = useCallback(
    async (addressId, updates) => {
      const savedAddress = user
        ? await guardarDireccionUsuario({
            user,
            addressId,
            address: updates,
          })
        : { ...updates, id: addressId };

      if (!savedAddress) return;

      setBillingAddresses((current) =>
        normalizePrimaryAddress(
          current.map((address) =>
            String(address.id) === String(addressId)
              ? { ...address, ...savedAddress }
              : {
                  ...address,
                  ...(savedAddress.primary ? { primary: false } : {}),
                }
          )
        )
      );
    },
    [user]
  );

  const handleDeleteAddress = useCallback(
    async (addressId) => {
      setBillingAddresses((current) =>
        normalizePrimaryAddress(current.filter((address) => String(address.id) !== String(addressId)))
      );

      if (user) {
        await eliminarDireccionUsuario(addressId);
      }
    },
    [user]
  );

  return (
    <Grid container spacing={5}>
      <Grid size={{ xs: 12, md: 8 }}>
        <AccountBillingPlan plans={plans} cardList={cards} addressBook={billingAddresses} />
        <AccountBillingPayment cards={cards} />
        <AccountBillingAddress
          addressBook={billingAddresses}
          onSetPrimary={handleSetPrimaryAddress}
          onCreateAddress={handleCreateAddress}
          onUpdateAddress={handleUpdateAddress}
          onDeleteAddress={handleDeleteAddress}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <AccountBillingHistory invoices={invoices} loading={loadingInvoices} />
      </Grid>
    </Grid>
  );
}
