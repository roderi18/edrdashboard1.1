import { MarcoRegistro } from 'src/sections/membresia/registro/marco-registro';

// Los cuatro pasos comparten el marco (pasos, resumen) y el estado del registro.
export const metadata = { title: 'Registro · Membresía ONERRD 2027' };

export default function RegistroLayout({ children }) {
  return <MarcoRegistro>{children}</MarcoRegistro>;
}
