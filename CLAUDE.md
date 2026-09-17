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
7. **Coordinador Regional y Sub-Director Regional proponen en las secciones de su región** (ficha y directiva): el titular propone, el asistente sugiere, y lo aprueba la Oficina Nacional. Los otros seis cargos regionales siguen siendo de consulta, y los destacamentos siguen cerrados para los ocho.

8. **Buzones compartidos del chat** (Tienda Virtual 20001, Oficina Nacional 20002): un poder, no una cuenta. Cada uno es una entrada de `src/utils/chat-buzones.mjs`; lo atienden sus cargos (entre todos los de la persona) y el Administrador Global atiende todos. El servidor comprueba el cargo antes de escribir como el buzón; una persona nunca usa esos números. Test: `tests/chat/chat-buzones-compartidos.test.mjs`.

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
- **Fechas: siempre el calendario del proyecto**, nunca `<input type="date">` ni
  `datetime-local`. Con formulario, `Field.DatePicker` / `Field.DateTimePicker`
  (`src/components/hook-form`); sin él, `DatePicker` / `DateTimePicker` de
  `@mui/x-date-pickers` con `format="DD/MM/YYYY"` (y `ampm` + `hh:mm A` si lleva
  hora). El nativo cambia de aspecto y de orden de campos en cada sistema, y
  dejaba dos formas distintas de escribir una fecha en la misma pantalla. El
  `LocalizationProvider` ya está puesto en `src/app/layout.jsx`.
- Código de servidor probable → `.mjs`, para importarlo desde `node --test`.
- Tests en español, nombrados por el comportamiento, con encabezado que explica
  qué se rompía. Importan el **código real** vía `tests/soporte/resolver-alias-src.mjs`.

## EVEREST Designer — la portada no cambia hasta que se publica

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
