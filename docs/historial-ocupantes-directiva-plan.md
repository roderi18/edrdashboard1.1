# Pestaña "Historia" de ocupantes en la Directiva

**Estado: implementado.** Este documento describe lo que ya existe. No
confundir con [`directiva-por-cuatrienio.md`](./directiva-por-cuatrienio.md),
que describe el botón "Guardar en la memoria" (una foto manual por cuatrienio;
esta pestaña es automática y no lo reemplaza).

## Problema que resuelve

Hoy, el cargo de una casilla de Directiva (nacional, regional, seccional o
destacamento) es **un solo registro que se sobreescribe** al cambiar de
ocupante (`idIntegrante`/`idAsignacion` salen de la casilla, no de la persona).
Si alguien ejerce un cargo 2 años y lo reemplazan, no queda memoria de que esa
persona lo ocupó — solo se ve quien esté al momento de la próxima lectura.

## Reglas acordadas

1. **Automático, sin depender de "Guardar en la memoria".** En cuanto se
   reemplaza a alguien en cualquier cargo de Directiva (los 4 niveles), el
   ocupante saliente queda guardado en el historial en el momento del cambio.
2. **Mínimo 30 días calendario en el cargo para quedar en el historial.** Si el
   reemplazo ocurre antes de cumplir 30 días desde que empezó, no se guarda
   nada: es como si nunca hubiera estado (evita ensuciar el historial con
   correcciones rápidas o errores de carga).
3. **Una sola pestaña "Historia" (lista, no organigrama), repetida en los 4
   niveles** — Destacamento, Sección, Región y Nacional usan el MISMO
   componente de lista, con foto + nombre por fila (igual formato que las
   listas de miembros ya existentes, `member-list-view.jsx`). Cada fila
   muestra: foto, cargo que ocupó, "Desde dd/mm/aaaa · Hasta dd/mm/aaaa"; quien
   sigue en el cargo hoy se marca como **Vigente** (sin fecha de "hasta").
4. **Alcance de cada pestaña**:
   - **Destacamento**: solo el historial de ESE destacamento.
   - **Sección**: solo el historial de ESA sección.
   - **Región**: solo el historial de ESA región.
   - **Consejo Nacional**: **global**, junta el historial de nacional +
     todas las regiones + todas las secciones, con filtros para acotar (igual
     que ya filtra hoy la pestaña "Lista" de national-list-view). **NO incluye
     destacamentos** — el historial de destacamento se ve únicamente en la
     pestaña "Historia" de cada destacamento, nunca en la vista global
     nacional.
5. **Al presionar "Guardar en la memoria de <cuatrienio>"**, además de lo que ya
   hace, se debe mostrar la lista de personas que quedaron en el historial
   desde el último guardado (nombre, cargo, entidad, fecha hasta).

## Mecanismo técnico (dónde engancha)

- El guardado de un cargo vivo pasa por `guardarAsignacionDirectiva` en
  [`src/services/directivas-organizacionales-service.js:672`](../src/services/directivas-organizacionales-service.js#L672).
  Cada asignación ya trae `fechaInicio` (por defecto, hoy) y se escribe con un id
  estable por casilla (`idAsignacion`), así que cambiar de persona hoy
  SOBREESCRIBE sin dejar rastro del anterior. Esto es común a los 4 niveles
  (incluido destacamento, que ya pasa por la misma función).
- El punto de enganche: **antes de sobreescribir la casilla**, si hay alguien
  saliendo (`idMiembro` distinto al nuevo) y `hoy - fechaInicio >= 30 días`,
  escribir su fila al historial. Si lleva menos de 30 días, no se escribe nada.
- **Dónde vive el historial**: como ahora la pestaña "Historia" es una sola
  pieza para los 4 niveles (no solo nacional/regional/seccional), conviene una
  colección propia (p. ej. `directiva_historial_ocupantes`) en vez de forzarlo
  dentro de `directiva_cuatrienios_integrantes` (que es específica de
  cuatrienio y no existe para destacamento). Cada fila: nivel, idEntidad,
  cargo/idPosicionDirectiva, idMiembro (+ copia de nombre/foto/código, como ya
  hace `guardarAsignacionDirectiva`), fechaInicio, fechaFin, vigente (bool).
- El resumen de "Guardar en la memoria" se arma en `tomarFotoDeLaDirectivaActual`
  ([`directiva-importacion-service.js:447`](../src/services/directiva-importacion-service.js#L447));
  ahí habría que devolver también la lista de quienes se guardaron en historial
  desde el último guardado, para mostrarla en el diálogo de
  `herramientas-del-cuatrienio.jsx`.

## Dónde va la pestaña en cada pantalla

- **Destacamento**: al lado de donde hoy se administra su directiva
  (`src/app/dashboard/level/dest/[id]/edit/leadership/page.jsx`,
  `src/sections/dest/leadership/dest-youth-leadership-view.jsx`).
- **Sección**: `src/sections/sectional/leadership/sectional-leadership-view.jsx`
  y su página `edit/leadership`.
- **Región**: `src/sections/regional/leadership/regional-leadership-view.jsx`
  y su página `edit/leadership`.
- **Nacional**: junto a la pestaña "Lista" y "Jerarquía" que ya existen en
  `src/sections/national/view/national-list-view.jsx` (mismo patrón de
  `Tabs`/`Tab` de MUI que ya usa esa pantalla).

## Piezas (implementadas)

- `src/utils/directiva-historial.mjs` — reglas puras: `debeRegistrarSalida`
  (30 días), `construirRegistroHistorial`, `combinarHistorialYVigentes`,
  `nombreDeCargoPorPosicion`, `NIVELES_HISTORIAL_NACIONAL`.
- `src/services/directivas-organizacionales-service.js` — engancha el guardado
  del historial dentro de `guardarAsignacionDirectiva` (los 4 niveles), en la
  colección `directiva_historial_ocupantes`; lectura con
  `obtenerHistorialDirectiva` (una entidad) y `obtenerHistorialDirectivaGlobal`
  (nacional + regiones + secciones, sin destacamentos).
- `firestore.rules` — colección `directiva_historial_ocupantes`: se crea, nunca
  se edita ni se borra; también sumada a la exclusión del comodín permisivo del
  final.
- `src/sections/common/leadership-history-table.jsx` — la tabla "Historia"
  (foto, nombre, cargo, desde/hasta o "Vigente"), reutilizada en los 4 niveles.
- `src/sections/common/leadership-history-tab.jsx` — la envoltura que lee y
  arma esa tabla para UNA entidad puntual (destacamento, sección o región).
- Pestaña "Directiva"/"Historia" agregada en:
  `src/app/dashboard/level/dest/[id]/edit/leadership/page.jsx`,
  `src/sections/sectional/leadership/sectional-leadership-view.jsx`,
  `src/sections/regional/leadership/regional-leadership-view.jsx` (alcance
  individual), y `src/sections/national/view/national-list-view.jsx` (pestaña
  "Historia" global, junto a "Todos" y "Jerarquía").
- `tests/directivas/historial-ocupantes.test.mjs` — cubre el mínimo de 30 días,
  vacar sin reemplazo, el id estable por salida, vigentes antes que histórico,
  y que `NIVELES_HISTORIAL_NACIONAL` nunca incluye destacamento.

## Pendiente (no implementado en esta pasada)

- El resumen de "quiénes quedaron en el historial" al presionar "Guardar en la
  memoria de `<cuatrienio>`" (regla 5): hoy ese botón sigue igual que antes.
