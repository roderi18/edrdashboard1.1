'use client';

import { useState, useEffect } from 'react';
import { onIdTokenChanged } from 'firebase/auth';

import { paths } from 'src/routes/paths';
import { useRouter, usePathname } from 'src/routes/hooks';

import { AUTH } from 'src/lib/firebase';

import { SplashScreen } from 'src/components/loading-screen';

import { useAuthContext } from '../hooks';

// ----------------------------------------------------------------------

const getRedirectPath = (pathname) =>
  pathname.startsWith(paths.dashboard.admin.root)
    ? paths.auth.firebase.adminSignIn
    : paths.auth.firebase.signIn;

export function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const { user, authenticated, loading } = useAuthContext();

  const [isChecking, setIsChecking] = useState(true);
  // LA MARCA DEL TOKEN, ADEMAS DE LA DEL PERFIL. Segun por donde se arme la
  // sesion (miembro, administrador, Oficina Nacional...) el perfil puede no
  // traer `debeCambiarClave`, y quien entraba con el codigo de un solo uso
  // llegaba al panel sin elegir contraseña (EDR-10049, Oficina Nacional). El
  // token lo pone el servidor y no depende de esa rama: con que uno de los dos
  // la tenga, va a "Crea tu contraseña".
  const [marcaDelToken, setMarcaDelToken] = useState(false);

  // Cada token nuevo, no solo al cambiar de cuenta: al guardar la contraseña se
  // vuelve a entrar con el MISMO uid y un token ya sin la marca; leyendolo solo
  // una vez, la sesion volvia a "Crea tu contraseña" en bucle.
  useEffect(() => {
    if (!AUTH) return undefined;

    return onIdTokenChanged(AUTH, (cuenta) => {
      if (!cuenta) {
        setMarcaDelToken(false);
        return;
      }

      cuenta
        .getIdTokenResult()
        .then((resultado) => setMarcaDelToken(resultado?.claims?.debeCambiarClave === true))
        .catch(() => {});
    });
  }, []);
  // Firebase ya validó las credenciales, aunque el perfil y los permisos aún
  // estén llegando al contexto. En ese intervalo no se debe volver a Login:
  // hacerlo producía el destello de la pantalla vacía de acceso al entrar.
  const firebaseSessionPending = Boolean(AUTH?.currentUser);

  const checkPermissions = () => {
    if (loading) {
      return;
    }

    if (!authenticated) {
      if (firebaseSessionPending) {
        return;
      }

      const redirectPath = new URLSearchParams({ returnTo: pathname }).toString();
      const signInPath = getRedirectPath(pathname);

      router.replace(`${signInPath}?${redirectPath}`);
      return;
    }

    // La clave inicial sale del codigo de miembro, asi que la sabe cualquiera que
    // vea el codigo. Mientras no la cambie, la sesion no pasa de aqui: dejarle
    // entrar "solo un momento" es dejarle entrar con una clave publica.
    if (
      (user?.debeCambiarClave || marcaDelToken) &&
      pathname !== paths.auth.firebase.primerAcceso
    ) {
      router.replace(paths.auth.firebase.primerAcceso);
      return;
    }

    setIsChecking(false);
  };

  useEffect(() => {
    checkPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authenticated,
    firebaseSessionPending,
    loading,
    pathname,
    user?.debeCambiarClave,
    marcaDelToken,
  ]);

  if (isChecking || loading) {
    return (
      <SplashScreen
        portal={false}
        title="Verificando tu acceso"
        description="Estamos preparando tu sesión para llevarte al panel correcto."
      />
    );
  }

  return <>{children}</>;
}
