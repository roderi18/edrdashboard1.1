# PROJECT_GUIDELINES.md — ERD Dashboard de Exploradores

> Documentación de referencia del proyecto. **Todo lo que sigue sale de leer este
> repositorio.** Cada elemento va marcado con su estado real:
>
> | Marca                        | Significado                                                      |
> | ---------------------------- | ---------------------------------------------------------------- |
> | ✅ **Implementado**          | Existe, está conectado y se usa.                                 |
> | 🟡 **Parcial**               | Existe pero le falta una pieza para estar completo.              |
> | ⛔ **Pendiente / plantilla** | No está hecho, o es código de la plantilla que nunca se conectó. |
> | ❓ **Suposición**            | Deducido del código; **hay que confirmarlo con el equipo**.      |
>
> Si añades una funcionalidad, **actualiza este archivo en el mismo commit**.

---

## 1. Identidad de la aplicación

| Dato               | Valor                                      | Fuente                                                   |
| ------------------ | ------------------------------------------ | -------------------------------------------------------- |
| Nombre visible     | **Exploradores del Rey**                   | `src/global-config.js` → `CONFIG.appName`                |
| Nombre del paquete | `@minimal-kit/next-js` v7.6.1              | `package.json`                                           |
| Origen             | Plantilla **Minimal UI Kit** (Next.js)     | `README.md`, `src/_mock/`, `src/sections/_examples/`     |
| Organización       | Exploradores del Rey, República Dominicana | `docs/ESTATUTOS Y REGLAMENTOS ERRD.pdf`, textos de la UI |
| Proyecto Firebase  | `systexploradores`                         | `docs/backend-dotnet-checklist.md`                       |

⚠️ **El `name` del `package.json` sigue siendo el de la plantilla.** No es el nombre
del producto. El nombre real de la aplicación es `CONFIG.appName`.

### Objetivo principal

Llevar el **padrón y la operación diaria** de una organización juvenil cristiana
estructurada en cuatro niveles jerárquicos —Nación → Región → Sección →
Destacamento— y sus miembros, con una regla transversal: **cada persona ve y toca
solo lo que su cargo alcanza.**

### Problemas que resuelve (verificados en el código)

1. **Padrón disperso.** Centraliza miembros, destacamentos, secciones, regiones e
   iglesias, hoy repartidos entre una API .NET heredada y Firestore.
2. **Quién puede qué.** Un catálogo de ~40 cargos con permisos y alcance, aplicado
   en pantalla, en las rutas `/api` y en las reglas de Firestore.
3. **Cambios que necesitan aprobación.** Los cargos locales _proponen_; la Oficina
   Nacional _aprueba_ (`solicitudes_cambio`).
4. **Asistencia sin señal.** Firestore con caché local persistente, pensado para
   campamentos (`src/lib/firebase.js`).
5. **Datos sensibles de menores.** Dispensa médica y datos personales con
   enmascarado y autorización explícita.
6. **Documentación oficial.** Certificados, sistema de ascenso y documentos
   ministeriales.
7. **Tienda interna.** Catálogo de insignias con precios diferenciados para
   destacamentos registrados y no registrados.

---

## 2. Arquitectura

```
Navegador (Next.js App Router, React 19, MUI 7)
   │
   ├─► Firebase SDK (cliente) ──────────► Firestore / Auth / Storage
   │                                        (reglas en firestore.rules)
   │
   └─► /api/* (Route Handlers de Next) ──► API .NET  systexploradores.somee.com
                                            (caché + timeout en upstream-cache)
```

**No hay backend Node propio.** ✅ Lo que existe son _route handlers_ de Next.js
bajo `src/app/api/**`, que hacen tres cosas: comprobar la sesión, hacer de proxy y
caché de la API .NET, y ejecutar lo que necesita privilegios (`firebase-admin`).

❓ **Suposición**: la API .NET es un sistema heredado mantenido por otro equipo.
`docs/backend-dotnet-checklist.md` es un encargo escrito _hacia_ ese equipo.

### Las dos fuentes de datos

Esta es **la decisión arquitectónica más importante del proyecto** y hay que
tenerla presente antes de tocar nada.

| Fuente                                      | Qué guarda                                                                                                                                             | Cómo se accede                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| **API .NET** (`systexploradores.somee.com`) | El padrón heredado: `Miembros`, `Destacamentos`, `Secciones`, `Regiones`, `Iglesias`, `Divisiones`, `Paises`, `Cargos`, `CargosMiembros`, `Tutores`    | Siempre a través de `/api/*`, nunca desde el navegador |
| **Firestore**                               | Todo lo que la aplicación añadió: notificaciones, chat, muro, salud, ascenso, asistencia, tienda, directivas, roles, auditoría, archivos, certificados | Firebase SDK desde el cliente, con `firestore.rules`   |

**Consecuencia práctica**: un miembro existe en los dos sitios. Su ficha básica
(nombre, teléfono, destacamento) vive en la API .NET; su salud, sus premios, su
asistencia y sus cargos viven en Firestore, enlazados por `idMiembros`.

### El upstream es lento — y el código lo asume

`src/utils/upstream-cache.js` ✅ documenta que la API .NET **varía de 0,3 s a más
de 17 s** porque su plan gratuito serializa la concurrencia. Por eso:

- Caché en memoria por proceso, TTL 60 s, con _stale_ servible hasta 10 min.
- Deduplicación de peticiones en vuelo y refresco en segundo plano.
- Timeout: **9 s en producción** (las funciones de Netlify se cortan a los 10) y
  **25 s en desarrollo**.
- `Promise.allSettled` donde una petición secundaria no debe tumbar la principal
  (ver `src/app/api/sectional/route.js`).

**Regla**: no añadas una llamada al upstream fuera de `fetchUpstreamText` sin una
razón escrita.

---

## 3. Usuarios, roles y permisos

### Los tres tipos de sesión ✅

| Tipo                                                                         | Cómo entra                      | Dónde vive su perfil         |
| ---------------------------------------------------------------------------- | ------------------------------- | ---------------------------- |
| **Miembro**                                                                  | Código `EDR-NNNNN` + contraseña | `usuarios_roles`             |
| **Administrador**                                                            | Correo + contraseña             | `admins`                     |
| **Sesión de administrador con cargo** (`usuario_seccion`, `usuario_region`…) | Correo                          | `usuarios_roles` con `rolId` |

⚠️ **`usuario_seccion` / `usuario_region` son sesiones de administrador con
`rolId`.** El gating se hace por **códigos de rol**, no por `user.permisos`.

### Cómo inicia sesión un miembro ✅

El código de miembro se convierte en un correo sintético:
`EDR-10002` → `edr-10002@exploradores.app` (`src/utils/member-auth-credentials.js`).

⚠️ **Nunca vuelvas a derivar la contraseña del código.** El propio archivo lo
documenta: los códigos son correlativos, así que la clave era deducible. Hoy la
cuenta se crea con contraseña aleatoria en el servidor
(`/api/auth/crear-cuenta-miembro`) y el primer acceso va por **código de un solo
uso** que dicta el coordinador.

### Catálogo de cargos ✅ — `src/auth/permissions/roles.js`

Cinco niveles de alcance (`ALCANCES`): `destacamento`, `seccion`, `region`,
`nacional`, `global`. ~40 códigos, entre ellos:

- **Destacamento**: `usuario_destacamento` (Coordinador), `usuario_destacamento_asistente`, `pastor_destacamento`, `consejo_destacamento`, `capellan_destacamento`, `lider_grupo`, `lider_asistente_grupo`
- **Sección**: `usuario_seccion` (+ asistente), coordinadores de adiestramiento / promoción / producción / programa, `capellan_seccional`, `zonas`, `grupos_locales`
- **Región**: `usuario_region` (+ asistente), los mismos cuatro coordinadores, `capellan_regional`, `secretario_regional`
- **Nacional**: `consejo_nacional`, `director_nacional`, `subdirector_nacional`, `capellan_nacional`, `ministerios_infantiles_nacional`, `comites_especiales_nacional`, … agrupados en `ROLES_CONSEJO_EJECUTIVO`
- **Transversales**: `oficina_nacional` (aprueba), `administrador_global` (manda sobre todo), `administrador_funcional`, `administrador_tienda`

### Reglas de alcance que hay que conocer antes de tocar permisos ✅

Están comprobadas por tests y documentadas en el código. **No las cambies sin
leer el test que las cubre.**

1. **Los guardas preguntan por TODOS los cargos**, no por el principal
   (`rolesQueEjerce`, no `rolId`). Quien coordina su destacamento y además ocupa
   una casilla de su sección entra por las dos.
2. **Dominancia por módulo**: con dos cargos, en cada módulo manda el del nivel de
   ese módulo, no el de mayor rango. **Excepción: el Administrador Global reina.**
   Si lo ejerce por cualquier vía, es su rol principal en todos los módulos
   (`src/utils/administrador-global-reina.mjs`).
3. **Ver se suma; editar no.** La visibilidad se acumula entre cargos; la edición
   sigue la dominancia por módulo.
4. **Tres listas, tres alcances**: secciones, destacamentos y miembros se acotan
   por separado. Un cargo de destacamento **ve la estructura de toda su región**
   pero **solo los miembros de su destacamento**.
