import { Suspense } from 'react';

import { PasoPago } from 'src/sections/membresia/registro/paso-pago';

import Loading from '../loading';

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PasoPago />
    </Suspense>
  );
}
