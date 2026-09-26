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
3. **"Historia" es un tab de NIVEL SUPERIOR del perfil**, no un sub-tab metido
   dentro del organigrama de Directiva. En destacamento/sección/región vive
   junto a "General"/"Miembros"/"Directiva" en la navegación del propio
   perfil, con el mismo diseño de lista (buscador, tabla ordenable, paginación)
   que ya usan Miembros o Destacamentos — no el organigrama. En destacamento
   hay DOS organigramas (Directiva Local y Líderes Juveniles): "Historia" es
   **una sola pestaña que junta a los dos**, sin separarlos, porque ambos
   escriben el mismo nivel `destacamento` + la misma entidad. Cada fila
   muestra: foto, cargo que ocupó, "Desde dd/mm/aaaa · Hasta dd/mm/aaaa"; quien
   sigue en el cargo hoy se marca como **Vigente** (sin fecha de "hasta").
4. **Alcance de cada pestaña**:
   - **Destacamento**: solo el historial de ESE destacamento (Directiva Local
     + Líderes Juveniles, juntos).
   - **Sección**: solo el historial de ESA sección.
   - **Región**: solo el historial de ESA región.
   - **Consejo Nacional**: sigue como estaba pensado desde el principio —
     su propia pestaña "Historia" **dentro** de la lista nacional (junto a
     "Todos" y "Jerarquía", que ya es su propio nivel superior), **global**:
     junta nacional + todas las regiones + todas las secciones. **NO incluye
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

- **Destacamento**: nuevo tab "Historia" en `src/sections/dest/layout/dest-edit-layout.jsx`
  (junto a General/Miembros/Directiva Local/Directiva Líderes Juveniles),
  ruta `edit/history` → `src/sections/common/leadership-history-view.jsx`.
- **Sección**: nuevo tab en `src/sections/sectional/layout/sectional-edit-layout.jsx`,
  ruta `edit/history`.
- **Región**: nuevo tab en `src/sections/regional/layout/regional-edit-layout.jsx`,
  ruta `edit/history`.
- **Nacional**: sigue dentro de `src/sections/national/view/national-list-view.jsx`,
  junto a la pestaña "Lista" y "Jerarquía" que ya existen ahí (mismo patrón de
  `Tabs`/`Tab` de MUI que ya usa esa pantalla) — esa pantalla YA es el nivel
  superior para el Consejo Nacional, así que no hace falta un tab de perfil
  aparte como en los otros tres niveles.

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
- `src/sections/common/leadership-history-list.jsx` — LA lista de "Historia",
  la misma en los cuatro niveles y con las piezas de Miembros/Destacamentos:
  buscador, filtros de Posición y Estado (y Estructura en Nacional, con
  `mostrarEntidad`), Lista/Cuadrícula, imprimir y exportar, chips de filtros,
  orden por columna, "Vista compacta" y filas por página. Con `embebido` va
  dentro de la tarjeta de otra vista (la del Consejo Nacional).
- `src/sections/common/use-leadership-history.js` — el hook que lee vigentes +
  historial de UNA entidad y los combina (destacamento, sección o región).
- `src/sections/common/leadership-history-view.jsx` — la pestaña "Historia" de
  destacamento/sección/región: el hook + la lista.
- Tab "Historia" agregado como nivel superior del perfil (junto a
  General/Miembros/Directiva) en `src/sections/dest/layout/dest-edit-layout.jsx`,
  `src/sections/sectional/layout/sectional-edit-layout.jsx` y
  `src/sections/regional/layout/regional-edit-layout.jsx`, con sus rutas
  `edit/history` nuevas. En destacamento junta Directiva Local y Líderes
  Juveniles en una sola pestaña.
- `src/sections/national/view/national-list-view.jsx` — pestaña "Historia"
  global (nacional + regiones + secciones, sin destacamentos), junto a "Todos"
  y "Jerarquía". **Solo en la directiva actual** y solo para Administrador
  Global, Oficina Nacional y Consejo Ejecutivo (`puedeVerHistoriaNacional`).
  Enseña solo a quienes SALIERON en el cuatrienio vigente, no a los vigentes.
- **Directiva pasada = apunte para la historia**: no tiene pestaña "Historia";
  quienes salieron de un cargo en ese cuatrienio se suman a su lista "Todos"
  (`apuntesDelCuatrienio`). Una posición que ocuparon varias personas sale
  varias veces, con "desde – hasta" debajo de la posición y la más reciente
  primero; si la ocupó una sola, sin fechas.
- **Quién ve "Historia" en los perfiles**: secciones y regiones, igual que
  antes. En un destacamento, el Consejo Ejecutivo solo ve la del suyo propio
  (`puedeVerHistoriaDeDestacamento`); Administrador Global y Oficina Nacional,
  todas; los demás cargos, sin cambios.
- **Motivo de salida**: cada salida guarda `motivo` (`MOTIVOS_SALIDA`). Al
  salir se deduce solo "Reemplazado" (entra otra persona) o "Sin especificar"
  (la casilla queda vacía); el Administrador Global y la Oficina Nacional lo
  precisan con el lápiz de la Historia (`cambiarMotivoDeSalida`, queda en
  Historial). `firestore.rules` solo deja cambiar `motivo` y `motivoNota`.
- **Exportar la directiva** (menú ⋮ de la lista nacional, Excel o PDF, e
  Imprimir): Consejo Ejecutivo y después cada región con sus secciones debajo
  (`ordenarDirectivaParaExportar`, `src/utils/directiva-exportacion.mjs`).
- **Recordatorio de cierre**: a 30, 7 y 1 día del 22/08, aviso en la campana al
  Administrador Global y la Oficina Nacional para guardar la directiva en su
  memoria (`src/utils/recordatorio-cierre-cuatrienio.mjs`). Lo manda la primera
  sesión de uno de ellos en cada tramo; id fijo, nunca se repite.
- Tests: `tests/directivas/historial-en-el-cuatrienio.test.mjs`,
  `tests/acceso/historia-de-directivas-quien-la-ve.test.mjs`,
  `tests/directivas/directiva-exportacion-y-cierre.test.mjs`.
- `tests/directivas/historial-ocupantes.test.mjs` — cubre el mínimo de 30 días,
  vacar sin reemplazo, el id estable por salida, vigentes antes que histórico,
  y que `NIVELES_HISTORIAL_NACIONAL` nunca incluye destacamento.

## Pendiente (no implementado en esta pasada)

- El resumen de "quiénes quedaron en el historial" al presionar "Guardar en la
  memoria de `<cuatrienio>`" (regla 5): hoy ese botón sigue igual que antes.
