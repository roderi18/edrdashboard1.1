# Cintas del perfil (módulo conectado a Awards)

Estado: **lógica, tabla y cintas de prueba hechas.** Falta la tabla award → cinta.

## Qué hace

Cuando una persona completa un award (o un grupo de awards), se le asigna la cinta
correspondiente, que se muestra en su perfil igual que hoy en el de EDR-10002.

## Imágenes

`public/parches/Cintas y medallas/cintas-perfil/` — 40 archivos `.webp`.
El prefijo numérico del nombre **es el orden oficial** (`1-cinta-al-valor.webp` …
`40-cinta-marron.webp`).

- Ordenar por el **número**, no alfabéticamente (si no, `10` queda antes que `2`).
- `12a` y `12b` van entre la 11 y la 13, `12a` primero.

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

## Implementación

| Pieza | Dónde |
|---|---|
| Catálogo, orden y filas (sin React) | `src/utils/cintas-perfil.mjs` |
| Test | `tests/member/cintas-perfil-orden.test.mjs` |
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
