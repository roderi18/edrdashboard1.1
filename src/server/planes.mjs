// Las tarifas viven en `src/utils/planes-membresia.mjs`, que comparten la
// pantalla y el servidor. Aquí solo se reexportan para las rutas /api.
export { PLANES, planesDisponibles, ANIO_MEMBRESIA as YEAR } from '../utils/planes-membresia.mjs';
