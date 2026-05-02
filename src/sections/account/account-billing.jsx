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

export function AccountBilling({ cards, plans, invoices, addressBook }) {
  const [billingAddresses, setBillingAddresses] = useState(() => sortBillingAddresses(addressBook));

  useEffect(() => {
    setBillingAddresses(sortBillingAddresses(addressBook));
  }, [addressBook]);

  const handleSetPrimaryAddress = useCallback((addressId) => {
    setBillingAddresses((current) =>
      sortBillingAddresses(
        current.map((address) => ({
          ...address,
          primary: address.id === 'dest-address',
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

      const nextAddresses = [...current, { ...nextAddress, primary: false }];

      return sortBillingAddresses(nextAddresses);
    });
  }, []);

  const handleUpdateAddress = useCallback((addressId, updates) => {
    setBillingAddresses((current) =>
      sortBillingAddresses(
        current.map((address) =>
          String(address.id) === String(addressId) ? { ...address, ...updates } : address
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
        <AccountBillingHistory invoices={invoices} />
      </Grid>
    </Grid>
  );
}
