# Pestaña de premios: tarjeta de insignia

Cómo se ven y se comportan los premios en la pestaña **Sistema de Ascenso** de la
ficha del miembro (`/dashboard/level/member/[id]/edit/awards`), tanto del Sistema
de Ascenso como de la Academia Ministerial.

## Qué es una "carpeta de premios"

La última carpeta de cada rama, la que **solo tiene premios dentro**: Premios de
Destreza - Verde, un trimestre de las guías semanales, Instructor… La decide
`esCarpetaDePremios` (`src/utils/insignias-de-premios.mjs`) mirando el catálogo
(`src/_mock/_awards.js`), así que un premio o una carpeta nuevos entran solos.
Las carpetas con subcarpetas (una división, un programa) siguen con tarjetas de
carpeta: mezclar las dos alturas en la misma cuadrícula descuadraba la rejilla.

## Las piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| `AwardsInsigniaItem` | `src/sections/member/awards/awards-insignia-item.jsx` | La tarjeta de la cuadrícula (memorizada: solo se repinta la que cambia). |
| `InsigniaDePremio` | mismo archivo | La insignia fuera de la tarjeta: fila de la lista y panel lateral. |
| `CheckDeCompletado` | mismo archivo | El check con su aviso (verde / amarillo). |
| `imagenDelPremio` | mismo archivo | La imagen de un premio: su `.webp`, o el icono propio (Academia), o `null` (icono del PDF). |
| `TARJETA_INSIGNIA` | mismo archivo | **Todas las medidas, colores y textos**: se cambian aquí. |
| `esCarpetaDePremios`, `imagenDeInsignia`, `CARPETAS_CON_INSIGNIA` | `src/utils/insignias-de-premios.mjs` | Qué carpetas son de premios y dónde está cada imagen. |
| `cambiarEstadoPremiosAscenso`, `completarPremiosAscenso` | `src/sections/member/awards/components/core/AwardsActionsCore.js` | Completar / quitar el completado de varios de una vez. |
| `AwardsManagerSkeleton`, `AwardsTabSkeleton` | `src/sections/member/awards/awards-manager-skeleton.jsx` | El esqueleto con la forma de lo que va a salir. |

## Comportamiento

- **Cuadrícula por defecto** en todas las pantallas; la lista sigue a un clic.
- **Tarjeta**: vertical, todas del mismo alto; insignia arriba y el nombre entero
  debajo (dos líneas, partido por palabras). Sin el estado escrito. Columnas: 3 en
  el móvil y, desde tablet, las que quepan.
- **Sin completar**: la insignia un 15 % transparente (en la lista, no).
- **Completado**: check arriba a la izquierda. **Verde** = certificado cargado;
  **amarillo** = falta agregar certificado. El aviso lo dice al pasar por encima
  (o al dejarlo pulsado en el móvil).
- **Veces ganado** (`x1`, `x2`…): debajo del nombre, en gris, sin mover nada. Solo
  en el Sistema de Ascenso (la Academia no cuenta veces).
- **Pulsar la tarjeta, la insignia o el check** abre el panel lateral. En el
  panel, el nombre va centrado y la insignia grande debajo.
- **Menú ⋮ → Completar / Quitar completado** (solo Sistema de Ascenso y quien
  puede editar). Completar es instantáneo y sin preguntar; quitar pide siempre
  confirmación: el Coordinador de Destacamento y su Asistente lo aplican al
  momento (y se borra el certificado, que habrá que volver a cargar); el resto de
  cargos envía una solicitud de aprobación.
- **Varios a la vez** (solo Sistema de Ascenso):
  - Ratón: **Ctrl / Cmd + clic**. Móvil: **dejar pulsada** la tarjeta (0,45 s),
    y luego un toque marca o desmarca.
  - A la derecha del escudo: **Completar (n)** si hay alguno sin completar;
    **Quitar completado (n)** si todo lo elegido ya lo está (con la misma regla
    de aprobación, y nombrando los que perderán su certificado). **✕** o **Esc**
    cancelan; cambiar de carpeta también.
  - Se aplica en memoria de una vez (un solo repintado) y Firestore guarda en
    paralelo; si algo no se guarda, se avisa y se vuelve a leer lo guardado.
- **Academia Ministerial**: misma tarjeta, check y panel, pero sin selección
  múltiple ni "Completar" desde el menú: allí el certificado es obligatorio y se
  completa desde el panel.

