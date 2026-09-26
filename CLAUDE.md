# Memoria del proyecto — Exploradores del Rey (ERD Dashboard)

**Lee [`PROJECT_GUIDELINES.md`](./PROJECT_GUIDELINES.md) antes de tocar código.**
Este archivo es solo el resumen que no se puede olvidar nunca.

---

## Qué es esto

Dashboard de una organización juvenil (Nación → Región → Sección → Destacamento →
Miembro). Next.js 16 (App Router) + React 19 + MUI 7. **Regla transversal: cada
persona ve y toca solo lo que su cargo alcanza.**

## Dos fuentes de datos — compruébalo antes de escribir

| Dónde | Qué |
|---|---|
| **API .NET** `systexploradores.somee.com` | Padrón heredado: Miembros, Destacamentos, Secciones, Regiones, Iglesias, Divisiones, Países, Cargos, Tutores |
| **Firestore** | Todo lo demás: notificaciones, chat, muro, salud, ascenso, asistencia, tienda, directivas, roles, auditoría |

Un miembro existe en los dos, enlazado por `idMiembros`. La API .NET **solo** se
llama desde `/api/*`, y siempre a través de `fetchUpstreamText`
(`src/utils/upstream-cache.js`): va de 0,3 s a 17 s y por eso hay caché y timeouts.

## Reglas de alcance — no las cambies sin leer su test

1. Los guardas preguntan por **todos los cargos** (`rolesQueEjerce`), no por `rolId`.
2. **Dominancia por módulo**: con dos cargos manda el del nivel del módulo, no el de mayor rango.
3. **Ver se suma entre cargos; editar sigue la dominancia.**
4. **Tres listas, tres alcances**: secciones, destacamentos y miembros se acotan por separado.
5. **Oficina Nacional es un rol a mano**: no ocupa casilla de directiva.
6. `/member` es la lista del destacamento propio (salvo Administrador Global); a los de otro destacamento se llega por la pestaña "Miembros" de su ficha.
7. **Director Regional (antes "Coordinador Regional") y Sub-Director Regional proponen en las secciones de su región** (ficha y directiva): el titular propone, el asistente sugiere, y lo aprueba la Oficina Nacional. Los otros seis cargos regionales siguen siendo de consulta, y los destacamentos siguen cerrados para los ocho.

8. **Buzones compartidos del chat** (Tienda Virtual 20001, Oficina Nacional 20002): un poder, no una cuenta. Cada uno es una entrada de `src/utils/chat-buzones.mjs`; lo atienden sus cargos (entre todos los de la persona) y el Administrador Global atiende todos. El servidor comprueba el cargo antes de escribir como el buzón; una persona nunca usa esos números. Test: `tests/chat/chat-buzones-compartidos.test.mjs`.

8b. **Chat de Sistema (20003): se lee, no se contesta.** No es un buzón: nadie lo
   atiende y solo escribe el servidor (Admin SDK). Servidor, reglas y sesión
   rechazan escribirle o usar su número. Hoy avisa de cumpleaños: a los 7, 1 y 0
   días, UN mensaje con la lista (foto, nombre, cuándo) a todas las personas con
   cuenta del destacamento, Pastor incluido y sin mirar preferencias; el
   cumpleañero no se ve en la lista y el día recibe su felicitación. La campana
   avisa solo a 1 y 0 días. Cada envío queda en `chat_sistema_registro` (pestaña
   "Chat Sistema" de `/admin/notificaciones`, solo Administrador Global).
   Piezas: `src/utils/chat-sistema.mjs`, `src/server/chat-sistema-*.mjs`; prueba a
   mano: `scripts/prueba-chat-sistema-cumpleanos.mjs`. Test: `tests/chat/chat-sistema.test.mjs`.

9. **El Administrador Global reina sobre cualquier otro cargo.** Si lo ejerce por cualquier vía (principal o en `cargos`), es su rol principal en todos los módulos; la dominancia por módulo no se lo quita. Una sola pieza: `src/utils/administrador-global-reina.mjs` (la sesión y los guardas). Solo la prueba de roles lo sustituye, y aun entonces el menú lateral sigue siendo el suyo (`sesionSinPrueba`): los permisos de la pareja los aplican las pantallas. Test: `tests/acceso/administrador-global-reina.test.mjs`.