5. **Oficina Nacional es un rol a mano**: no ocupa casilla de directiva. Un cargo
   de directiva se lo borraba y con él la bandeja de aprobaciones.
   - **Los cuatro cargos de administración** (Global, Funcional, Gestión de Tienda
     y Oficina Nacional) se asignan desde Administradores y **se escriben en la
     cuenta de Firebase con la que la persona entra** (`usuarios_roles/<uid>`),
     aunque la pantalla mande su número de miembro: la ruta localiza sus cuentas
     (`src/server/cuenta-del-objetivo.mjs`) y emite los claims de cada una. Antes
     se guardaba en `usuarios_roles/<número>`, que nadie lee, y la persona entraba
     sin los permisos. **Se suma a sus cargos de la directiva, no los borra.**
     Test: `tests/acceso/cargo-de-administracion-en-la-cuenta-real.test.mjs`.
   - **El Administrador de Gestión de Tienda manda en toda la tienda** —productos,
     órdenes, recibos y carrito— con los mismos botones que el Administrador
     Global, tenga la tienda como cargo principal o no (`hasStoreAdminAccess`
     mira todos sus cargos).
6. **Los roles de solo lectura** (p. ej. Pastor) usan el estado vacío "Sin
   información registrada"; no se les ofrece editar.
7. **El nivel región propone sobre sus secciones, pero solo dos de sus cargos.**
   El **Coordinador Regional** (`usuario_region`) y el **Sub-Director Regional**
   (`usuario_region_asistente`) proponen sobre las secciones de su región: la
   ficha (`canEditSectional`) y su directiva (`canManageSectionLeadership`). El
   titular **propone**; el asistente **sugiere** — la misma distinción que hay
   entre el Coordinador Seccional y su Sub-Coordinador. Los otros seis cargos
   regionales (los cuatro coordinadores, Capellán y Secretario Regional) siguen
   siendo de **consulta**, y los **destacamentos siguen cerrados** para los ocho:
   `REGION_SCOPED_ROLES` sigue vacía a propósito y la puerta nueva vive en
   `REGION_SECTION_PROPOSER_ROLES`, porque esa lista también gobierna
   `canEditDest`. Nada se aplica solo: `seccion` y `directiva_seccion` los aprueba
   la Oficina Nacional. Su alcance es **regional y no trae ids de sección**, así
   que estos dos guardas se comprueban por la **región de la sección** —el
   servicio la resuelve él mismo, no la acepta de la pantalla—.
   Test: `tests/acceso/region-propone-en-sus-secciones.test.mjs`.
8. **Los buzones compartidos del chat son un poder, no una cuenta.** Hay dos:
   **Tienda Virtual** (`idMiembros` **20001**, `EDR-20001`) y **Oficina Nacional**
   (**20002**, `EDR-20002`). Cada buzón es **una entrada** de
   `src/utils/chat-buzones.mjs` —número, identidad de Firebase, cargos que lo
   atienden, colección de respuestas— y de ella salen el token del servidor, la
   bandeja de la pantalla, los avisos y las reglas. Cualquier miembro les escribe.
   - **Quién atiende**: la Tienda, **Administrador de Gestión de Tienda**; la
     Oficina, **Oficina Nacional**. El **Administrador Global atiende todos**. Se
     mira **entre todos los cargos** de la persona: quien tenga asignados Tienda y
     Oficina ve las dos bandejas.
   - El navegador pide el buzón mandando su `idMiembros`, pero **no se concede por
     pedirlo**: el servidor comprueba el cargo para **ese** buzón
     (`src/server/chat-buzones-core.mjs`) y solo entonces escribe con un token a
     nombre de `tienda-virtual` / `oficina-nacional` que únicamente él emite.
     Tener acceso a uno no abre el otro, y el token de un buzón no abre ninguno.
   - **Una persona nunca es un buzón**: el 20001 y el 20002 se rechazan al iniciar
     sesión y en las reglas.
   - **Auditoría de quien contesta**: cada mensaje que sale en nombre de un buzón
     guarda el **nombre, el usuario** (código de miembro o correo) y el uid de la
     persona, aparte del mensaje (`respuestas_tienda`, `respuestas_oficina`) y en
     **Historial** (`auditoria_sistema`, acción `respuesta_buzon_compartido`). En la
     conversación, "respondió Nombre (usuario)" **solo lo ve el Administrador
     Global**; ni el miembro ni el resto de quienes atienden el buzón lo reciben.
   - **Avisos y contador global**: quien atiende un buzón recibe el aviso en la
     campana —tenga sesión de miembro o de administrador; el aviso lleva
     `metadatos.buzon` y no se filtra por rol— y el contador de "Chats" suma lo
     pendiente de sus buzones. La campana escucha sus avisos en vivo
     (`escucharNotificacionesDelUsuario`) y reproduce el sonido al instante. El
     contador global agrupa la identidad personal y todos los buzones autorizados
     en **una sola petición** (`useGetDashboardChatSummary`) cada minuto. Las
     suscripciones de conversaciones y la presencia se abren únicamente dentro
     de `/chat`; mantenerlas en todas las pantallas multiplicaba conexiones de
     Firestore y solicitudes de resumen.
   - **Lo que nadie contesta se reclama solo.** Un buzón lo atienden varios, y un
     mensaje podía quedarse sin respuesta sin que nadie se enterara: el único
     rastro era el contador de la bandeja. **A los 60 minutos** sin responder va
     un aviso de campana (`buzon_sin_responder`) a **quien ejerce el cargo del
     buzón y al Administrador Global** —los mismos de `perfilesDelBuzon`—, y **a
     las 24 horas** va un segundo aviso que **termina en ⚠️**. El reloj empieza en
     el **primer** mensaje sin contestar (`sinResponderDesde` en la conversación),
     no en el último: contando desde el último, quien insiste retrasaría el aviso
     para siempre. Solo **responder** para el reloj; leer no. Como no hay tareas
     programadas, se revisa cuando quien atiende el buzón tiene la aplicación
     abierta y el panel pide su contador (`unread-summary`), como mucho una vez
     cada cinco minutos, y cada aviso se escribe **una sola vez** (identificador
     por conversación, paso y destinatario). La decisión vive en
     `src/server/chat-buzon-sin-responder.mjs`.
   - **Las reglas cuentan todos los cargos, en cualquier posición** (no solo el
     principal) con `rolesQueEjerce`, la lista
     plana que el servidor escribe en `usuarios_roles` junto a `cargos`
     (`src/utils/lista-roles-que-ejerce.mjs`). Una cuenta sin esa lista la recibe
     al volver a sincronizar su rol.
   - **La foto de cada buzón** la cambia **solo el Administrador Global**, y por un
     solo camino: el menú de su cuenta en el chat, debajo de "Perfil". La foto del
     buzón **no se pulsa** —es de quien escribe, no un botón: tocándola saltaba el
     selector de archivos sin querer—. Vive en `buzones_chat/<clave>`, pasa por
     `proponerCambio` (ámbito `buzon_chat`) y el servidor la pone en contactos,
     conversaciones y avisos.
   - **Componentes**: `ChatBandejasAvatares` (las bandejas, en círculos junto a la
     foto de la que está abierta, dentro de la lista de conversaciones; la abierta
     **no se repite** como opción), `ChatAvatarDeBuzon` y `useCambiarFotoDeBuzon`;
     `useBuzonesDelChat` dice qué buzones atiende la sesión y en cuál está
     (`?bandeja=tienda|oficina`).
   - **Para añadir otro buzón**: una entrada en `chat-buzones.mjs`, su número en
     `idMiembroNoUsurpaUnBuzon` y su `atiendeBuzonDe…` en `firestore.rules` y
     `storage.rules`, y su colección de respuestas.
     Tests: `tests/chat/chat-buzones-compartidos.test.mjs`,
     `tests/chat/buzon-sin-responder.test.mjs`,
     `tests/chat/sonido-de-mensaje-recibido.test.mjs` y
     `tests/chat/chat-tienda-virtual.test.mjs`.
9. **Un producto agotado se solicita, no se compra.** Con el inventario en 0 el
   botón principal dice **"Solicitar producto"** y deja una orden en estado
   `solicitada` (`esSolicitud: true`): **no descuenta inventario, no genera
   recibo ni vacía el carrito**, y cancelarla o reactivarla tampoco mueve
   existencias. Avisa a quien **atiende las solicitudes** —Administrador Global,
   Administrador de Gestión de Tienda y Oficina Nacional
   (`atiendeSolicitudesDeTienda`)—, no a todos los administradores. Solo ellos
   ven el apartado **"Solicitados"**, y para ellos la lista se llama **"Órdenes"**
   (con "Estados de los pedidos a Tienda Virtual."): ven las de todo el mundo.
   Test: `tests/tienda/solicitar-producto-agotado.test.mjs`.

### Cargos que ocupan el mismo sitio pueden lo mismo ✅

Comparando cargo por cargo dentro de cada nivel (`ALCANCE_PREDETERMINADO_ROL`)
aparecieron tres grupos que se suponían iguales y no lo eran, siempre por una
lista a la que le faltaba un nombre. Quedaron igualados, y
`tests/acceso/permisos-iguales-en-su-nivel.test.mjs` compara los guardas reales
en lote para que no se vuelvan a separar:

| Grupo                                                                                 | Qué los separaba                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pastor** = Consejo Destacamento = Capellán                                          | El Pastor no estaba en `REGION_WIDE_SECTION_VIEWER_ROLE_IDS`: veía menos estructura que sus dos compañeros de desplegable. Ese listado decide qué se **ve**, no con qué se interactúa — las secciones ajenas salen deshabilitadas para todos.                                            |
| **Capellán Seccional** = **Zonas** = **Grupos Locales** = los 4 coordinadores de área | Arrastraban `soloLectura: true`, que no añadía nada (su catálogo no concede ninguna edición) pero les pintaba etiqueta aparte y mandaba el claim al .NET; les faltaba la Academia Ministerial; y sus menores no salían marcados en la lista por no estar en `MINOR_RESTRICTED_ROLE_IDS`. |

