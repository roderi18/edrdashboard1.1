import { mkdir, writeFile } from 'node:fs/promises';

import { generarDocumento } from '../src/server/documentos.mjs';

process.env.ONERRD_QR_SECRET ||= 'clave-de-prueba-no-usar-en-produccion-123456789';
process.env.NEXT_PUBLIC_SITE_URL ||= 'http://localhost:3050';

const member = {
  codigo: 'ONERRD 2027-0001', estado: 'confirmada', tipoPago: 'transferencia', montoRd: 2250,
  destacamento: { id: '25', numero: '025', nombre: 'Monte Horeb', region: 'Central', seccion: 'Distrito 1', iglesia: 'Primera Iglesia', coordinador: 'Coordinador de Ejemplo', pastor: 'Pastor de Ejemplo' },
  plan: { id: 'fidelidad', cuotaRegistro: 1500, rriTrac: 1000, descuento: 250 },
  deposito: { referencia: 'EJEMPLO-123' },
};

await mkdir('tmp/pdfs', { recursive: true });
await writeFile('tmp/pdfs/certificado-ejemplo.pdf', await generarDocumento(member, 'certificado'));
const invoice = await generarDocumento(member, 'factura');
if (!invoice.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Factura inválida.');
