# Cintas del perfil (módulo conectado a Awards)

Estado: **lógica, tabla y cintas de prueba hechas.** Falta la tabla award → cinta.

## Qué hace

Cuando una persona completa un award (o un grupo de awards), se le asigna la cinta
correspondiente, que se muestra en su perfil igual que hoy en el de EDR-10002.

## Imágenes

`public/parches/Cintas y medallas/cintas-perfil/` — 47 archivos `.webp`.
El prefijo numérico del nombre **es el orden oficial** (`1-cinta-al-valor.webp` …
`40-cinta-marron.webp`).

- Ordenar por el **número**, no alfabéticamente (si no, `10` queda antes que `2`).
- `12a` y `12b` van entre la 11 y la 13, `12a` primero.
- Una letra **delante** del número (`a5`, `z1`…) manda al final, agrupada por esa
  letra y luego por número: `40` → `a5` → `z1` … `z6`.
- **Desde la aplicación**: EXPLORA Designer → Cintas (o Medallas, o Pines) → "Agregar". Pide
  imagen, nombre y descripción; se guardan en Storage y en `insignias_personalizadas`,
  y salen detrás de las de fábrica en todos los perfiles. Es lo que sirve en
  producción, donde nadie escribe en la carpeta pública.
- **Dejar la imagen en la carpeta no basta**: hay que añadir su nombre a `ARCHIVOS`
  en `src/utils/cintas-perfil.mjs` y su texto en `cintas-perfil-textos.mjs`. El
  test `cintas-perfil-orden` falla si hay una imagen sin catálogo. Las copias de
  Windows (`… copia.webp`) no cuentan como cinta.

## Disposición (referencia: manual de líderes, pág. 21)

1. Máximo **3 cintas por fila** y **18 en total** (6 filas).
2. Las cintas se ordenan de menor a mayor número y se **leen como un libro**:
   de izquierda a derecha y de arriba abajo.
3. La **fila incompleta va arriba**, centrada; las filas completas quedan abajo.
   Las filas se completan de abajo hacia arriba.
4. Cada cinta nueva ocupa su lugar por número, así que las filas se reacomodan.

Ejemplo con las cintas 3, 8, 14, 20, 25:

```
     [3] [8]
 [14] [20] [25]
```

Algoritmo: ordenar por número; `resto = n % 3`; si `resto > 0`, la primera fila
(arriba) lleva las primeras `resto` cintas centradas; el resto se parte en filas de 3.

### Orden global (EXPLORA Designer)

El número del archivo es el orden **de fábrica**. En `/dashboard/everest?seccion=cintas`
el Administrador Global arrastra las cintas (o usa las flechas, en el teléfono) y pulsa
"Guardar orden". Ese orden se guarda en `configuracion_cintas/orden` (`{ orden: [ids] }`,
pasa por `proponerCambio` y queda en Historial) y **manda en todas partes**: en los
perfiles que ya tienen cintas —las filas se arman con él— y en el diálogo para
asignarlas. Sin orden guardado, o si no se puede leer, vuelve el de fábrica. Una cinta
nueva que no esté en el orden guardado va al final; un id que ya no existe se descarta.

## Implementación

| Pieza | Dónde |
|---|---|
| Catálogo, orden y filas (sin React) | `src/utils/cintas-perfil.mjs` |
| Test | `tests/member/cintas-perfil-orden.test.mjs`, `tests/member/cintas-orden-global.test.mjs` |
| Orden global | Firestore `configuracion_cintas/orden`; se lee con `useOrdenDeCintas` (una sola escucha) |
| Tabla | Firestore `cintas_miembros/{idMiembros}` (regla en `firestore.rules`) |
| Guardar (pasa por `proponerCambio`, ámbito `cintas_miembro`) | `src/services/cintas-miembros-service.js` + `cintas-miembros-apply.js` |
| Pintar y lápiz | `src/components/insignias-perfil/cintas-de-miembro.jsx` |

Documento:

```js
{
  idMiembros: 10002,
  cintas: [{
    id: '3',
    veces: 2,
    efectoBorde: 'ola',
    efectoNumero: 'destello',
    origen: 'prueba' | 'award',
    asignadaEn: '2026-09-16T…'
  }],
  actualizadoEn, actualizadoPor
}
```