**Regla que queda**: si dos cargos comparten nivel y perfil, no se los separa con
una lista suelta. O se documenta por qué difieren, o se igualan.

### El Consejo Ejecutivo ve el expediente médico entero ✅

Los once cargos del Consejo Ejecutivo —los diez del organigrama nacional
(`ROLES_CONSEJO_EJECUTIVO`) y el rol `consejo_ejecutivo`— llevaban `salud.ver`,
pero la Dispensa les llegaba **bloqueada**, igual que a un cargo de sección o
región: secciones sin desplegar y campos deshabilitados hasta que un Coordinador
de Destacamento les concediera acceso temporal. Tener el permiso no les enseñaba
nada.

Ahora ven el expediente **completo** —seguro, medicación, alergias, condiciones y
documentos, **menores incluidos**— en todo el alcance donde ya ven miembros, que
para estos cargos es el país. Es una decisión de gobierno tomada a propósito:
🟡 **son los datos médicos de cualquier miembro de la organización, sin
autorización previa de nadie**. El guarda es
`veElExpedienteMedicoCompleto` (`member-access.js`).

**Leer, no tocar**: no se les dio ninguna escritura. `canEditHealth`,
`canUploadHealthDocuments` y `canDeleteHealthDocuments` los siguen dejando fuera
por `isSupervisoryMemberViewer`; editar sale del cargo de destacamento
(Coordinador o Coordinador Asistente), no del nacional. Al rol `consejo_ejecutivo`
se le añadieron además `salud.ver` y `ascenso.ver`, que eran las dos pestañas que
le faltaban para ver la ficha entera de su gente **sin importar qué cargo de
destacamento ocupe** (la visibilidad se suma entre cargos, regla 3).

### Dónde se aplican los permisos ✅ — tres capas

| Capa         | Archivo                                                                                      | Qué hace                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Pantalla     | `src/utils/member-access.js`, `src/utils/org-level-access.js`, `src/auth/permissions/can.js` | Oculta o deshabilita                                                                                                   |
| Rutas `/api` | `src/server/sesion-rest.mjs`                                                                 | `exigirSesionRest`, `exigirPermisoDeCargoRest`, `exigirAdministradorGlobalRest`, `exigirCoordinadorDeDestacamentoRest` |
| Firestore    | `firestore.rules`                                                                            | `esUsuarioDelSistema()`, `tienePermisoDeCargo()`, `destacamentosDeSuAlcance()`                                         |

🟡 **Hueco conocido y documentado**: el alcance de escritura sobre
destacamentos/secciones/regiones **se decide en el navegador**. Las rutas
`/api/dest/post` y `/api/dest/put` solo exigen sesión — su propio comentario lo
dice. `docs/backend-dotnet-checklist.md` describe lo que falta en el lado .NET
para que `GetAllMiembros` deje de devolver el padrón entero.

### Simulador de permisos ✅

`src/utils/simulador-permisos.js` ejecuta las reglas **reales** contra fichas de
prueba y las pinta en `/dashboard/admin/permissions`. Al añadir una capacidad,
añádela también ahí: es la única forma de que alguien no técnico vea el efecto de
combinar dos cargos.

---

## 4. Módulos

### 4.1 Implementados ✅

| Módulo                          | Ruta                                                    | Notas                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Principal (muro)**            | `/dashboard/principal`                                  | Renderiza `UserProfileView` (`src/sections/user/view`) con `useSessionProfile`. Publicaciones, comentarios, reacciones, reportes, compartidos, ocultar, amistades y seguidores. Firestore.                                                                                                     |
| **Niveles organizacionales**    | `/dashboard/level/{national,regional,sectional,dest}`   | CRUD + organigrama de directiva por nivel.                                                                                                                                                                                                                                                     |
| **Miembros**                    | `/dashboard/level/member`                               | Lista (tabla y tarjetas), ficha, creación, carga masiva por Excel, PDF, solicitudes de cambio.                                                                                                                                                                                                 |
| **Miembros de un destacamento** | `/dashboard/level/dest/[id]/edit/members`               | Pestaña que reutiliza la misma vista de miembros.                                                                                                                                                                                                                                              |
| **Directivas**                  | `.../edit/leadership`, `.../edit/youth-leadership`      | Organigrama, asignaciones, diseños. El diseño de **Líderes Juveniles es uno solo para todos los destacamentos** (`destacamento-juvenil_global`); sin él se lee el de Tribu de Judá 18 (`231`), el modelo. Test: `tests/directivas/diseno-juvenil-global.test.mjs`.                             |
| **Asistencia**                  | `/dashboard/level/attendance`                           | Pase de lista diario, resumen, informe avanzado, exportación. El calendario permite crear actividades con nombre y rango, consultar su nombre al señalar o tocar sus días y eliminarlas con confirmación. Offline-capable. El Administrador Global que prueba un rol combinado ve el selector de destacamentos y su elección queda en `preferencias_usuarios/<uid>`. **"Otro" abre un menú: "De licencia" pide los días y, mientras dure, el miembro sale "Otro · De licencia" en vez de ausente** (`licenciasAsistencia`). **Al guardar el pase de lista y al abrir el destacamento se recalcula el estatus de cada miembro** (`docs/estatus-miembro.md`): los fallecidos no salen a pasar lista y los inactivos quedan al final, recogidos. |
| **Dispensa médica**             | `/dashboard/level/member/[id]/edit/health`              | Info básica, medicamentos, alergias, condiciones, documentos, solicitudes de acceso.                                                                                                                                                                                                           |
| **Sistema de ascenso**          | `.../edit/awards`                                       | Catálogo de 490 premios transcrito del inventario oficial.                                                                                                                                                                                                                                     |
| **Padres / tutores**            | `.../edit/parents`                                      | Con notas y autoguardado.                                                                                                                                                                                                                                                                      |
| **Historial del miembro**       | `.../edit/history`                                      |                                                                                                                                                                                                                                                                                                |
| **Chat**                        | `/dashboard/chat`                                       | Conversaciones, grupos, reacciones, presencia, recibos de lectura, adjuntos. Buzones compartidos **Tienda Virtual** (`?bandeja=tienda`) y **Oficina Nacional** (`?bandeja=oficina`), según los cargos de cada quien; el Administrador Global ve los dos y cambia su foto. 27 ficheros de test. |
| **Notificaciones**              | Campana + `/dashboard/admin/notifications`              | Tipos, plantillas, preferencias y tareas en Firestore. Cada cuenta enciende o apaga sus avisos en **Cuenta → Notificaciones** (`src/sections/account/account-notifications.jsx`), agrupados por módulo (`src/utils/modulos-notificaciones.mjs`); se guarda en `preferencias_notificaciones/{uid}`, lo mismo que se consulta al repartir.                                                                                                                                                                                                                                         |
| **Tienda**                      | `/dashboard/product`, `/checkout`, `/order`, `/invoice` | Productos, inventario, reseñas, carrito, órdenes, recibos.                                                                                                                                                                                                                                     |
| **Certificados**                | `/dashboard/certificates`                               | Plantillas y generación.                                                                                                                                                                                                                                                                       |
| **Documentos ministeriales**    | `/dashboard/file-manager`                               | Firestore + Storage.                                                                                                                                                                                                                                                                           |
| **Calendario**                  | `/dashboard/calendar`                                   | Firestore.                                                                                                                                                                                                                                                                                     |
| **Administración**              | `/dashboard/admin/*`                                    | Administradores, logs, aprobaciones, permisos, roles, combinaciones, mantenimiento, salud del sistema.                                                                                                                                                                                         |
| **Cintas del perfil**           | Perfil y ficha del miembro                              | Las cintas del uniforme (40 imágenes de `public/parches/Cintas y medallas/cintas-perfil`) en el orden oficial del manual: 3 por fila, hasta 18, la fila incompleta arriba, y el número dorado encima cuando el premio se ganó más de una vez. Firestore `cintas_miembros`. Detalle: `docs/cintas-perfil.md`. |
| **Estatus del miembro**         | Perfil, ficha y `/dashboard/level/attendance`           | Cuatro estatus (activo, reclutamiento, inactivo, fallecido) que **mueve la asistencia sola**. Avisos por cargo, cambio a mano con motivo y `Fallecido` restringido. Firestore `estatus_miembros`. Detalle: `docs/estatus-miembro.md`. |
| **Cuenta propia**               | `/dashboard/user/account`                               |                                                                                                                                                                                                                                                                                                |

### 4.2 Parcialmente implementados 🟡

