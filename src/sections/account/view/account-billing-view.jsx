'use client';

import { useState, useEffect } from 'react';

import { _userPlans, _userPayment } from 'src/_mock';
import { listarRecibosUsuarioFirestore } from 'src/services/receipt-service';
import { cargarDireccionesUsuarioFirestore } from 'src/services/address-service';

import { useAuthContext } from 'src/auth/hooks';

import { AccountBilling } from '../account-billing';

// ----------------------------------------------------------------------

export function AccountBillingView() {
  const { user } = useAuthContext();
  const [addressBook, setAddressBook] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);

  useEffect(() => {
    const loadBillingData = async () => {
      try {
        setLoadingInvoices(true);

        const [nextAddressBook, nextInvoices] = await Promise.all([
          cargarDireccionesUsuarioFirestore(user),
          listarRecibosUsuarioFirestore(user),
        ]);

        setAddressBook(nextAddressBook);
        setInvoices(nextInvoices);
      } finally {
        setLoadingInvoices(false);
      }
    };

    loadBillingData();
  }, [user]);

  return (
    <AccountBilling
      user={user}
      plans={_userPlans}
      cards={_userPayment}
      invoices={invoices}
      addressBook={addressBook}
      loadingInvoices={loadingInvoices}
    />
  );
}