10. **El estatus del miembro lo mueve la asistencia** (activo, reclutamiento,
   inactivo, fallecido): 3 faltas seguidas, 3 meses sin venir, y vuelve con 1 o 3
   presencias. Automático y a nombre de "Sistema"; un cambio a mano manda 30 días.
   Reclutamiento avisa al destacamento sin el Pastor; inactivo y fallecido avisan
   además a Oficina Nacional, Administrador Global y Consejo Ejecutivo. "Fallecido"
   solo lo marcan Coordinador de Destacamento, su Asistente y Administrador Global.
   "Otro · De licencia" (N días, en `licenciasAsistencia`) no es falta ni presencia:
   mientras dure, el pase de lista lo pone solo en vez de ausente.
   Regla en `src/utils/estatus-por-asistencia.mjs`, detalle en `docs/estatus-miembro.md`.
   Tests: `tests/member/estatus-*.test.mjs`.

11. **Las cintas del perfil salen en el orden del manual**: el número del archivo
   manda (3 por fila, hasta 18, la fila incompleta arriba y centrada), y con el
   premio ganado más de una vez va el número dorado encima. Catálogo y reglas en
   `src/utils/cintas-perfil.mjs`; se guardan en `cintas_miembros` y hoy solo las
   pone a mano el Administrador Global. Detalle en `docs/cintas-perfil.md`.
   El Administrador Global puede cambiar ese orden arrastrándolas en EXPLORA
   Designer → Cintas: se guarda en `configuracion_cintas/orden` y manda en todos
   los perfiles y al asignarlas; sin orden guardado, el del archivo.
   **Las medallas, igual, pero el catálogo es la carpeta**
   `public/parches/Cintas y medallas/medallas`: cualquier imagen que se deje ahí
   sale en la aplicación (`/api/insignias/medallas`; en producción, el manifiesto
   que `prebuild` regenera). Las `-small` son su variante pequeña, no otra medalla.
   Se guardan en `medallas_miembros`; su orden, en `configuracion_cintas/orden-medallas`.
   Reglas en `src/utils/medallas-perfil.mjs`.
   **Los pines, igual que las medallas** (carpeta `public/parches/Cintas y medallas/pines`,
   `/api/insignias/pines`, `pines_miembros`, orden en `configuracion_cintas/orden-pines`),
   pero en el perfil van **encima de las cintas, centrados**, en una fila de como
   mucho 3. Reglas en `src/utils/pines-perfil.mjs`.
   **Además, el Administrador Global añade cintas, medallas y pines desde EXPLORA
   Designer** ("Agregar cinta/medalla/pin": imagen, nombre y descripción, las tres
   obligatorias). La imagen va a Storage (`everest/insignias-{tipo}/`) y la ficha
   a `insignias_personalizadas`; se suman detrás de las de fábrica con id `p<fecha>`
   y se ordenan y asignan igual (`src/utils/insignias-personalizadas.mjs`; las
   cintas se registran en el catálogo con `registrarCintasPersonalizadas`). En el
   Designer se ordenan arrastrando: la tarjeta sigue al puntero y las demás se
   apartan en vivo (`src/sections/everest/rejilla-ordenable.jsx`).
   Tests: `tests/member/cintas-perfil-orden.test.mjs`, `tests/member/cintas-orden-global.test.mjs`,
   `tests/member/medallas-perfil.test.mjs`, `tests/member/insignias-personalizadas.test.mjs`,
   `tests/member/pines-perfil.test.mjs`.

