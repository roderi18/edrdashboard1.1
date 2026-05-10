'use client';

import { useState, useEffect } from 'react';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';
import { obtenerReciboFirestorePorId } from 'src/services/receipt-service';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { InvoiceCreateEditForm } from '../invoice-create-edit-form';

// ----------------------------------------------------------------------

export function InvoiceEditView({ invoice, invoiceId }) {
  const [resolvedInvoice, setResolvedInvoice] = useState(invoice);

  useEffect(() => {
    let active = true;

    const loadInvoice = async () => {
      if (invoice || !invoiceId) return;

      const firestoreInvoice = await obtenerReciboFirestorePorId(invoiceId);

      if (active) {
        setResolvedInvoice(firestoreInvoice);
      }
    };

    loadInvoice();

    return () => {
      active = false;
    };
  }, [invoice, invoiceId]);

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar"
        backHref={paths.dashboard.invoice.root}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Recibos', href: paths.dashboard.invoice.root },
          { name: resolvedInvoice?.invoiceNumber },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <InvoiceCreateEditForm currentInvoice={resolvedInvoice} />
    </DashboardContent>
  );
}