- Se guarda solo el id de la cinta (`'3'`, `'12a'`), no el nombre del archivo.
- Lectura: cualquier sesión del sistema. Escritura: solo Administrador Global.
- Se ve en el perfil propio (`/dashboard/member/account`) y en la ficha de edición
  (tarjeta de la foto). Sustituye al ejemplo fijo que solo salía en EDR-10002.
- **Lápiz de prueba**: solo el Administrador Global; abre las 40 cintas para marcar
  y desmarcar. Lo asignado así queda con `origen: 'prueba'` y en Historial.

## Veces ganada

- `veces` (1-99; sin el campo cuenta como 1). Con 2 o más se pintan encima, centrados, los dígitos dorados de `public/parches/Cintas y medallas/numeros-cintas` (`digitosDeVeces`).
- Es la fuente única para los awards y adiestramientos que cuentan cuántas veces se completaron.
- El lápiz de prueba tiene `−` / `+` en cada cinta marcada.

## Efectos visuales

- El diálogo de prueba tiene dos selectores globales: uno para todos los bordes
  dorados y otro para todos los números. Al guardar, la elección se aplica a las
  cintas del miembro.
- Bordes dorados: barrido actual, ola lenta, pulso suave, centelleo doble o sin
  efecto. Solo se pintan en las cintas 3, 5, 6, 7 y 12a.
- Números: barrido actual, destello de estrella, aura dorada, centelleo doble o
  sin efecto.
- Los documentos antiguos sin estos campos usan `barrido`, para conservar su
  apariencia.
- Las animaciones se desactivan con `prefers-reduced-motion`.

## Pendiente

- Tabla award (o grupo de awards) → número de cinta.
- Con más de 18 cintas: cuáles se muestran.
- Si la persona lleva la medalla, no se muestra su cinta.

## Medallas

Mismo trato que las cintas —perfil, pestaña **Medallas** dentro del mismo diálogo (el lápiz de las cintas) del
Administrador Global y pestaña **Medallas** en EXPLORA Designer
(`/dashboard/everest?seccion=medallas`) con orden global arrastrable—, con una
diferencia: **el catálogo es la carpeta** `public/parches/Cintas y medallas/medallas`.

- Cualquier imagen (WebP, PNG, JPG, GIF, AVIF) que se deje ahí aparece en la
  aplicación, sin tocar código. Las subcarpetas (`en proceso`) no cuentan.
- El id es el nombre del archivo sin extensión. El número inicial, si lo tiene, es
  su orden de fábrica; las que no lo tienen van detrás, por nombre. El nombre que se
  ve sale del archivo (`national-leadership-award` → "National leadership award").
- `<nombre>-small.webp` es la variante reducida de `<nombre>` (ver
  `DIRECTRICES-MEDALLAS.md`): no es otra medalla, es la que se pinta en el perfil.
- En desarrollo, `/api/insignias/medallas` lee la carpeta al momento. En Netlify la
  función no lleva `public/`, así que lee `src/utils/medallas-manifiesto.json`, que
  `scripts/generar-manifiesto-medallas.mjs` regenera antes de cada build (`prebuild`).
- En el perfil van justo debajo de las cintas: **como mucho 3**, en una fila, cada una del ancho de una cinta y con el mismo hueco que hay entre las cintas. El diálogo no deja marcar una cuarta.
- Renombrar un archivo cambia su id: quien la tenía asignada deja de verla.
- **Efectos, para que no se vean estáticas.** Dos ajustes que se combinan, globales
  para las medallas de cada miembro (se eligen en la pestaña Medallas del lápiz de
  las cintas y se guardan en cada entrada como `efectoMovimiento`/`efectoBrillo`):
  - Movimiento: `soplo` (por defecto: ráfaga de aire, la cinta se mece y el medallón
    la sigue con retraso), `pendulo` (solo el medallón), `balanceo` (la pieza entera),
    `latido` (el medallón late) o `ninguno`.
  - Brillo: `destello` (por defecto: una franja de luz cruza el medallón), `resplandor`
    (halo dorado que pulsa), `centelleo` (estrellitas) o `ninguno`.
  - La imagen se pinta en dos capas (cinta hasta el 56 % del alto, medallón desde el
    55 %) y el brillo se enmascara con la propia imagen. Cada medalla arranca su ciclo
    desfasado (`desfaseDeMedalla`) y ningún efecto tiene tramos quietos (con pausas
    parecía congelarse). Con "reducir movimiento" activado en el sistema, no se mueven.
  - Cuatro perillas (`AJUSTES_MEDALLA`): velocidad y fuerza del movimiento, velocidad e
    intensidad del brillo. Son multiplicadores (1 = el efecto de siempre); fuera de rango
    vuelven a 1. Se guardan con cada medalla, como el tipo de efecto.
  - En el Designer se prueban sobre todo el catálogo.

