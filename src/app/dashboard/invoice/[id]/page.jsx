// import { CONFIG } from 'src/global-config';
// import { _invoices } from 'src/_mock/_invoice';

// import { InvoiceDetailsView } from 'src/sections/invoice/view';

// // ----------------------------------------------------------------------

// export const metadata = { title: `Invoice details | Dashboard - ${CONFIG.appName}` };

// export default async function Page({ params }) {
//   const { id } = await params;

//   const currentInvoice = _invoices.find((invoice) => invoice.id === id);

//   return <InvoiceDetailsView invoice={currentInvoice} />;
// }

// // ----------------------------------------------------------------------

// /**
//  * Static Exports in Next.js
//  *
//  * 1. Set `isStaticExport = true` in `next.config.{mjs|ts}`.
//  * 2. This allows `generateStaticParams()` to pre-render dynamic routes at build time.
//  *
//  * For more details, see:
//  * https://nextjs.org/docs/app/building-your-application/deploying/static-exports
//  *
//  * NOTE: Remove all "generateStaticParams()" functions if not using static exports.
//  */

'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

import { _invoices } from 'src/_mock/_invoice';

const InvoiceDetailsView = dynamic(
  () => import('src/sections/invoice/view').then((m) => m.InvoiceDetailsView),
  { ssr: false }
);

export default function Page() {
  const { id } = useParams();

  const currentInvoice = _invoices.find((invoice) => invoice.id === id);

  return <InvoiceDetailsView invoice={currentInvoice} invoiceId={id} />;
}
