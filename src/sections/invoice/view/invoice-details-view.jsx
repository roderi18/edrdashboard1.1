'use client';

import { useState, useEffect } from 'react';

import { paths } from 'src/routes/paths';

import { getLocalInvoiceById } from 'src/utils/local-commerce-storage';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { InvoiceDetails } from '../invoice-details';

// ----------------------------------------------------------------------

export function InvoiceDetailsView({ invoice, invoiceId }) {
  const [resolvedInvoice, setResolvedInvoice] = useState(invoice);

  useEffect(() => {
    if (invoice || !invoiceId?.startsWith('local-invoice-')) return;

    setResolvedInvoice(getLocalInvoiceById(invoiceId));
  }, [invoice, invoiceId]);

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading={resolvedInvoice?.invoiceNumber}
        backHref={paths.dashboard.invoice.root}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Invoice', href: paths.dashboard.invoice.root },
          { name: resolvedInvoice?.invoiceNumber },
        ]}
        sx={{ mb: 3 }}
      />

      <InvoiceDetails invoice={resolvedInvoice} />
    </DashboardContent>
  );
}