| Elemento                                           | Qué falta                                                                                                                                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Crear recibo a mano** (`/dashboard/invoice/new`) | El formulario **no guarda nada**: `handleSaveAsDraft` y `handleCreateAndSend` solo hacen `console.info`. Arranca con `INV-1990` y direcciones de `_addressBooks`. O se conecta o se quita del menú. |
| **Alcance en el servidor**                         | Ver §3. El bloqueo vive en el navegador.                                                                                                                                                            |
| **`contadores_comercio`**                          | Cae bajo el comodín de `firestore.rules`: escribible por cualquier sesión válida. El contador de órdenes debería tener su propio bloque.                                                            |
| **Numeración de órdenes**                          | Conviven tres formatos: `ORD-26-0001` (nuevo), `REC-26-0001` (transitorio) y `ORD-1777776824429` (antiguo). El chat reconoce los tres.                                                              |
| **Buscar por número de recibo**                    | La búsqueda de `/order` consulta `numeroOrden`; pegar el número del recibo no encuentra la orden.                                                                                                   |
| **Directiva Nacional por cuatrienio** | Hecho: pestaña "Por cuatrienio" en `/level/national`, organigramas históricos, edición (Administrador Global y Oficina Nacional), Director Nacional permanente y ex comandantes en el Consejo Ejecutivo. Falta correr la carga del listado 2022-2026 (la lanza el Administrador Global) y trasladar a su destacamento a quienes queden en "Provisional". Ver `docs/directiva-por-cuatrienio.md`. |
| **EXPLORA Designer** | Fases 0 a 8 hechas: lector de la portada, pantalla con vista previa, editores de contenido y de diseño (colores, tamaños, textos, iconos, qué se muestra), versiones, lápices, campañas con audiencia, analíticas, biblioteca de medios y aviso de comunicados. Ver abajo. |

#### EXPLORA Designer ✅ — editar la portada desde la aplicación

Entrada propia del menú lateral (grupo Administración, debajo de "Administradores") para cambiar todo lo de
`/principal` —encabezados, próxima actividad, historias, eventos, comunicados,
destacamento destacado, lema— **sin tocar código** al preparar un evento.

**La regla que manda sobre todo lo demás:** `/principal` se ve exactamente igual
—textos, orden, imágenes y videos— **hasta que alguien publica ese bloque desde el
Designer**. Se cumple por construcción, no por cuidado:

1. **El valor de fábrica es el código.** Lo que sale de
   `src/sections/principal/datos-de-ejemplo.js` y el lema (`LEMA_DE_FABRICA`) no
   se copia ni se siembra en Firestore: es el respaldo de cada bloque sin
   publicar. El mapa bloque → valor está en
   `src/sections/principal/fabrica-de-portada.js`, y apunta a los **mismos
   objetos** que usaba la pantalla.
2. **Se publica por bloque.** Publicar "Comunicados" no toca "Próxima actividad".
3. **Una publicación rota no deja un hueco**: si el bloque no pasa el saneado, se
   pinta el de fábrica (`resolverPortada`).
4. **Las fotos y videos de hoy no se mueven**: siguen en `fotos` →
   `principalTarjeta/{bienvenida,proxima-actividad}` y en `principal-tarjetas/` de
   Storage, que no admite borrado. Lo que se suba desde el Designer va a
   `everest/`.
5. `tests/everest/portada-congelada.test.mjs` lo vigila y **no se borra**. En la
   fase 2 su comprobación de "la vista importa cada dato a mano" se sustituyó por
   la cadena entera: la vista pinta lo que da el lector, el lector sin publicación
   da lo de fábrica, y lo de fábrica es el mismo objeto de siempre.

**Cómo lee la portada (fase 2):** `principal-home-view.jsx` ya no importa datos;
pide cada bloque a `useContenidoDePortada()` y pasa `portada[id].contenido` a su
componente.

- **Arranca con lo de fábrica**, igual en el servidor y en el navegador (si
  arrancara con la copia local, el primer pintado no casaría).
- **Una sola lectura por visita** (`obtenerPublicado`), no una escucha en vivo.
- **Copia en el navegador** (`erd-everest-portada-publicada`), aplicada antes de
  pintar, para que lo publicado no parpadee con lo viejo. Pasa por el mismo
  saneado; sin publicación no se guarda nada.
- **"No se pudo leer" no es "no hay nada"**: con la red caída o las reglas sin
  publicar, se queda lo que ya se pintaba y no se borra la copia buena.
- **Los medios siguen por el camino de siempre** (`useImagenDeTarjeta`). Un bloque
  publicado todavía no lleva foto ni video propios: eso llega con los editores
  (fase 4).
- La marca "Ejemplo" nunca se pone sobre un bloque publicado.
- `PrincipalLema` recibe el lema por props: el salto de línea del título es un
  `\n` que se pinta como el `<br />` de antes.

**La pantalla (fase 3):** `/dashboard/everest`, **entrada propia del menú
lateral**, en el grupo Administración, justo debajo de "Administradores". Nació
como pestaña de Administración y se sacó a petición: colgando de
`/dashboard/admin` heredaba sus pestañas y su encabezado, y allí entran también la
Oficina Nacional y el Administrador Funcional. La entrada la añade
`conEverestDesigner` (`nav-config-dashboard.jsx`) **después** del filtro del menú y
**solo para el Administrador Global**, como la tienda de administración; la vista
lo vuelve a comprobar por si alguien escribe la dirección a mano.

- **Izquierda:** los bloques por grupo, cada uno con su estado: _Original_,
  _Publicado_, _Borrador sin publicar_ o _Editor propio_ (el encabezado de la
  tienda).
- **Centro:** la vista previa, en **Celular (375 px)** o **Escritorio (1280 px,
  reducido a escala)**. Va en un **iframe** a `/vista-previa/everest`, fuera de
  `/dashboard` (sin menú ni cabecera), porque los estilos de la portada dependen
  del ancho de la _ventana_: encoger un recuadro seguiría enseñando el diseño de
  escritorio. El Designer le manda el contenido por `postMessage` en cuanto cambia;
  los dos lados comprueban el `origin` y quién manda el mensaje
  (`mensajes-vista-previa.mjs`). Pinta con **los mismos componentes** de
  `/principal` y con su ancho de columna real (`bloque-de-la-portada.jsx`).
- **Derecha:** el bloque abierto: qué hay en vivo (y quién lo publicó), el
  borrador, el hueco del editor (fase 4) y las acciones. **Publicar** solo con un
  borrador válido; al publicar, el borrador se tira. **Descartar borrador** no
  pregunta: solo tira lo que nadie vio. **Volver al original** pide confirmación
  porque cambia la portada de todos.
- **Borradores:** `cambiarContenido(idBloque, contenido)` es la entrada de los
  editores. Lo escrito se ve al momento en la vista previa y se guarda solo como
  borrador 1,5 s después de dejar de escribir (`everest-borradores-service.js`). Un
  borrador a medias se marca, pero la vista previa sigue enseñando lo que está en
  vivo hasta que sea válido. Los borradores **no** pasan por Historial (no los ve
  nadie más; cada autoguardado sería ruido): lo que queda es la publicación.
- **`?bloque=`** abre ese bloque; **`?volver=`** pone un botón "Volver" (solo
  rutas de la propia aplicación: `destinoDeVuelta`). Es lo que usarán los lápices
  de la fase 6.

**Los editores (fase 4):** cada bloque con editor tiene su formulario en el panel
derecho (`src/sections/everest/editores/`), armado con piezas comunes
(`campos.jsx`) que ya traen las reglas del proyecto: colores con nombre, iconos
registrados, fechas con el calendario de la casa, destinos válidos y avisos de
error en el propio campo. Los editores **nunca tocan el contenido de partida**
(puede ser el valor de fábrica, el mismo objeto que pinta la portada): cambian una
copia (`cambios.js`).

Campos nuevos, todos **opcionales** —el valor de fábrica no los trae y se sigue
pintando igual—:

- **Próxima actividad:** `fechaInicio`/`fechaFin` (con inicio, el texto de las
  fechas y los días que faltan **se calculan al pintar**, en hora de la República
  Dominicana, y ya no se escriben), `fondo` (imagen o video) y `boton` (texto y
  destino; sin él, el de siempre).
- **Bienvenida:** `fondo` (solo imagen). Las cifras y el nivel **se editan** con un
  aviso a la vista: parecen de cada persona pero son los mismos para todos hasta que
  salgan de datos reales. Lo mismo para **Mi progreso**, que tiene su editor.
- **Próximos eventos:** `fecha` por evento; con ella, el evento **se deja de
  enseñar solo** cuando ya pasó (`eventosVigentes`).
- Cálculos en `src/utils/everest/presentacion.mjs`: puro, sin lecturas ni
  escrituras, y lo único del Designer —aparte del lector— que importan las
  tarjetas.
- **Fondos:** se suben a `everest/<bloque>/<marca de tiempo>` (`.webp` o
  `-video.mp4|webm`) con `everest-medios-service.js`; nunca a
  `principal-tarjetas/`. Subir no publica: deja la dirección en el borrador.
- Un fondo publicado desde el Designer **manda sobre** la foto o el video que ya
  estaban puestos; sin él, se siguen leyendo de donde siempre.

**Las versiones (fase 5):**

- Cada **publicación** y cada **"volver al original"** deja una versión en
  `everest_versiones` (`pantalla`, `idBloque`, `clave`, `accion`, `contenido`,
  `creadoEn`, `creadoPor`), escrita **en el mismo lote** que el cambio
  (`everest-apply.js`): o quedan las dos o ninguna. Una versión no se reescribe ni
  se borra (reglas).
- Las del bloque abierto salen debajo del panel. Se buscan por **una sola
  igualdad** (`clave` = `principal/<bloque>`) y se ordenan en el navegador: ordenar
  en la consulta pediría un índice compuesto creado a mano.
- **Abrir una versión no la publica**: la deja como borrador (pide confirmación si
  ya había uno), se ve en la vista previa y se publica con el botón de siempre. Una
  versión que ya no pasa el saneado de hoy no se puede abrir. Volver al diseño del
  código sigue siendo "Volver al original".
