import { Suspense } from 'react';

import { PasoDestacamento } from 'src/sections/membresia/registro/paso-destacamento';

import Loading from '../loading';

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PasoDestacamento />
    </Suspense>
  );
}
