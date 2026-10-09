import { createHmac, timingSafeEqual } from 'node:crypto';

import { db } from 'src/server/firebase.mjs';
import logoOficinaPng from 'src/assets/marca/logo-oficina-nacional.png';

export const dynamic = 'force-dynamic';

export default async function Verificar({ params, searchParams }) {
  const { codigo } = await params;
  const { s } = await searchParams;
  const secret = process.env.ONERRD_QR_SECRET;
  let member = null;
  if (secret && /^ONERRD 2027-\d{4}$/.test(codigo) && /^[0-9a-f]{64}$/.test(s || '')) {
    const snap = await db()
      .collection('membresiasOnerrd2027')
      .where('codigo', '==', codigo)
      .limit(1)
      .get();
    if (!snap.empty) {
      const found = snap.docs[0].data();
      const expected = createHmac('sha256', secret)
        .update(`2027:${codigo}:${found.destacamento.id}`)
        .digest('hex');
      if (timingSafeEqual(Buffer.from(expected), Buffer.from(s)) && found.estado === 'confirmada')
        member = found;
    }
  }
  return (
    <main
      style={{
        fontFamily: 'Arial, sans-serif',
        maxWidth: 680,
        margin: '70px auto',
        padding: 24,
      }}
    >
      <img src={logoOficinaPng.src} alt="ONERRD" width="96" height="96" />
      <h1>Verificación de certificado ONERRD 2027</h1>
      {member ? (
        <section
          style={{
            borderLeft: '6px solid #168558',
            padding: 20,
            background: '#f0faf5',
          }}
        >
          <h2>Certificado activo</h2>
          <p>
            <strong>Código:</strong> {member.codigo}
          </p>
          <p>
            <strong>Destacamento:</strong> #{member.destacamento.numero} ·{' '}
            {member.destacamento.nombre}
          </p>
          <p>
            <strong>Vigencia:</strong> {member.vigencia?.desde || '01/01/2027'} -{' '}
            {member.vigencia?.hasta || '31/12/2027'}
          </p>
        </section>
      ) : (
        <section
          style={{
            borderLeft: '6px solid #b3261e',
            padding: 20,
            background: '#fff1f0',
          }}
        >
          <h2>No verificable</h2>
          <p>El código, la firma o el estado del certificado no son válidos.</p>
        </section>
      )}
    </main>
  );
}