- **Historial con antes y después, campo a campo** (`diferenciasDelBloque`): solo
  los campos que cambiaron, resumidos en texto corto. Un bloque que es una lista se
  compara entero ("3 elementos: …"). La ruta de la entidad es `/dashboard/everest`.
- Lo publicado **antes** de la fase 5 no tiene versión: la primera aparece en la
  siguiente publicación de ese bloque.
- Lógica pura en `src/utils/everest/versiones.mjs`; test
  `tests/everest/versiones.test.mjs`.

**El diseño: colores, tamaños, textos fijos, iconos y qué se muestra.** Como en el
encabezado de la tienda, todo lo que antes estaba escrito en el componente se
cambia desde el Designer, en la pestaña **Diseño** del panel.

- **Va aparte del contenido** (`bloques[id].diseno`, junto a `contenido`), porque
  varios bloques son una lista y a una lista no se le cuelgan campos. Borradores,
  versiones, campañas y vista previa llevan siempre **la pareja entera**.
- **Un solo registro de ajustes:** `src/utils/everest/diseno.mjs`
  (`AJUSTES_DE_DISENO`). Cada ajuste tiene tipo (`texto`, `color`, `tamano`,
  `icono`, `destino`, `interruptor`, `opcion`), grupo y límites. El editor
  (`editores/editor-de-diseno.jsx`) se arma solo con esa lista.
- **Un diseño vacío se pinta exactamente como hoy.** Las piezas de
  `src/sections/principal/diseno-de-tarjeta.js` devuelven un objeto vacío —o el
  valor de siempre— cuando el ajuste no está. Sin publicar, ninguna tarjeta cambia.
- **Colores en hexadecimal** (`#rrggbb` o `#rrggbbaa`), elegidos con la paleta del
  encabezado de la tienda (`PaletaDeColores`): el diseño lo ve gente en modo claro
  y oscuro, y tiene que significar lo mismo en los dos. Es la excepción documentada
  a "colores con nombre", que sigue valiendo para el código. Cualquier otra cadena
  (`url(...)`, `red; …`) invalida el diseño.
- **Un diseño roto tumba el bloque a lo de fábrica**, igual que un contenido roto.
  Un ajuste que el bloque ya no tiene se ignora.
- Con color de fondo elegido, el velo de la foto de la bienvenida y de la próxima
  actividad toma ese color (`navyDelDiseno`).
- Historial guarda el antes y el después de cada ajuste como `diseno_<ajuste>`.

**Los lápices (fase 6):** cada tarjeta de `/principal` —y los accesos rápidos—
lleva, **solo para el Administrador Global**, un lápiz que abre ese bloque en el
Designer con "Volver" a la portada (`lapiz-del-designer.jsx`). **Sustituye al lápiz
de imagen**, que subía la foto y la cambiaba para todos en el acto, sin vista
previa ni Historial; `useImagenDeTarjeta` ahora solo lee. Cada tarjeta lleva
también `data-everest-bloque="<id>"`, un atributo que no se ve y que usan las
analíticas.

**Campañas y audiencia (fases 7 y 8):** una campaña pone un bloque distinto **solo
entre dos fechas** (las dos incluidas, en hora de la República Dominicana) y, si
se quiere, **solo para unas regiones o unos destacamentos**.

- Orden de lo que se pinta: **campaña vigente para esa persona → lo publicado → lo
  de fábrica**. Con dos a la vez gana la que empezó más tarde.
- Se guardan en el mismo documento publicado (`campanas.<id>`): la portada sigue
  haciendo **una lectura por visita**. Programar y quitar pasan por
  `proponerCambio` y quedan en Historial.
- Toman el borrador válido o, sin borrador, lo que está en vivo; no descartan el
  borrador.
- La audiencia compara con `idRegion`/`idDestacamento` de la sesión
  (`alcanceDeLaSesion`). **Sin saber dónde está alguien, una campaña acotada no le
  llega**: ve lo publicado para todos.
- El lector guarda **lo leído** y resuelve con el día y la sesión; sin nada leído
  no se miran campañas, así que el primer pintado sigue siendo idéntico en
  servidor y navegador.
- Lógica pura: `src/utils/everest/campanas.mjs`.

**Analíticas, biblioteca y avisos (fase 8):**

- **Analíticas:** `everest_analiticas/{pantalla}` con `bloques.<id>` y
  `campanas.<id>` → `{ impresiones, clics }`. Una impresión cuando media tarjeta
  entra en pantalla, **una vez por sesión del navegador**; un clic en un enlace o
  botón dentro de la tarjeta. Una escritura por visita, con `increment`. **No se
  guarda quién**. El Administrador Global no cuenta. Las reglas solo dejan tocar
  esos dos mapas; las lee el Administrador Global. En la lista de ESLint con su
  motivo.
- **Biblioteca de medios:** "Biblioteca" en el campo de fondo lista lo ya subido a
  `everest/<bloque>/` (Storage, sin registro aparte) para reutilizarlo. Elegir no
  publica.
- **Aviso de comunicados:** al publicar el bloque (o programar una campaña de
  comunicados) se avisa en la campana, si se deja marcado, **solo de los
  comunicados nuevos** por su clave —reordenar o corregir no avisa—. Tipo
  `comunicado_publicado`, para toda la organización o para la audiencia de la
  campaña. Si el aviso falla, la publicación sigue hecha.

**Piezas (fases 1, 2 y 3):**

