import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { CONFIG } from 'src/global-config';

// ----------------------------------------------------------------------

export function SignInButton({ sx, ...other }) {
  const href =
    (CONFIG.auth.method === 'firebase' && paths.auth.firebase.signIn) ||
    (CONFIG.auth.method === 'supabase' && paths.auth.supabase.signIn) ||
    (CONFIG.auth.method === 'amplify' && paths.auth.amplify.signIn) ||
    (CONFIG.auth.method === 'auth0' && paths.auth.auth0.signIn) ||
    paths.auth.jwt.signIn;

  return (
    <Button component={RouterLink} href={href} variant="outlined" sx={sx} {...other}>
      Sign in
    </Button>
  );
}