## Guardado (a prueba de errores)

Todo pasa por `guardarProgresoAscensoMiembro` (`src/services/member-awards-service.js`):

- **En fila por premio** (`enColaDelPremio`): dos guardados del mismo premio no se
  pisan; premios distintos van en paralelo.
- **`certificado: null` borra, `undefined` deja el que haya** (`camposDelProgreso`).
  Solo se manda `null` cuando se pide borrar (quitar el completado, eliminar el
  certificado); al borrarlo se eliminan también su ficha en `certificados` y el
  archivo, como al aprobar una solicitud. Sin completar no queda fecha.
- **Un solo guardado** al quitar un completado con certificado (`applyStatusChange`).
- **Lotes**: el miembro se busca una vez y los coordinadores reciben UN aviso
  (`avisarCambioEstadoEnLote`), no uno por premio.
- **Caché**: un guardado solo deja viejas las lecturas del progreso
  (`LECTURAS_DEL_PROGRESO`), no toda la aplicación.
- **Lo más nuevo gana**: al leer de Firestore, un premio cambiado en esta sesión y
  aún sin guardar no se pisa (`combinarProgresoAscensoEnCache`).
- **Certificados** (`utils/subir-certificado.js`): PDF, imagen o Word, hasta 10 MB.
  El check verde sale al instante; "Certificado guardado" solo cuando Firebase lo
  guardó; si falla, se deshace y se avisa.
- **`?folder=` desconocido** abre la raíz en vez de una pestaña vacía.
- **Dónde se guarda el archivo**: `certificados/ascenso/…` (Sistema de Ascenso) o
  `certificados/academia/…` (Academia). La carpeta de la Academia la escriben los
  cargos que editan la Academia (Consejo y Capellán de Destacamento incluidos,
  mirando todos sus cargos); la del Sistema de Ascenso, quien tiene
  `ascenso.editar`. Las dos listas las vigila
  `tests/acceso/certificados-academia-storage.test.mjs`. **Hay que publicar
  `storage.rules`** para que valga.

Test: `tests/ascenso/guardado-de-progreso.test.mjs`.

## Imágenes

Viven en `public/sistemaAscenso/<división>/<carpeta>/`, con el nombre del premio en
minúsculas y con guiones (`Ciencias Ambientales` → `ciencias-ambientales.webp`).
Se buscan por **nombre**, nunca por número de archivo.

Para dar imágenes a otra carpeta, se añade en `CARPETAS_CON_INSIGNIA`:

```js
'pioneros__premios-de-destreza-azul': {
  ruta: '/sistemaAscenso/pioneros/premios-de-destreza-azul',
  alias: { 'nombre-en-el-catalogo': 'nombre-del-archivo' }, // los que no coinciden
  sinImagen: ['premio-sin-imagen'],                          // los que no tienen
  archivo: (base) => base,                                   // si el patrón es otro
},
```

El test `tests/ascenso/insignias-de-premios.test.mjs` comprueba que cada premio de
esas carpetas encuentra su archivo (o está en `sinImagen`) y que dos premios no
comparten insignia.

Sin imagen hoy (sale el icono del PDF, o el icono propio en la Academia):
Premios Bíblicos (15 insignias numeradas para 24 libros: falta saber cuál va con
cuál), "Explorador del Aire" y las guías semanales.

Los 150 Retos Espirituales de Exploradores reparten 6 insignias
(`exploradores/verdades-fundamentales/1-azul-claro.webp` … `6-amarillo.webp`) en
secuencia por el número del reto: el 1 la 1, el 6 la 6, el 7 otra vez la 1.
Van en `INSIGNIAS_VERDADES_FUNDAMENTALES`; la carpeta lleva `imagenCompartida: true`
porque varios retos comparten insignia. Las carpetas `navegantes/reconocimientoDeLogro` y
`*/sendas` tienen imágenes pero no premios en el catálogo.

## Tests

- `tests/ascenso/insignias-de-premios.test.mjs`
- `tests/ascenso/completar-varios-premios.test.mjs`
- `tests/ascenso/progreso-de-ascenso.test.mjs`
- `tests/ascenso/progreso-sin-vaciar-cache.test.mjs`
- `tests/ascenso/guardado-de-progreso.test.mjs`
