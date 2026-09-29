import path from 'node:path';
import { fileURLToPath } from 'node:url';

// La landing de registro de destacamentos. Proyecto APARTE del dashboard: solo
// lee (destacamentos, iglesias, miembros mayores de edad) y guarda envíos
// "pendientes" en Firestore. El Admin SDK se carga sin empaquetar, como en el
// dashboard, o revienta al cargar las rutas /api.
const nextConfig = {
  trailingSlash: true,
  serverExternalPackages: ['firebase-admin'],
  // Hay un package-lock.json suelto en la carpeta del usuario: sin esto Next
  // tomaba esa carpeta como raíz del proyecto.
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
};

export default nextConfig;