12. **La Directiva Nacional se guarda por cuatrienio** (2022-2026 cerrado, del
   20/08/2022 al 22/08/2026; 2026-2030 vigente; el 22/08/2026 ya es el nuevo).
   Se elige en el título de `/dashboard/level/national` (desplegable) y se pinta
   en la misma tabla que la directiva actual. Es memoria: foto fija
   (la foto se COPIA a `directiva-historica/`, nunca se enlaza la de perfil) y
   **no da permisos**; mandan los cargos actuales. Única excepción: quien es o fue
   Director Nacional —o Comandante Nacional, su nombre antiguo— conserva los
   permisos de Director Nacional (lo suma el servidor en `leerAsignacionesDe`), y
   el ex comandante sale siempre en el Consejo Ejecutivo. Una persona, un cargo
   por cuatrienio. Editan Administrador Global y Oficina Nacional, avisándose;
   crear en el padrón (carga del listado) solo el Administrador Global. Los
   organigramas históricos son los de siempre con `historico`. Reglas en
   `src/utils/directiva-cuatrienios.mjs`, detalle en `docs/directiva-por-cuatrienio.md`.
   Tests: `tests/directivas/directiva-cuatrienios.test.mjs`,
   `tests/acceso/director-nacional-permanente.test.mjs`.

13. **Premios del miembro: una sola tarjeta de insignia.** Toda carpeta de premios
   (la última de su rama, en Sistema de Ascenso y Academia) se pinta en cuadrícula
   por defecto con la tarjeta de `awards-insignia-item.jsx`: insignia por NOMBRE
   desde `public/sistemaAscenso` (`src/utils/insignias-de-premios.mjs`), check verde
   con certificado y amarillo sin él, `x2` de veces ganado, transparencia sin
   completar. En el Sistema de Ascenso, Ctrl + clic (o pulsación larga en el
   móvil) y "Completar"/"Quitar completado" por lotes; quitar sigue pidiendo
   aprobación según el cargo y borra el certificado. Medidas, colores y textos en
   `TARJETA_INSIGNIA`. Detalle en `docs/premios-tarjeta-de-insignia.md`.
   Tests: `tests/ascenso/insignias-de-premios.test.mjs`,
   `tests/ascenso/completar-varios-premios.test.mjs`.

14. **Títulos de los Oficiales de la Nacional**: tres puntos en cada oficial de la
   tarjeta "Oficiales Especiales" (en "Ver más") → "Asignar título" o "Quitar". Se acumulan SOLO en esa tarjeta: sus casillas guardan la asignación pero no se dibujan debajo. Cada
   persona lleva un solo título, pero **un título lo llevan varias personas, sin
   límite** (el desplegable dice quiénes; ninguno se deshabilita). El menú de la
   tarjeta tiene **"Asignar miembros"**: un título y varias personas a la vez; a
   cada una se le da una casilla de Oficial Especial (primero las vacías, luego
   se crean, hasta veinte) y el título. Quien ya es oficial solo cambia de
   título; quien tiene otro cargo sale apagado. El título SUSTITUYE a "Oficial de la Nacional"/"Oficial
   Especial" en la franja, la casilla, la columna Posición y "Cargo Nacional" de
   la ficha (que también lo asigna). Asignan Administrador Global y Oficina
   Nacional; "Nuevo" en la lista, solo el primero. Es de la persona
   (`idMiembros`) y no da permisos, pero **solo cuenta la directiva actual**: lo
   lleva quien HOY ocupa una casilla de Oficial Especial; en una directiva pasada
   ni se asigna ni se pinta, y el de un ex oficial queda libre. Todo en
   `titulos_oficiales_nacionales/actual`; regla en
   `src/utils/titulos-oficiales-nacionales.mjs`. Detalle en
   `docs/cargo-nacional-y-titulos-oficiales.md`.
   Test: `tests/directivas/titulos-oficiales-nacionales.test.mjs`.

