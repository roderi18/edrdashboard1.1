'use client';

import { useState, useEffect } from 'react';

import { paths } from 'src/routes/paths';

import { getLocalInvoiceById } from 'src/utils/local-commerce-storage';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { InvoiceCreateEditForm } from '../invoice-create-edit-form';

// ----------------------------------------------------------------------

export function InvoiceEditView({ invoice, invoiceId }) {
  const [resolvedInvoice, setResolvedInvoice] = useState(invoice);

  useEffect(() => {
    if (invoice || !invoiceId?.startsWith('local-invoice-')) return;

    setResolvedInvoice(getLocalInvoiceById(invoiceId));
  }, [invoice, invoiceId]);

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar"
        backHref={paths.dashboard.invoice.root}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Invoice', href: paths.dashboard.invoice.root },
          { name: resolvedInvoice?.invoiceNumber },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <InvoiceCreateEditForm currentInvoice={resolvedInvoice} />
    </DashboardContent>
  );
}
