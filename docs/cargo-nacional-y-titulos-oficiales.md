# "Cargo Nacional" de la ficha y títulos de los Oficiales de la Nacional

## La regla

**"Cargo Nacional" de la ficha del miembro es la Jerarquía.** Todo el que ocupa
una casilla de la Directiva Nacional vigente (Consejo Ejecutivo, directivas
regionales y seccionales) ve ese mismo cargo en su ficha, igual que "Nivel
posición en tu Destacamento" refleja el organigrama del destacamento. No hay dos
datos: los dos campos se rellenan leyendo `asignaciones_directiva` (solo las
activas), que es lo que dibuja el organigrama, y al guardar la ficha se escribe
ahí mismo.

| Dónde se asigna | Se ve en |
|---|---|
| Jerarquía (`/dashboard/level/national`, pestaña Jerarquía, o la ficha del cargo) | "Cargo Nacional" de la ficha |
| "Cargo Nacional" de la ficha | La casilla de la Jerarquía |

### Lo que se rompía

Los cargos se leían bien, pero el miembro llega a la ficha por partes (caché,
luego con foto y metadatos) y **cada versión hacía `reset` del formulario** con
"Cargo Nacional" y "Posición" en vacío, *después* de haberlos puesto. Resultado:
el Consejo Nacional entero salía con "Ninguno" (p. ej. el Director Nacional).

Ahora lo leído de la Directiva se guarda (`cargosDeDirectivaRef`, por miembro) y
`reaplicarCargosDeDirectiva` lo vuelve a poner tras cada reset
(`src/sections/member/member-create-edit-form.jsx`).

## Títulos de los Oficiales de la Nacional

Los Oficiales Especiales (Oficiales de la Nacional) pueden llevar **un título**:
Diseño y artes, Proyectos de misiones, Protocolo, Comisión permanente de
estatutos, Encargado Senda adiestramiento Lideres Organizacionales (ALO),
Coordinador tecnología, Comité de Evaluaciones de premios y sendas ascenso, y los
que añada el Administrador Global con "Nuevo".

- **Cada persona, un solo título; cada título, cuantas personas haga falta.**
  Un título no tiene límite de personas (una comisión o un comité es un grupo).
  El desplegable sigue el orden de la lista, no deshabilita ninguno y dice
  quiénes lo llevan ("Lo lleva Ana", "Lo llevan 3 oficiales"), contando solo a
  los oficiales vigentes. Antes cada título era de una sola persona; se cambió
  a petición.
- **Asignan** Administrador Global y Oficina Nacional; **"Nuevo"** solo el
  Administrador Global (lo exigen también las reglas de Firestore).
- **Es de la persona** (`idMiembros`), no de la casilla, y no da permisos: es un
  nombre.
- **Solo cuenta la directiva actual.** Lleva título quien HOY ocupa una casilla
  `nacional-oficial-especial-N` activa en `asignaciones_directiva`
  (`leerOficialesVigentes`). Quien deja de serlo conserva su fila guardada, pero
  su título no se pinta ni cuenta entre quienes lo llevan; a quien no es
  oficial hoy no se le puede asignar.
- **Color:** el título va en azul con `azulLegible` (`primary.main` en claro,
  `primary.light` en oscuro).

### "Asignar miembros" (varias personas con un título)

En el menú ••• de la tarjeta "Oficiales Especiales" de la directiva actual
(también en la pestaña Jerarquía de la lista), para Administrador Global y
Oficina Nacional:

1. Se elige el título (con "Nuevo" para el Administrador Global) y varias
   personas.