15. **"Cargo Nacional" de la ficha = la Jerarquía.** Todo el Consejo Nacional
   vigente ve en su ficha el cargo que ocupa en el organigrama (igual que
   "Posición en tu Destacamento" con el del destacamento): ambos salen de
   `asignaciones_directiva` y se escriben ahí. El miembro llega por partes y cada
   `reset` del formulario los vaciaba; por eso lo leído se reaplica tras cada
   reset (`reaplicarCargosDeDirectiva` en `member-create-edit-form.jsx`).
   **Ninguna posición de una directiva pasada impacta el perfil**: la memoria de
   un cuatrienio (`directiva_cuatrienios_integrantes`) no rellena la ficha ni da
   título; solo las asignaciones activas de hoy. (La única excepción sigue siendo
   la de permisos del punto 12: Director Nacional / ex comandante.)
   Test: `tests/directivas/cargo-nacional-sigue-a-la-jerarquia.test.mjs`.

16. **Oficial Especial convive con un cargo de región o de sección** (y solo con
   esos): es la única excepción a "nadie sirve en dos consejos". Ni se bloquea al
   darlo ni se retira el otro (servicio, organigramas y ficha). Dentro del
   Consejo Ejecutivo sigue valiendo un cargo por persona. En la ficha, "Cargo
   Nacional" enseña el de región o sección. Regla en `src/utils/cargos-compatibles.mjs`.

17. **Asignar en cualquier directiva es instantáneo**: la casilla (y el título)
   se pinta en el mismo clic, el diálogo se cierra y la escritura va por detrás;
   si falla o queda pendiente, se deshace y se avisa. `RETARDO_ASIGNACION_MS = 0`
   rige los cuatro organigramas. No vuelvas a poner esperas de cortesía.
   Test: `tests/directivas/oficial-especial-y-asignar-al-instante.test.mjs`.

18. **"Agregar casilla" en los cuatro organigramas** (botón encima del lápiz, solo
   Administrador Global): una casilla (cargo que se asigna) o un contenedor (caja
   que agrupa) con nombre, colgando del nodo que se elija. Es **global por nivel**
   —la de una sección sale en todas— y entra en el catálogo, así que sale también
   en "Cargo Nacional" (nación, región, sección) o "Nivel posición en tu
   Destacamento". Se guardan en `casillas_directiva_personalizadas` y se suman a
   `DIRECTIVA_POSITIONS` con `registrarCasillasPersonalizadas`; quitar una la deja
   inactiva (su nombre se sigue traduciendo). Piezas:
   `src/utils/casillas-personalizadas.mjs`, `use-casillas-personalizadas.js`,
   `casillas-directiva-dialog.jsx`. Detalle en `docs/casillas-personalizadas.md`.
   Test: `tests/directivas/casillas-personalizadas.test.mjs`.

Corazón del alcance: `src/utils/member-access.js` y `src/utils/org-level-access.js`.
Suite que lo cubre: `npm run test:acceso`.

## Convenciones

- **Comentarios en español, explicando el PORQUÉ** (qué se rompía antes). Es la
  convención más visible del repositorio. Mantenla.
- Nombres de dominio en español; los de la plantilla siguen en inglés.
- Prettier: 100 columnas, comillas simples, 2 espacios, LF.
- **El repositorio no está limpio de formato**: formatea solo lo que tocas, o el
  diff se llena de reformateo ajeno.
- **Una imagen de referencia es el QUÉ, no el CON QUÉ.** Cuando llegue una
  captura o una maqueta para copiar, se reproduce la *disposición* con los
  **componentes y los colores del proyecto**: `Label`, `Iconify` (iconos del
  paquete de `src/components/iconify/icon-sets.js`, nunca uno sin registrar
  —se carga por internet y parpadea—), la paleta del tema, y el
  `DashboardContent` con las medidas de `src/components/commerce/commerce-layout.js`
  en las pantallas de la tienda. Nada de hex sueltos copiados del pixel: el
  cian `#00B8D9` de la plantilla ya se colaba dos veces donde tocaba el verde
  de la casa (`primary`). Si el color no distingue una cosa de otra —tres
  garantías, no tres estados—, va uno solo.
