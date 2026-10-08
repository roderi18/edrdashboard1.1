import NextLink from 'next/link';
import { forwardRef } from 'react';

// Las pantallas del panel tienen muchos destinos visibles a la vez (menú,
// pestañas y migas). El prefetch automático de Next descargaba sus RSC y chunks
// aunque el usuario no fuera a abrirlos. Se desactiva por defecto para todos los
// enlaces internos y cada caso que realmente lo necesite puede pedirlo con
// `prefetch={true}`.
export const RouterLink = forwardRef(function RouterLink({ prefetch = false, ...other }, ref) {
  return <NextLink ref={ref} prefetch={prefetch} {...other} />;
});
