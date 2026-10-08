import { Suspense } from 'react';

import { PasoResultado } from 'src/sections/membresia/registro/paso-resultado';

import Loading from '../loading';

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PasoResultado />
    </Suspense>
  );
}