| Pieza                                                | Qué hace                                                                                                                                                                                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/everest/bloques.mjs`                      | **Único registro de bloques**: id, nombre, grupo, pantalla, medio de tarjeta y saneado. Cada bloque guarda la **misma forma que hoy recibe su componente**; los campos más ricos (fechas reales, botones, audiencia) se añaden con su editor |
| `src/utils/everest/saneado.mjs`                      | Piezas de limpieza: colores solo con nombre (acentos de marca o colores de estado, nunca hex), iconos solo del paquete registrado, destinos solo rutas de la app o `https`. Un elemento roto invalida la lista entera                        |
| `src/utils/everest/portada.mjs`                      | `resolverPortada` (qué se pinta en cada bloque) y `prepararPublicacion` (limpia y firma lo que se publica)                                                                                                                                   |
| `src/utils/everest/colecciones.mjs`                  | Nombres de colecciones, pantallas y carpeta de medios                                                                                                                                                                                        |
| `src/services/everest-service.js`                    | `obtenerPublicado`, `publicarBloque`, `volverBloqueAlOriginal`. Solo el Administrador Global; por `proponerCambio` con el ámbito `everest_designer` (se aplica al momento y queda en Historial)                                              |
| `src/services/everest-apply.js`                      | La escritura que ejecuta la puerta. Está en la lista de excepciones de ESLint con su motivo                                                                                                                                                  |
| `src/sections/principal/fabrica-de-portada.js`       | `FABRICA_DE_PORTADA` (bloque → valor de fábrica) y `LEMA_DE_FABRICA`                                                                                                                                                                         |
| `src/sections/principal/use-contenido-de-portada.js` | El lector de la portada. Es el **único** sitio de `src/sections/principal/` que importa del Designer, y solo lee                                                                                                                             |
| `src/sections/principal/identidad-de-la-sesion.js`   | Nombre, destacamento, región y foto de la sesión para la bienvenida. Lo usan la portada y la vista previa                                                                                                                                    |
| `src/utils/everest/estado-del-bloque.mjs`            | Estado de cada bloque (original, publicado, borrador, externo), qué enseña la vista previa y `destinoDeVuelta`                                                                                                                               |
| `src/utils/everest/mensajes-vista-previa.mjs`        | Los tres mensajes entre el Designer y su iframe, y cómo se validan                                                                                                                                                                           |
| `src/services/everest-borradores-service.js`         | Leer, guardar y descartar borradores. Solo el Administrador Global; en la lista de excepciones de ESLint con su motivo                                                                                                                       |
| `src/sections/everest/`                              | La pantalla: `view/everest-designer-view.jsx`, `view/everest-vista-previa-view.jsx`, `hooks/use-everest-designer.js`, la lista, la vista previa, el panel y `bloque-de-la-portada.jsx`                                                       |

Bloques registrados: `bienvenida`, `encabezado-tienda` (externo: se aloja con su
almacén propio, `configuracion_tienda/encabezado`), `accesos-rapidos`,
`proxima-actividad`, `mi-progreso`, `historias`, `proximos-eventos`,
`destacamento-destacado`, `comunicados`, `lema`.

**Fases:**

| Fase | Qué                                                                                                                                                                   | Cambia /principal                           | Estado                                 |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------- |
| 0    | Red de seguridad: test que congela valores, lema, medios y quién pinta cada bloque. Capturas de referencia en celular y escritorio (las toma quien tenga sesión)      | No                                          | ✅ test · ❓ capturas                  |
| 1    | Registro, saneado, lector puro, servicio, ámbito de Historial, reglas de Firestore y Storage                                                                          | No                                          | ✅                                     |
| 2    | `/principal` lee `everest_publicado/principal` con respaldo al código; copia en el navegador para no parpadear; el lema sale del componente                           | No, sin publicación                         | ✅ · ❓ comparar con las capturas      |
| 3    | Pestaña y esqueleto: lista de bloques con su estado, vista previa con los componentes reales (celular/escritorio), autoguardado de borradores, `?bloque=` y `volver=` | No                                          | ✅ (sin editores: llegan en la fase 4) |
| 4    | Editores de contenido de los 9 bloques (mi progreso y las cifras de la bienvenida con aviso), con fechas reales, fondo propio y botón. Editor de **diseño** de todos: colores, tamaños, textos fijos, iconos y qué se muestra | Solo al publicar | ✅ |
| 5    | Versiones (`everest_versiones`), volver a cualquiera, Historial con antes y después                                                                                   | Solo al publicar                            | ✅                                     |
| 6    | Lápices en cada tarjeta y encabezado que llevan al Designer (solo Administrador Global). Sustituyen al lápiz de imagen que hoy publica en el acto                     | Solo el lápiz, para el Administrador Global | ✅                                     |
| 7    | Campañas con vigencia: campaña vigente → publicado → código                                                                                                           | Solo al publicar                            | ✅                                     |
| 8    | Audiencia por alcance, analíticas, biblioteca de medios, aviso en campana al publicar un comunicado                                                                   | Solo al publicar                            | ✅                                     |

**Decisiones tomadas** (las recomendadas al aprobar el plan): se publica por
bloque; en la primera versión solo edita el Administrador Global; publicar se
aplica directo y queda en Historial. Todo lo de `/principal` es editable (contenido
y diseño); "Mi progreso" y las cifras de la bienvenida se editan a mano con aviso
mientras no salgan del Sistema de Ascenso. El encabezado de la tienda se sigue
editando en la propia tienda. Los lápices están activos para el Administrador
Global. **Pendiente:** conectar "Mi progreso" y las cifras a los datos reales de
cada miembro (y entonces quitar sus editores).

**Reglas publicadas:** hay que desplegar `firestore.rules` y `storage.rules` en el
proyecto antes de publicar nada desde el Designer (fase 3 en adelante; la fase 8
añade `everest_analiticas`). Mientras
no estén, la lectura de la portada falla y se pinta desde el código —no se rompe
nada—, pero cualquier publicación sería rechazada.

### 4.3 Plantilla sin conectar ⛔

Son módulos del Minimal UI Kit que **siguen ahí y sirven datos de `src/_mock/`**.
`filterDashboardNavDataByUser` los oculta a todo el mundo salvo al Administrador
Global (`isDevDemoNavItem`).

- Rutas: `/dashboard/{app, ecommerce, analytics, banking, booking, file, course, job, tour, user, blog(post), mail, kanban, subpaths, blank, params, permission}`
- APIs mock: `/api/kanban`, `/api/mail/*`, `/api/post/*`, `/api/product/list` (devuelve `{products: []}`)
- Secciones: `src/sections/_examples/` y `src/sections/prinicipal/` (con la errata en el nombre). Ojo: **`prinicipal/` NO es el módulo Principal** — son las vistas demo del template (analytics, app, banking, booking, course, e-commerce, file). Solo se usan desde `/dashboard/principal2` ⛔ y desde `profile-home.jsx`, que importa `AppFeatured` de ahí.
- Páginas públicas: `/about-us`, `/contact-us`, `/faqs`, `/pricing`, `/payment`, `/coming-soon`, `/maintenance`

⚠️ **No construyas encima de estos módulos** sin decidir antes si se conectan o se
borran. Cada uno arrastra dependencias pesadas (FullCalendar, ApexCharts,
MapLibre, Amplify, Auth0, Supabase) que hoy no usa nadie.

### 4.4 Proveedores de autenticación no usados ⛔

`src/auth/components/context/` trae `amplify`, `auth0`, `jwt` y `supabase`
completos. **Solo `firebase` está activo** (`CONFIG.auth.method = 'firebase'`).

---

## 5. Modelo de datos (ERD)

### 5.1 Jerarquía organizacional (API .NET) ✅

```
País
 └── Región            (Regiones)
      └── Sección      (Secciones)
           └── Iglesia (Iglesias)
                └── Destacamento (Destacamentos)   ← nombre + número oficial
                     └── Miembro (Miembros)
                          └── Tutor (Tutores)
```

⚠️ **La sección de un destacamento se resuelve a través de su iglesia.** Por eso
tantas funciones de alcance reciben `{ dests, churches, sectionals }`: sin las
iglesias cargadas, un cargo seccional no reconoce sus propios destacamentos.

**Divisiones por edad** ✅ (`src/services/member-service.js`):

| id  | División     | Edad  |
| --- | ------------ | ----- |
| 1   | Navegantes   | 5–7   |
| 2   | Pioneros     | 8–10  |
| 3   | Seguidores   | 11–13 |
| 4   | Exploradores | 14–17 |
| 5   | Liderazgo    | 18+   |

**Código de miembro** ✅ (`src/catalogs/codigo-miembro.js`): `EDR-NNNNN` desde
`10001`. Antes llevaba provincia (`DO-SD-10001`); se quitó porque la provincia
cambia al mudarse y porque cada provincia numeraba por separado, así que dos
personas podían compartir número.

### 5.2 Colecciones de Firestore ✅

**Autorización** — `permisos`, `roles`, `usuarios_roles`, `admins`,
`solicitudes_permiso`, `auditoria_permisos`, `combinaciones_roles`,
`secretos_acceso`

**Directivas** — `posicionesDirectiva`, `directivasOrganizacionales`,
`asignacionesDirectiva`, `disenosDirectiva`,
`organigramaDirectivaDestacamentos`, `cargosDirectiva` _(obsoleta)_,
`directiva_cuatrienios_integrantes` y `directiva_nacional_permanentes` (la
Directiva Nacional por cuatrienio; ver `docs/directiva-por-cuatrienio.md`)

**Miembro** — `informacion_medica_basica_miembros`, `medicamentos_miembros`,
`alergias_miembros`, `condiciones_medicas_miembros`,
`documentos_salud_miembros`, `solicitudes_acceso_dispensa_medica`,
`notas_tutores_miembros`, `itemsAscenso`, `carpetasAscenso`,
`progresoAscensoMiembros`, `vinculosCertificadosAscenso`,
`favoritosAscensoMiembros`

**Cintas y estatus del miembro** — `cintas_miembros` (una por `idMiembros`: qué
cintas lleva, cuántas veces ganó cada una y su origen; la lee cualquier sesión y
hoy solo la escribe el Administrador Global) y `estatus_miembros` (una por
`idMiembros`: estatus, faltas y presencias seguidas, última presencia, desde
cuándo, motivo y hasta cuándo se respeta un cambio a mano; la escribe quien pasa
lista). Las dos, fuera del comodín.

**Preferencias** — `preferencias_usuarios` (una por uid; hoy, el destacamento elegido en Asistencia durante la prueba de roles)

**Asistencia** — `asistencias`, `registrosAsistencia` (con `detalleOtro` cuando
el estado es "otro"), `ultimasAsistenciasMiembros`, `actividadesAsistencia`,
`licenciasAsistencia` (un miembro de licencia entre dos fechas)

**Comercio** — `carritos`, `ordenes`, `recibos`, `direcciones`, `productos`,
`resenas_productos`, `movimientos_inventario`, `contadores_comercio`

**Muro** — `publicaciones`, `comentarios_publicaciones`,
`reacciones_publicaciones`, `reportes_publicaciones`, `publicaciones_ocultas`,
`compartidos_publicaciones`, `metadatos_privados_publicaciones`, `seguidores`,
`amistades`, `solicitudes_amistad`, `galeria_usuarios`, `anuncios_principal`

**Chat** — `conversaciones_chat` (+ subcolecciones `mensajes`, `recibos`,
`auditoria`, `respuestas_tienda` y `respuestas_oficina`, estas dos solo del servidor),
`presencia_chat`, `fotos`, `buzones_chat` (la foto de cada buzón compartido)

**Notificaciones** — `notificaciones`, `tipos_notificaciones`,
`plantillas_notificaciones`, `preferencias_notificaciones`,
`tareas_notificaciones`

**EXPLORA Designer** — `everest_publicado` (un documento por pantalla con el
mapa `bloques`; lo lee cualquier sesión y lo escribe el Administrador Global),
`everest_borradores` y `everest_versiones` (solo el Administrador Global; una
versión no se reescribe ni se borra) y `everest_analiticas` (suma cualquier sesión,
solo los contadores; la lee el Administrador Global). Las cuatro, fuera del comodín.

**Otros** — `solicitudes_cambio`, `solicitudes_cambio_miembro`,
`auditoria_sistema`, `gestorArchivos`, `plantillasCertificados`

### 5.3 Storage ✅ — `storage.rules`

`miembros/`, `destacamentos/`, `documentos/`, `certificados/`, `chat/`,
`principal/`, `propuestas/`, `principal-tarjetas/` (fondos de la portada de hoy),
`everest/` (medios subidos desde EXPLORA Designer; mismas condiciones que
`principal-tarjetas/`, sin borrado), `directiva-historica/` (fotos copiadas de la
Directiva por cuatrienio; Administrador Global y Oficina Nacional, sin borrado)

### 5.4 Modelos y esquemas ✅ — `src/models/`

`member`, `dest`, `church`, `sectional`, `regional`, `product`, `order`,
`receipt`, `cart`, `address`, `inventory-movement`. Los `*-schema.js` son
esquemas **Zod**.

⚠️ `MemberValidationSchema` es deliberadamente laxo: solo `firstName` y
`lastName` son obligatorios. El comentario explica por qué se endurecieron esos
dos (se guardaban fichas en blanco que gastaban un código de miembro).

---

## 6. Endpoints `/api`

Todos son Route Handlers de Next.js en `src/app/api/**/route.js`.

### Autenticación y cuentas ✅

`acceso-con-codigo`, `clave-miembro`, `codigo-restablecimiento`, `correo-acceso`,
`correo-acceso-administrador`, `correo-cuenta-miembro`, `correo-disponible`,
`crear-cuenta-miembro`, `estado-clave`, `recuperacion`, `sincronizar-rol`

### Administración ✅

`admin/set-user-claims`, `admin/sincronizar-roles`, `admin/switch-own-role`

### Proxy del padrón .NET ✅

`members` (GET paginado), `members/post`, `members/put`, `members/template`,
`dest`, `dest/post`, `dest/put`, `sectional`, `sectional/post`, `sectional/put`,
`regional`, `regional/post`, `regional/put`, `churches`, `churches/post`,
`churches/put`, `divisions`, `divisions/calculate`, `countries`, `cargos`,
`cargos-miembros`, `miembros/tutores`, `miembros/tutores/nota`

### Aplicación ✅

`chat`, `calendar`, `notificaciones/recuperacion-atendida`, `notifications/seed`,
`principal/metadatos-privados`, `image-data-url`

### Mock de plantilla ⛔

`kanban`, `mail/*`, `post/*`, `product/*`

### Contrato de errores ✅

`Response.json({ error: '…' }, { status })`. Los guardas devuelven **401** sin
sesión, **403** sin permiso y **503** cuando el servidor no puede comprobar la
sesión. El upstream lento produce `El servidor de datos no respondió en Ns.`

---

## 7. Estructura de carpetas

| Carpeta           | Responsabilidad                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `src/app/`        | Rutas (App Router). `page.jsx` = página; `api/**/route.js` = endpoint.                           |
| `src/sections/`   | Las vistas de cada módulo. **Aquí vive el grueso de la lógica de pantalla.**                     |
| `src/components/` | Componentes reutilizables sin dominio (form, table, iconify, upload…).                           |
| `src/services/`   | Acceso a datos: Firestore y `fetch` a `/api`.                                                    |
| `src/models/`     | Forma de los datos y esquemas Zod.                                                               |
| `src/server/`     | Código que solo corre en servidor (`.mjs` para poder probarlo con `node --test`).                |
| `src/auth/`       | Contexto de sesión, guardas, permisos y roles.                                                   |
| `src/catalogs/`   | Catálogos fijos transcritos de documentos oficiales.                                             |
| `src/utils/`      | Reglas transversales. **`member-access.js` y `org-level-access.js` son el corazón del alcance.** |
| `src/layouts/`    | Layouts y navegación (`nav-config-dashboard.jsx`).                                               |
| `src/theme/`      | Sistema visual.                                                                                  |
| `src/_mock/`      | Datos de la plantilla. ⛔ No lo uses para nada nuevo.                                            |
| `tests/`          | Pruebas con `node --test`.                                                                       |
| `docs/`           | Auditorías y encargos al equipo .NET.                                                            |

---

## 8. Instalación, ejecución y pruebas

```bash
npm install          # o yarn install
npm run dev          # http://localhost:3032
npm run build
npm start            # puerto 3032
```

**Calidad:**

```bash
npm run lint         # ESLint
npm run lint:fix
npm run fm:check     # Prettier
npm run fix:all      # lint:fix + fm:fix
```

**Pruebas** (Node test runner, sin framework externo):

```bash
npm run test:acceso      # permisos y alcance — la suite más importante
npm run test:directivas
npm run test:chat-auth
npm run test:admin
npm run test:ascenso
npm run test:tienda
```

`tests/member/` cubre además el estatus del miembro
(`estatus-miembro.test.mjs`, `estatus-por-asistencia.test.mjs`,
`estatus-miembro-avisos.test.mjs`) y las cintas del perfil
(`cintas-perfil-orden.test.mjs`).

⚠️ `tests/member/` **no tiene script**. Ejecútala así:

```bash
node --test tests/member/*.test.mjs
```

Todo junto:

```bash
node --test tests/acceso/*.test.mjs tests/admin/*.test.mjs tests/ascenso/*.test.mjs tests/chat/*.test.mjs tests/directivas/*.test.mjs tests/everest/*.test.mjs tests/member/*.test.mjs tests/tienda/*.test.mjs
```

Las pruebas importan el código real con `tests/soporte/resolver-alias-src.mjs`,
que resuelve el alias `src/` **y declara cada `.js` como módulo**: el proyecto no
tiene `"type": "module"`, así que node los leía como CommonJS y el `export` de
ficheros como `src/auth/permissions/roles.js` tumbaba el archivo de prueba entero.
Quedan diez pruebas en rojo que importan `src/` con rutas relativas **sin registrar
el resolver**: son las que hay que migrar, no una regla que falle.

**Antes de dar por terminado un cambio: `npm run build` + la suite completa.**
No hay CI configurado en el repositorio. ❓

---

## 9. Variables de entorno

Sin valores. Ver `.env.example`.

**Obligatorias** ✅ — sin las seis, `isFirebaseConfigured` es `false` y la
aplicación arranca sin autenticación:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

**Opcionales**: `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`,
`NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_ASSETS_DIR`, `BUILD_STATIC_EXPORT`

**Servidor** ❓: `firebase-admin` necesita credenciales de cuenta de servicio
(`src/server/firebase-admin.js`). Confirmar los nombres exactos con quien
administra Netlify.

⛔ Las de AWS Amplify, Auth0 y Supabase están en `.env.example` por la plantilla.
No se usan.

⚠️ **`NEXT_PUBLIC_*` se incrusta en el build.** Cambiarlas en Netlify no basta:
hay que volver a desplegar.

---

## 10. Despliegue

**Netlify** ✅ (`netlify.toml`): build `yarn build`, publish `.next`,
`NODE_VERSION=22.13.0`, `AWS_LAMBDA_JS_RUNTIME=nodejs22.x`.

⚠️ **No bajes el runtime de las funciones.** `firebase-admin@14` exige Node ≥ 22;
con una versión anterior, toda ruta que lo importe revienta al **cargar el
módulo** —500 seco, antes del handler— y se caen `/api/auth/*`, `/api/cargos` y
`/api/chat`.

⚠️ **`serverExternalPackages: ['firebase-admin']`** en `next.config.mjs`: el Admin
SDK usa `require` dinámicos que no sobreviven al empaquetado. No lo quites.

---

## 11. Convenciones de código

1. **Comentarios en español, explicando el PORQUÉ.** Es la convención más visible
   del repositorio: los comentarios cuentan qué se rompía antes. **Mantenla.**
2. **Nombres de dominio en español** (`filtrarMiembrosDeSuDestacamento`,
   `puedeVerMiembrosDelDestacamento`); nombres de plantilla en inglés. Los
   coexisten; al escribir código de dominio nuevo, usa español.
3. **Prettier**: `printWidth: 100`, comillas simples, `trailingComma: 'es5'`, 2
   espacios, `endOfLine: 'lf'`.
4. **ESLint** con `perfectionist` ordenando imports. Usa `npm run lint:fix`.
5. ⚠️ **El repositorio no está limpio de formato.** Ejecutar Prettier sobre un
   archivo antiguo mete cientos de líneas de reformateo ajeno en tu diff. Formatea
   solo lo que tocas, o haz el reformateo en su propio commit.
6. **Ficheros de servidor probables → `.mjs`**, para poder importarlos desde
   `node --test` sin transpilar.
7. **Tests en español**, nombrados por el comportamiento
   (`miembros-por-destacamento.test.mjs`), con un encabezado que explica qué se
   rompía.
8. **Alias `src/`** (`jsconfig.json`). En los tests se resuelve con
   `tests/soporte/resolver-alias-src.mjs`, que permite importar el **código real**
   en vez de replicar la regla.

---

## 12. Sistema visual

`src/theme/theme-config.js` ✅

- **Tipografía**: `Public Sans Variable` (primaria), `Barlow` (secundaria)
- **Primario**: `#00A76F` (verde) · **Secundario**: `#8E33FF`
- **Modo**: `system` por defecto — sigue el ajuste de oscuro del teléfono en vivo;
  quien lo fije a mano desde Ajustes gana
- Variables CSS con selector `data-color-scheme`

**Adaptable** ✅: patrón `{ xs, sm, md, lg }` de MUI en toda la aplicación. Varias
vistas tienen tratamiento explícito de móvil (tarjetas en vez de tabla, barras
fijadas al pie, etiquetas acortadas).

**Maquetas y capturas de referencia** ✅: se copia la **disposición**, no los
píxeles. Lo que se pide en una imagen se construye con lo que ya hay:

- `Label`, `Chip`, `Card`, `Iconify` y el resto de `src/components/`.
- Iconos **del paquete** (`src/components/iconify/icon-sets.js`). Uno que no
  esté registrado se descarga por internet, parpadea y deja el hueco mientras
  tanto; el propio componente avisa por consola. Si hace falta uno que no está
  —y no hay variante de línea para lo que se pide—, se dibuja y se añade al
  paquete, en la misma rejilla de 24 y con el mismo grosor de trazo.
- **Colores del tema**, nunca hex sacados de la imagen. El verde `primary`
  (`#00A76F`) es la identidad; el cian `info` (`#00B8D9`) es de la plantilla y
  se ha colado ya dos veces donde tocaba el verde. Y el color solo se usa para
  **distinguir**: cinco estados de un pedido, sí; tres garantías que prometen
  lo mismo, no —esas van todas iguales—.
- Las pantallas de la tienda (`/product`, `/order`, `/invoice`, `/checkout`)
  comparten marco: `ANCHO_DEL_MARCO`, `ANCHO_DEL_CONTENIDO` y
  `RELLENO_DEL_MARCO` de `src/components/commerce/commerce-layout.js`. La
  portada (`StoreHeader`) es la misma en las cuatro y su alto sale de su ancho,
  así que un tope distinto la deja más estrecha **y** más baja en esa pantalla.

**Fechas** ✅: se escriben SIEMPRE con el calendario del proyecto, nunca con el
`<input type="date">` ni `datetime-local` del navegador.

- Dentro de un formulario: `Field.DatePicker` / `Field.DateTimePicker`
  (`src/components/hook-form/rhf-date-picker.jsx`), que ya resuelven el valor
  vacío de solo lectura y el mensaje de error.
- Fuera de un formulario: `DatePicker` / `DateTimePicker` de `@mui/x-date-pickers`
  directamente, con `format="DD/MM/YYYY"` —y `ampm` con `hh:mm A` si lleva hora—.
  El `LocalizationProvider` está puesto una sola vez en `src/app/layout.jsx`.

El nativo cambia de aspecto y de orden de campos según el sistema operativo del
que mira, así que en la misma pantalla convivían dos formas distintas de escribir
una fecha: la del calendario del proyecto y la que le tocara al navegador.

**Accesibilidad** 🟡: hay `aria-label` en botones de icono y `aria-live` en zonas
que cambian solas, pero **no hay auditoría de accesibilidad**. ❓

---

## 13. Riesgos y deuda técnica

| #   | Riesgo                                                                                                                                                                                 | Gravedad |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **El alcance de escritura se decide en el navegador.** Las rutas `/api` de destacamentos/secciones/regiones solo exigen sesión.                                                        | 🔴 Alta  |
| 2   | **La API .NET devuelve el padrón entero.** Sin el trabajo de `docs/backend-dotnet-checklist.md`, cualquier sesión válida puede leer todos los miembros.                                | 🔴 Alta  |
| 3   | **Comodín en `firestore.rules`.** Todo lo no excluido explícitamente es escribible por cualquier sesión válida. Cada colección nueva **hereda ese permiso**; hay que excluirla a mano. | 🔴 Alta  |
| 4   | **Upstream frágil** (0,3 s a 17 s, plan gratuito). Ya hay caché y timeouts, pero es un punto único de fallo.                                                                           | 🟠 Media |
| 5   | **~20 módulos de plantilla sin conectar** y sus dependencias pesadas.                                                                                                                  | 🟠 Media |
| 6   | **Cuatro proveedores de auth sin usar.**                                                                                                                                               | 🟡 Baja  |
| 7   | **Formato inconsistente.**                                                                                                                                                             | 🟡 Baja  |
| 8   | **Sin CI.** ❓                                                                                                                                                                         | 🟠 Media |
| 9   | **`package.json` con el nombre de la plantilla.**                                                                                                                                      | 🟡 Baja  |
| 10  | **Ficheros grandes**: `notification-service.js` (2.889 líneas), `member-access.js` (2.725), `member-list-view.jsx` (1.105), `org-level-access.js` (890).                               | 🟠 Media |
| 11  | **El estatus del miembro vive en dos sitios.** Las rachas y el estatus calculado están en `estatus_miembros` (Firestore), pero el campo `estatusMiembro` es de la API .NET y no se ha comprobado que acepte los valores nuevos (`reclutamiento`, `fallecido`). | 🟠 Media |
| 12  | **Los 3 meses para pasar a Inactivo se calculan cuando alguien abre el destacamento.** Si nadie entra, el cambio espera; haría falta una tarea diaria en el servidor. | 🟡 Baja  |

---

## 14. Decisiones arquitectónicas (y por qué no se revierten)

1. **Dos fuentes de datos.** La API .NET es heredada; Firestore es donde crece la
   aplicación. Migrar el padrón no está en el alcance actual.
2. **Caché de upstream con _stale_ servible.** Antes que una lista vacía, la de
   hace un minuto.
3. **Firestore con caché local persistente.** El pase de lista ocurre donde no
   siempre hay señal.
4. **Permisos por cargo, no por usuario.** Los permisos salen del catálogo del
   rol; los directos son la excepción.
5. **Proponer vs aprobar.** Los cargos locales proponen; la Oficina Nacional
   aplica. Si la Oficina Nacional además ejerce un cargo local, la revisión
   **escala al Administrador Global** (`requiereRevisionDeAdministradorGlobal`).
6. **Un aviso por hecho.** Las notificaciones se redactan al pintarlas, no al
   escribirlas, para que los documentos ya guardados también se lean bien.
7. **La numeración no se reutiliza.** El correlativo de órdenes se reserva en
   transacción: un hueco en la serie no le hace daño a nadie; un número repetido,
   sí.
8. **Cada destacamento enseña los suyos.** `/member` es la lista del destacamento
   propio (salvo Administrador Global); a los de otro se llega por la pestaña
   "Miembros" de su ficha.
9. **La portada tiene su valor de fábrica en el código.** EXPLORA Designer no
   siembra Firestore con lo que hay: publica por bloque, y lo no publicado —o lo
   publicado roto— se pinta desde el código. Así la portada no cambia hasta que
   alguien decide publicarla, y una publicación mala nunca deja un hueco.
10. **El diseño de la portada va aparte del contenido y en hexadecimal.** Aparte,
    porque varios bloques son listas; en hexadecimal, como el encabezado de la
    tienda, porque lo elige una persona y lo ve gente en modo claro y oscuro. Un
    diseño vacío no cambia un píxel: cada tarjeta usa el suyo solo si está.

---

## 15. Glosario

| Término                          | Significado                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Destacamento**                 | Unidad local, ligada a una iglesia. La unidad operativa básica.                                       |
| **Sección**                      | Agrupa destacamentos. Su relación se resuelve por la iglesia.                                         |
| **Región**                       | Agrupa secciones.                                                                                     |
| **Consejo Nacional / Ejecutivo** | Cargos de nivel país.                                                                                 |
| **Oficina Nacional**             | Rol que **aprueba o rechaza** cambios sobre entidades y directivas. No modifica por su cuenta.        |
| **Directiva**                    | Conjunto de cargos de una entidad. Hay de destacamento (local y juvenil), sección, región y nacional. |
| **Alcance**                      | Hasta dónde llega un cargo: destacamento, sección, región, nacional o global.                         |
| **Cargo**                        | Puesto en una directiva. Una persona puede tener varios.                                              |
| **Rol principal**                | El de mayor nivel entre sus cargos. **No decide por sí solo**: los guardas miran todos.               |
| **División**                     | Grupo por edad: Navegantes, Pioneros, Seguidores, Exploradores, Liderazgo.                            |
| **Sistema de Ascenso**           | Catálogo de premios que un miembro completa.                                                          |
| **Dispensa Médica**              | Información de salud del miembro, con acceso restringido.                                             |
| **Código de miembro**            | `EDR-NNNNN`. También es el usuario de acceso.                                                         |
| **Padrón**                       | El conjunto de miembros de la organización.                                                           |
| **Solicitud de cambio**          | Propuesta pendiente de aprobación de la Oficina Nacional.                                             |
| **Candado de alcance**           | Componente que bloquea una pantalla fuera del alcance del usuario.                                    |
| **Upstream**                     | La API .NET en `systexploradores.somee.com`.                                                          |

---

## 16. Reglas para futuros cambios

**Antes de tocar código:**

1. Lee los comentarios del archivo. Cuentan qué se rompió antes; muchos son la
   única documentación de una decisión.
2. Si tocas permisos o alcance, **lee primero el test** que cubre esa regla y
   ejecuta `npm run test:acceso`.
3. Comprueba en qué fuente vive el dato: API .NET o Firestore.

**Al escribir:**

4. Comentarios en español, explicando el porqué, no el qué.
5. Nombres de dominio en español.
6. No formatees archivos que no estés tocando.
7. Colección nueva en Firestore → **añádela a `firestore.rules` explícitamente**,
   o hereda el comodín.
8. Llamada nueva al upstream → a través de `fetchUpstreamText`.

**Antes de terminar:**

9. `npm run lint` y `npm run build` en verde.
10. La suite completa de tests en verde.
11. Test nuevo para cada regla de negocio nueva.
12. **Actualiza este archivo** si cambiaste algo que aquí está descrito.

**Lo que no se hace:**

13. No derives contraseñas de datos predecibles.
14. No renumeres identificadores ya emitidos.
15. No borres datos sin que alguien lo pida explícitamente.
16. No construyas sobre módulos de plantilla sin decidir antes su destino.

---

_Última revisión: 2026-09-09. Si el código y este documento se contradicen, manda
el código — y corrige el documento._
# Acceso de prueba como miembro

- `rdpr18@gmail.com`, mientras siga registrado como Administrador Global activo, puede abrir la sesión real de un miembro desde **Probar como usuario** en el panel de cuenta.
- El cambio usa tokens personalizados de Firebase y no modifica la contraseña, el rol ni los permisos del miembro.
- La barra amarilla debe permanecer visible durante la prueba y ofrecer **Volver a mi cuenta**. La identidad original se conserva únicamente en una cookie firmada y `HttpOnly`.
- Esta capacidad está disponible en producción. La API debe comprobar siempre el correo firmado por Firebase Auth y el registro activo de Administrador Global; ocultar el botón en el cliente no sustituye esa comprobación.