| Pieza | Dónde |
|---|---|
| Catálogo, orden y filas (sin React) | `src/utils/medallas-perfil.mjs` |
| Catálogo servido | `src/app/api/insignias/medallas/route.js` |
| Tabla | Firestore `medallas_miembros/{idMiembros}`; orden en `configuracion_cintas/orden-medallas` |
| Guardar (`proponerCambio`, ámbito `cintas_miembro`) | `src/services/medallas-miembros-service.js` + `medallas-miembros-apply.js` |
| Perfil y diálogo | `src/components/insignias-perfil/medallas-de-miembro.jsx` |
| Designer | `src/sections/everest/everest-medallas.jsx` |
| Test | `tests/member/medallas-perfil.test.mjs` |

## Pines

El tercer apartado del perfil, con el mismo trato que las medallas: **perfil**,
pestaña **Pines** del mismo diálogo del lápiz de las cintas (Administrador Global,
un solo Guardar para las tres) y pestaña **Pines** en EXPLORA Designer
(`/dashboard/everest?seccion=pines`) con orden global arrastrable y
"Agregar pin".

- **En el perfil van ENCIMA de las cintas, centrados**: una sola fila, **como
  mucho 3**, cada uno del ancho de una cinta y con el mismo hueco que hay entre
  ellas. El diálogo no deja marcar un cuarto. Sin pines no ocupan sitio; mientras
  cargan se guarda el hueco solo si esa persona tenía pines la última vez.
- **El catálogo es la carpeta** `public/parches/Cintas y medallas/pines`: cualquier
  imagen que se deje ahí sale en la aplicación sin tocar código (hoy dos:
  `instructor-juvenil` y `pin-instructor`). Mismas reglas de nombre que las
  medallas: el id es el nombre sin extensión, el número inicial (si lo hay) es el
  orden de fábrica, el nombre visible sale del archivo y `-small` es la variante
  reducida. Renombrar un archivo cambia su id: quien lo tenía deja de verlo.
- En desarrollo `/api/insignias/pines` lee la carpeta al momento; en Netlify lee
  `src/utils/pines-manifiesto.json`, que `scripts/generar-manifiesto-medallas.mjs`
  regenera en `prebuild` junto al de medallas.
- Los añadidos desde el Designer son insignias personalizadas de tipo `pin`
  (Storage `everest/insignias-pin/`, ficha en `insignias_personalizadas`) y van
  detrás de los de la carpeta.
- Sin efectos animados: el pin es una pieza de metal fija en el uniforme.

| Pieza | Dónde |
|---|---|
| Catálogo, orden y filas (sin React) | `src/utils/pines-perfil.mjs` (reutiliza la lectura y el orden de `medallas-perfil.mjs`) |
| Catálogo servido | `src/app/api/insignias/pines/route.js` |
| Tabla | Firestore `pines_miembros/{idMiembros}` (`{ pines: [{ id, origen, asignadaEn }] }`); orden en `configuracion_cintas/orden-pines` |
| Guardar (`proponerCambio`, ámbito `cintas_miembro`) | `src/services/pines-miembros-service.js` + `pines-miembros-apply.js` |
| Perfil, esqueleto y diálogo | `src/components/insignias-perfil/pines-de-miembro.jsx` |
| Designer | `src/sections/everest/everest-pines.jsx` |
| Test | `tests/member/pines-perfil.test.mjs` |

- Lectura: cualquier sesión del sistema. Escritura: solo Administrador Global
  (regla explícita en `firestore.rules` y excluida del comodín).
