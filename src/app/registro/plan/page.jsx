import { Suspense } from 'react';

import { PasoPlan } from 'src/sections/membresia/registro/paso-plan';

import Loading from '../loading';

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PasoPlan />
    </Suspense>
  );
}
