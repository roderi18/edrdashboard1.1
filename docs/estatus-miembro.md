# Estatus del miembro y la asistencia

Cuatro estatus, y la asistencia los mueve sola. Antes solo había "Activo" e
"Inactivo", los cambiaba alguien a mano cuando se acordaba, y quien llevaba medio
año sin venir seguía "Activo" sin que nadie lo reclutara.

| Estatus | Chip | Qué significa |
|---|---|---|
| `active` | Activo (verde) | Asiste con regularidad |
| `reclutamiento` | Reclutamiento (amarillo) | Faltó 3 reuniones o más |
| `banned` | Inactivo (rojo) | 3 meses sin asistir |
| `fallecido` | Fallecido (gris) | Falleció; no se mueve solo |

Los valores `active` y `banned` son los de siempre: no se renombran para no
romper lo guardado en la API .NET.

## La regla

| De | A | Cuándo |
|---|---|---|
| Activo | Reclutamiento | 3 ausencias seguidas en reuniones |
| Cualquiera (menos Fallecido) | Inactivo | 3 meses desde la última presencia |
| Reclutamiento | Activo | 1 presencia |
| Inactivo | Activo | 3 presencias seguidas |
| Miembro nuevo | — | Empieza en Reclutamiento; 3 reuniones seguidas para Activo |

- **Excusa y enfermo no son falta**: cortan la racha, pero tampoco son presencia,
  así que la regla de los 3 meses baja igual a quien avisa cada sábado.
- **"Otro · De licencia" no es falta**: el miembro está ausente con permiso
  varios días. Corta la racha de faltas, pero tampoco es presencia (ver
  "Licencias" más abajo).
- **Un día sin reunión no cuenta**: si no se pasó lista o es una actividad
  (excursión, campamento), no mueve las rachas. Venir a una actividad sí cuenta
  como presencia para los 3 meses, pero no reactiva por sí sola.
- **Fallecido no se mueve nunca**, ni marcándolo presente por error.
- **Un cambio a mano manda 30 días**: la regla sigue contando faltas, pero no
  cambia el estatus hasta que pasen. Si no, el pase de lista del sábado deshacía
  lo que el coordinador puso el martes.
- **Al cambiar de destacamento** las rachas empiezan de cero y el estatus se
  queda como está.

## Cuándo se calcula

- **Al guardar un pase de lista**: faltas y presencias seguidas.
- **Al abrir el destacamento en `/attendance`**: los 3 meses, con la fecha de hoy.
  No hace falta que nadie pase lista, pero sí que alguien entre.
- El cambio es **automático** y queda en Historial a nombre de **Sistema**, con
  la fecha del pase de lista que lo provocó.

## Avisos

| Estatus | A quién |
|---|---|
| Reclutamiento | Los cargos del destacamento, **menos el Pastor** |
| Inactivo y Fallecido | Los 7 cargos del destacamento **y** Oficina Nacional, Administrador Global y Consejo Ejecutivo, con quién es y de qué destacamento |
| Aviso previo | 14 días antes de caer en Inactivo, a los cargos del destacamento sin el Pastor |

**Un aviso por pase de lista, no uno por miembro**: un sábado puede mover a media
docena y serían seis campanas seguidas. Si el aviso falla, el estatus ya está
guardado y no se deshace.

## A mano

- **Motivo obligatorio**, que queda en Historial y en el aviso.
- **"Fallecido"**: solo Coordinador de Destacamento, su Asistente y Administrador
  Global, y además hay que escribir el nombre del miembro para confirmar.
- Pasa por `proponerCambio` (ámbito `estatus_miembro`).

## En el pase de lista

- Los **fallecidos no salen**: ni presente ni ausente.
- Los **inactivos van al final, recogidos**, y se pueden abrir si alguno aparece.
  Marcar ausente cada sábado a quien no va a venir en meses ensuciaba el conteo.

## Licencias ("Otro · De licencia")

En el pase de lista, **"Otro" abre un menú** en vez de marcar a secas:

1. **De licencia…** (la primera): pide la cantidad de días (atajos de 7, 14, 30,
   60 y 90; hasta 180). Desde el día que se está pasando lista.
2. **Suspensión disciplinaria…**: igual que la licencia, con días. Tampoco es
   falta: si contara, la suspensión le sumaría además un cambio de estatus.
3. **Quitar licencia / suspensión**, si el miembro ya tiene una ese día.
4. **Otro (sin motivo)**: el "Otro" de siempre.

Mientras la licencia dure:

- El miembro sale como **"Otro"** con "De licencia hasta dd/mm" debajo, aunque
  nadie lo marque. **No se guarda como ausente.**
- En el registro de ese día queda `estado: 'otro'` y `detalleOtro` con el motivo
  (`'licencia'` o `'suspension'`); la licencia guarda también su `motivo`.
- Para el estatus cuenta como `licencia`: no suma falta ni presencia. Si dura
  más de tres meses, la regla de los 3 meses lo baja igual a Inactivo.

Firestore: `licenciasAsistencia/{idMiembro}_{fechaInicio}` con miembro,
destacamento, días, `fechaInicio` y `fechaFin` (el primer día cuenta: 7 días
desde el sábado 5 terminan el viernes 11). Regla en `firestore.rules`. Lógica y
test: `src/utils/licencias-asistencia.mjs`, `tests/member/licencias-asistencia.test.mjs`.

## Dónde está

| Pieza | Dónde |
|---|---|
| Los 4 estatus, etiquetas y colores | `src/utils/estatus-miembro.mjs` |
| La regla (sin React ni Firebase) | `src/utils/estatus-por-asistencia.mjs` |
| A quién se avisa y quién marca Fallecido | `src/utils/estatus-miembro-avisos.mjs` |
| Leer, aplicar y avisar | `src/services/estatus-miembros-service.js` + `estatus-miembros-apply.js` |
| Avisos | `crearNotificacionEstatusMiembros`, `crearNotificacionProximosAInactivo` |
| Chip del perfil | `src/components/label/chip-estatus-miembro.jsx` |
| Cambio a mano | `src/sections/member/member-estatus-dialog.jsx` |
| Enganche con el pase de lista | `src/sections/attendance/view/attendance-quick-view.jsx` |
| Tests | `tests/member/estatus-miembro.test.mjs`, `estatus-por-asistencia.test.mjs`, `estatus-miembro-avisos.test.mjs` |

Firestore: `estatus_miembros/{idMiembros}` (regla en `firestore.rules`).

```js
{
  idMiembros: '10002',
  idDestacamento: '12',
  estatus: 'active',
  faltasSeguidas: 0,
  presenciasSeguidas: 2,
  fechaUltimaPresencia: '2026-09-12',
  desde: '2026-09-12',
  motivo: 'Volvió a la reunión.',
  autor: 'sistema',
  respetarManualHasta: '',
}
```

## Pendiente

- El estatus también vive en la API .NET (`estatusMiembro`). Hay que comprobar
  que acepta los textos nuevos (`reclutamiento`, `fallecido`); Firestore ya los
  guarda.
- Los 3 meses se calculan cuando alguien abre el destacamento. Si nadie entra, el
  cambio espera. Una tarea diaria en el servidor lo haría independiente.
