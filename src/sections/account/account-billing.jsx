import { useState, useEffect, useCallback } from 'react';

import Grid from '@mui/material/Grid';

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

export function AccountBilling({ cards, plans, invoices, addressBook, loadingInvoices = false }) {
  const [billingAddresses, setBillingAddresses] = useState(() =>
    normalizePrimaryAddress(addressBook)
  );

  useEffect(() => {
    setBillingAddresses(normalizePrimaryAddress(addressBook));
  }, [addressBook]);

  const handleSetPrimaryAddress = useCallback((addressId) => {
    setBillingAddresses((current) =>
      normalizePrimaryAddress(
        current.map((address) => ({
          ...address,
          primary: String(address.id) === String(addressId),
        }))
      )
    );
  }, []);

  const handleCreateAddress = useCallback((address) => {
    setBillingAddresses((current) => {
      const nextAddress = {
        ...address,
        id: address.id || `address-${Date.now()}`,
        locked: false,
        editLocked: false,
      };

      const nextAddresses = nextAddress.primary
        ? [...current.map((item) => ({ ...item, primary: false })), nextAddress]
        : [...current, nextAddress];

      return normalizePrimaryAddress(nextAddresses);
    });
  }, []);

  const handleUpdateAddress = useCallback((addressId, updates) => {
    setBillingAddresses((current) =>
      normalizePrimaryAddress(
        current.map((address) =>
          String(address.id) === String(addressId)
            ? { ...address, ...updates }
            : {
                ...address,
                ...(updates.primary ? { primary: false } : {}),
              }
        )
      )
    );
  }, []);

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
        />
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <AccountBillingHistory invoices={invoices} loading={loadingInvoices} />
      </Grid>
    </Grid>
  );
}
