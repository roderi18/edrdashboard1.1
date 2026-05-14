import { redirect } from 'next/navigation';

import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Iniciar sesion',
};

export default function Page() {
  redirect(paths.auth.firebase.signIn);
}