2. Quien ya es Oficial Especial solo cambia de título. Quien tiene otro cargo,
   en esta directiva o en otro consejo, sale apagado ("se asigna desde su
   casilla"): moverlo le quitaría ese cargo, y eso se pregunta allí.
3. A cada persona nueva se le da una casilla de Oficial Especial: primero las
   que están vacías, y después se crean las que falten (el organigrama admite
   veinte). Las asignaciones van una detrás de otra.
4. Al final, el título se guarda a todos en una sola transacción
   (`guardarTituloDeVariosOficiales`). Quien no llega a quedar asignado (por
   ejemplo, porque su asignación queda pendiente de aprobación) se queda sin
   título.

Piezas: `src/sections/national/leadership/asignar-oficiales-dialog.jsx` (el
diálogo) y `asignarOficiales` en `national-leadership-view.jsx`. El desplegable
de títulos es `SelectorDeTitulo`, el mismo de "Asignar título".

### Todos en la tarjeta, nada debajo

Los Oficiales Especiales se acumulan solo en la tarjeta "Oficiales Especiales" (caras, "+N" y "Ver más"). Sus casillas `oficial-especial-N` siguen guardando cada asignación, pero ya no se dibujan colgando debajo en el árbol: cada persona salía dos veces y el árbol crecía una fila por oficial. Por eso ya no hay botón "+" de casilla vacía (las crea "Asignar miembros"), y quitar a un oficial se hace desde los tres puntos de su tarjeta en "Ver más" → "Quitar de Oficiales Especiales".

### Dónde se ve y se asigna (todo sincronizado)

| Sitio | Qué muestra | Cómo se asigna |
|---|---|---|
| Franja "Ver más" de la tarjeta "Oficiales Especiales" | El título **en lugar de** "Oficial de la Nacional" | Tres puntos arriba a la derecha → "Asignar título" |
| "Cargo Nacional" de la ficha | El título en lugar de "Oficial Especial" | Enlace "Asignar título" / "Cambiar título" bajo el campo |
| Columna "Posición" de la lista del Consejo Nacional | El título (el filtro sigue agrupando por cargo) | — |

En la ficha solo aparece sobre el cargo **guardado**: con un "Oficial Especial"
recién elegido y sin guardar aún no es Oficial de la Nacional.

## Oficial Especial + región o sección

Ser Oficial Especial convive con un cargo de región o de sección (Stalin Peralta,
Subdirector Regional, puede serlo sin dejar la región). Es la única excepción a
"nadie sirve en dos consejos" (`src/utils/cargos-compatibles.mjs`):

- `guardarAsignacionDirectiva` no lo toma como conflicto, y
  `desactivarAsignacionesDirectivaPorNivel({ compatibleCon })` no retira el
  compatible al dar el otro (organigramas y ficha).
- En "Asignar miembros" sale habilitado con "Sigue siendo …"; solo sale apagado
  quien tiene otro cargo del Consejo Ejecutivo.
- En una región o sección, ser Oficial Especial no cuenta como "otro consejo":
  no se pregunta ni se retira nada.
- En la ficha, "Cargo Nacional" enseña el cargo de región o sección; poner
  "Ninguno" retira ese y conserva el de Oficial Especial.

## Asignar es instantáneo

En las cuatro directivas la casilla se pinta en el mismo clic y el diálogo se
cierra; lo que se escribe va por detrás, y si falla (o queda pendiente de
aprobación) se deshace y se avisa. "Asignar miembros" pinta personas, casillas y
títulos a la vez (`pintarTitulosYa`) y guarda en paralelo; "Asignar título"
también se pinta y cierra al momento.

## Las directivas pasadas no impactan el perfil

Ninguna posición asignada en una directiva pasada (la memoria de un cuatrienio,
`directiva_cuatrienios_integrantes`) toca el perfil de hoy: ni rellena "Cargo
Nacional" ni da título. En la tarjeta y la lista de 2022-2026 los Oficiales de la
Nacional salen con su "Oficial de la Nacional" de entonces, sin tres puntos ni
título. Solo mandan las asignaciones activas de la directiva actual. (La
excepción de permisos del Director Nacional / ex comandante, en
`docs/directiva-por-cuatrienio.md`, es de permisos, no del perfil.)

## Piezas

| Qué | Dónde |
|---|---|
| Regla (catálogo, opciones, asignar a uno o a varios, añadir) | `src/utils/titulos-oficiales-nacionales.mjs` |
| Lectura en vivo y escritura (transacción) | `src/services/titulos-oficiales-service.js` |
| Diálogo, tres puntos y permisos (`permisosDeTitulo`) | `src/sections/national/leadership/titulo-oficial.jsx` |
| Datos | Firestore `titulos_oficiales_nacionales/actual` → `{ adicionales: [], asignaciones: { [idMiembros]: { titulo, nombre, asignadoPor, asignadoEn } } }` |
| Reglas | `firestore.rules`, bloque `titulos_oficiales_nacionales` (y fuera del comodín) |

Tests: `tests/directivas/titulos-oficiales-nacionales.test.mjs`,
`tests/directivas/cargo-nacional-sigue-a-la-jerarquia.test.mjs`.
