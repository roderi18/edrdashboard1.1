'use client';

import { useState, useEffect } from 'react';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';
import { obtenerReciboFirestorePorId } from 'src/services/receipt-service';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { InvoiceDetails } from '../invoice-details';

// ----------------------------------------------------------------------

export function InvoiceDetailsView({ invoice, invoiceId }) {
  const [resolvedInvoice, setResolvedInvoice] = useState(invoice);

  useEffect(() => {
    const loadInvoice = async () => {
      if (invoice?.id === invoiceId) return;

      const currentInvoice = await obtenerReciboFirestorePorId(invoiceId);

      if (currentInvoice) {
        setResolvedInvoice(currentInvoice);
      }
    };

    loadInvoice();
  }, [invoice, invoiceId]);

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading={resolvedInvoice?.invoiceNumber}
        backHref={paths.dashboard.invoice.root}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Recibos', href: paths.dashboard.invoice.root },
          { name: resolvedInvoice?.invoiceNumber },
        ]}
        sx={{ mb: 3 }}
      />

      <InvoiceDetails invoice={resolvedInvoice} />
    </DashboardContent>
  );
}
