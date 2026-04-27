// ----------------------------------------------------------------------

export function getErrorMessage(error) {
  const errorCode = error?.code;

  if (
    [
      'auth/invalid-credential',
      'auth/user-not-found',
      'auth/wrong-password',
      'auth/invalid-email',
    ].includes(errorCode)
  ) {
    return 'Usuario o clave incorrecta.';
  }

  if (errorCode === 'auth/too-many-requests') {
    return 'Demasiados intentos fallidos. Inténtalo de nuevo más tarde.';
  }

  if (errorCode === 'auth/email-already-in-use') {
    return 'Este correo ya está registrado. Inicia sesión.';
  }

  if (errorCode === 'auth/weak-password') {
    return 'La contraseña es demasiado débil. Usa al menos 6 caracteres.';
  }

  if (errorCode === 'auth/network-request-failed') {
    return 'No se pudo conectar con Firebase. Revisa tu conexión e inténtalo de nuevo.';
  }

  if (error instanceof Error) {
    return error.message || error.name || 'An error occurred';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    const errorMessage = error.message;
    if (typeof errorMessage === 'string') {
      return errorMessage;
    }
  }

  return `Unknown error: ${error}`;
}