- **Texto azul en pantallas oscuras: siempre el azul más claro de la paleta
  que sigue siendo azul** (`primary.light`, #7A9BD4), nunca `primary.main`
  (#1F4FA6), que sobre una tarjeta oscura casi no se lee. En claro, `primary.main`.
  Una sola pieza: `azulLegible(theme)` de `src/theme/azul-legible.js`
  (`sx={(theme) => ({ ...azulLegible(theme) })}`). `primary.lighter` ya es casi
  blanco y no se usa para texto.
- **Fechas: siempre el calendario del proyecto**, nunca `<input type="date">` ni
  `datetime-local`. Con formulario, `Field.DatePicker` / `Field.DateTimePicker`
  (`src/components/hook-form`); sin él, `DatePicker` / `DateTimePicker` de
  `@mui/x-date-pickers` con `format="DD/MM/YYYY"` (y `ampm` + `hh:mm A` si lleva
  hora). El nativo cambia de aspecto y de orden de campos en cada sistema, y
  dejaba dos formas distintas de escribir una fecha en la misma pantalla. El
  `LocalizationProvider` ya está puesto en `src/app/layout.jsx`.
- **Todo lo nuevo se siente instantáneo** (detalle en `PROJECT_GUIDELINES.md` §2):
  esqueleto al instante (`loading.jsx` en cada ruta, nunca `null` ni "Cargando..."),
  responde al pulsar, carga diferida (`next/dynamic`/`import()` para lo pesado,
  nada de `@react-pdf/renderer` arriba en una pantalla) y caché
  (`conCache`/`conInvalidacion` de `src/utils/cache-de-lecturas.mjs`). Datos de
  personas, solo en memoria; cerrar sesión los borra todos.
- Código de servidor probable → `.mjs`, para importarlo desde `node --test`.
- Tests en español, nombrados por el comportamiento, con encabezado que explica
  qué se rompía. Importan el **código real** vía `tests/soporte/resolver-alias-src.mjs`.

## EXPLORA Designer — la portada no cambia hasta que se publica

Herramienta del Administrador Global para editar desde la aplicación todo lo de
`/principal` (encabezados, próxima actividad, eventos, comunicados, destacamento destacado…)
sin tocar código. **Regla que no se rompe: `/principal` se ve exactamente igual
—textos, orden, imágenes y videos— hasta que alguien publica ese bloque desde el
Designer.**

- **El valor de fábrica es el código.** `datos-de-ejemplo.js` y `LEMA_DE_FABRICA`
  no se copian ni se siembran en Firestore. Un bloque sin publicar sale de ahí
  (`src/sections/principal/fabrica-de-portada.js`).
- **La portada pide cada bloque a `useContenidoDePortada`**, que es lo único de
  `src/sections/principal/` que importa del Designer, y solo lee. Arranca con lo
  de fábrica; "no se pudo leer" no borra lo que ya se pintaba.
- **Se publica por bloque**, en `everest_publicado/principal` → `bloques`. Un
  bloque ausente, roto o que no pasa el saneado vuelve a lo de fábrica; nunca deja
  un hueco (`src/utils/everest/portada.mjs`).
- **Las fotos y videos de hoy no se mueven**: siguen en `fotos` →
  `principalTarjeta/{bienvenida,proxima-actividad}` y `principal-tarjetas/` de
  Storage. Lo nuevo va a `everest/`.
- **Un solo registro de bloques**: `src/utils/everest/bloques.mjs`. Cada bloque
  guarda la misma forma que hoy recibe su componente.
- **Solo publica el Administrador Global**, por `proponerCambio` (ámbito
  `everest_designer`): se aplica al momento y queda en Historial.
- **Pestañas:** Portada, Cintas, Medallas, Pines y Paleta (`?seccion=`). La Paleta vivía
  en Administración; `/dashboard/admin/paleta` solo redirige aquí.
- **Pantalla:** `/dashboard/everest`, entrada del menú lateral debajo de
  "Administradores" (no es una pestaña de Administración), solo para el
  Administrador Global. La vista previa es un iframe a `/vista-previa/everest` porque los
  estilos dependen del ancho de la ventana; pinta con los componentes reales de
  `/principal`. Los editores escriben por `cambiarContenido`: borrador autoguardado,
  que no sale en la portada hasta pulsar Publicar.
- **Los editores nunca mutan el contenido de partida** (puede ser el objeto de
  fábrica que pinta la portada): cambian con `conCampo`/`cambiadorDe`
  (`src/sections/everest/editores/cambios.js`), que copian.
- **Campos nuevos, siempre opcionales** (`conOpcionales` en `saneado.mjs`): si no
  vienen, la tarjeta se pinta como siempre; si vienen rotos, el bloque entero vuelve
  a fábrica. Los días que faltan y los eventos pasados se calculan al pintar, en
  hora de Santo Domingo (`src/utils/everest/presentacion.mjs`, lo único del Designer
  que importan las tarjetas además del lector).
- **Todo tiene editor de contenido**; "Mi progreso" y las cifras/nivel de la
  Bienvenida avisan de que son los mismos para todos. El encabezado de la tienda
  se edita en la tienda.
- **Diseño aparte del contenido** (`bloques[id].diseno`): colores hex, tamaños,
  textos fijos, iconos y qué se muestra, declarados en
  `src/utils/everest/diseno.mjs`. **Un diseño vacío no cambia un píxel**: las
  piezas de `src/sections/principal/diseno-de-tarjeta.js` devuelven `{}` o el valor
  de siempre. Contenido y diseño viajan juntos (borrador, versión, campaña).
- **Lápices (fase 6)**: solo el Administrador Global; llevan al bloque en el
  Designer. `useImagenDeTarjeta` ya solo lee: nada publica una foto en el acto.
- **Campañas (fases 7-8)**: `campanas.<id>` en el documento publicado; campaña
  vigente para esa persona (región/destacamento) → publicado → fábrica.
  Analíticas en `everest_analiticas` (solo contadores, sin quién). Aviso en la
  campana solo de comunicados nuevos por clave; si falla, la publicación sigue.
- **Versiones (fase 5)**: publicar y volver al original escriben su versión en
  `everest_versiones` en el mismo lote. Abrir una versión la deja como borrador;
  nunca publica sola. Historial guarda antes y después por campo
  (`src/utils/everest/versiones.mjs`).
- **Reglas antes que código**: publica `firestore.rules` y `storage.rules` antes
  de la fase que las use.
- Plan y avance por fases: `PROJECT_GUIDELINES.md` §4.2. Test que no se borra:
  `tests/everest/portada-congelada.test.mjs`.

## Antes de dar algo por terminado

```bash
npm run lint
npm run build
node --test tests/acceso/*.test.mjs tests/admin/*.test.mjs tests/ascenso/*.test.mjs tests/chat/*.test.mjs tests/directivas/*.test.mjs tests/everest/*.test.mjs tests/member/*.test.mjs tests/tienda/*.test.mjs
```

Regla nueva de negocio → test nuevo. Cambio que contradiga
`PROJECT_GUIDELINES.md` → actualiza el documento en el mismo commit.

## Lo que no se hace

- No derivar contraseñas de datos predecibles (los códigos de miembro son correlativos).
- No renumerar identificadores ya emitidos: rompe enlaces ya enviados.
- No borrar datos sin que alguien lo pida explícitamente.
- No construir sobre los ~20 módulos de plantilla sin conectar (`/dashboard/{app,
ecommerce, analytics, banking, booking, file, course, job, tour, user, post,
mail, kanban}`, `src/_mock/`, `src/sections/_examples/`, `src/sections/prinicipal/`).
- No quitar `serverExternalPackages: ['firebase-admin']` ni bajar
  `AWS_LAMBDA_JS_RUNTIME` de `nodejs22.x`: revienta `/api/auth/*` en Netlify.
- Colección nueva en Firestore → **añádela explícitamente a `firestore.rules`**.
  El comodín del final la haría escribible por cualquier sesión válida.

## Riesgos abiertos

1. El alcance de **escritura** de destacamentos/secciones/regiones se decide en el
   navegador; las rutas `/api` solo exigen sesión.
2. La API .NET devuelve el padrón entero (ver `docs/backend-dotnet-checklist.md`).
3. `firestore.rules` termina en un comodín permisivo.
