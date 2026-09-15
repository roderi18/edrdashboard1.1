# PROJECT_GUIDELINES.md — ERD Dashboard de Exploradores

> Documentación de referencia del proyecto. **Todo lo que sigue sale de leer este
> repositorio.** Cada elemento va marcado con su estado real:
>
> | Marca | Significado |
> |---|---|
> | ✅ **Implementado** | Existe, está conectado y se usa. |
> | 🟡 **Parcial** | Existe pero le falta una pieza para estar completo. |
> | ⛔ **Pendiente / plantilla** | No está hecho, o es código de la plantilla que nunca se conectó. |
> | ❓ **Suposición** | Deducido del código; **hay que confirmarlo con el equipo**. |
>
> Si añades una funcionalidad, **actualiza este archivo en el mismo commit**.

---

## 1. Identidad de la aplicación

| Dato | Valor | Fuente |
|---|---|---|
| Nombre visible | **Exploradores del Rey** | `src/global-config.js` → `CONFIG.appName` |
| Nombre del paquete | `@minimal-kit/next-js` v7.6.1 | `package.json` |
| Origen | Plantilla **Minimal UI Kit** (Next.js) | `README.md`, `src/_mock/`, `src/sections/_examples/` |
| Organización | Exploradores del Rey, República Dominicana | `docs/ESTATUTOS Y REGLAMENTOS ERRD.pdf`, textos de la UI |
| Proyecto Firebase | `systexploradores` | `docs/backend-dotnet-checklist.md` |

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
3. **Cambios que necesitan aprobación.** Los cargos locales *proponen*; la Oficina
   Nacional *aprueba* (`solicitudes_cambio`).
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

**No hay backend Node propio.** ✅ Lo que existe son *route handlers* de Next.js
bajo `src/app/api/**`, que hacen tres cosas: comprobar la sesión, hacer de proxy y
caché de la API .NET, y ejecutar lo que necesita privilegios (`firebase-admin`).

❓ **Suposición**: la API .NET es un sistema heredado mantenido por otro equipo.
`docs/backend-dotnet-checklist.md` es un encargo escrito *hacia* ese equipo.

### Las dos fuentes de datos

Esta es **la decisión arquitectónica más importante del proyecto** y hay que
tenerla presente antes de tocar nada.

| Fuente | Qué guarda | Cómo se accede |
|---|---|---|
| **API .NET** (`systexploradores.somee.com`) | El padrón heredado: `Miembros`, `Destacamentos`, `Secciones`, `Regiones`, `Iglesias`, `Divisiones`, `Paises`, `Cargos`, `CargosMiembros`, `Tutores` | Siempre a través de `/api/*`, nunca desde el navegador |
| **Firestore** | Todo lo que la aplicación añadió: notificaciones, chat, muro, salud, ascenso, asistencia, tienda, directivas, roles, auditoría, archivos, certificados | Firebase SDK desde el cliente, con `firestore.rules` |

**Consecuencia práctica**: un miembro existe en los dos sitios. Su ficha básica
(nombre, teléfono, destacamento) vive en la API .NET; su salud, sus premios, su
asistencia y sus cargos viven en Firestore, enlazados por `idMiembros`.

### El upstream es lento — y el código lo asume

`src/utils/upstream-cache.js` ✅ documenta que la API .NET **varía de 0,3 s a más
de 17 s** porque su plan gratuito serializa la concurrencia. Por eso:

- Caché en memoria por proceso, TTL 60 s, con *stale* servible hasta 10 min.
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

| Tipo | Cómo entra | Dónde vive su perfil |
|---|---|---|
| **Miembro** | Código `EDR-NNNNN` + contraseña | `usuarios_roles` |
| **Administrador** | Correo + contraseña | `admins` |
| **Sesión de administrador con cargo** (`usuario_seccion`, `usuario_region`…) | Correo | `usuarios_roles` con `rolId` |

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
   ese módulo, no el de mayor rango.
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
   - **Avisos en tiempo real**: quien atiende un buzón recibe el aviso en la
     campana —tenga sesión de miembro o de administrador; el aviso lleva
     `metadatos.buzon` y no se filtra por rol— y el contador de "Chats" suma lo
     pendiente de sus buzones. La campana escucha sus avisos en vivo
     (`escucharNotificacionesDelUsuario`) y los buzones se escuchan desde cualquier
     pantalla (`useBuzonesEnVivo`).
   - **Las reglas cuentan todos los cargos, en cualquier posición** (no solo el
     principal) con `rolesQueEjerce`, la lista
     plana que el servidor escribe en `usuarios_roles` junto a `cargos`
     (`src/utils/lista-roles-que-ejerce.mjs`). Una cuenta sin esa lista la recibe
     al volver a sincronizar su rol.
   - **La foto de cada buzón** la cambia **solo el Administrador Global**, desde el
     chat: en el menú de su cuenta, debajo de "Perfil", o pasando el ratón por la
     foto del buzón en su bandeja. Vive en `buzones_chat/<clave>`, pasa por
     `proponerCambio` (ámbito `buzon_chat`) y el servidor la pone en contactos,
     conversaciones y avisos.
   - **Componentes**: `ChatBandejas` (pestañas por permisos), `ChatAvatarDeBuzon` y
     `useCambiarFotoDeBuzon`; `useBuzonesDelChat` dice qué buzones atiende la
     sesión y en cuál está (`?bandeja=tienda|oficina`).
   - **Para añadir otro buzón**: una entrada en `chat-buzones.mjs`, su número en
     `idMiembroNoUsurpaUnBuzon` y su `atiendeBuzonDe…` en `firestore.rules` y
     `storage.rules`, y su colección de respuestas.
   Tests: `tests/chat/chat-buzones-compartidos.test.mjs` y
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

| Grupo | Qué los separaba |
|---|---|
| **Pastor** = Consejo Destacamento = Capellán | El Pastor no estaba en `REGION_WIDE_SECTION_VIEWER_ROLE_IDS`: veía menos estructura que sus dos compañeros de desplegable. Ese listado decide qué se **ve**, no con qué se interactúa — las secciones ajenas salen deshabilitadas para todos. |
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

| Capa | Archivo | Qué hace |
|---|---|---|
| Pantalla | `src/utils/member-access.js`, `src/utils/org-level-access.js`, `src/auth/permissions/can.js` | Oculta o deshabilita |
| Rutas `/api` | `src/server/sesion-rest.mjs` | `exigirSesionRest`, `exigirPermisoDeCargoRest`, `exigirAdministradorGlobalRest`, `exigirCoordinadorDeDestacamentoRest` |
| Firestore | `firestore.rules` | `esUsuarioDelSistema()`, `tienePermisoDeCargo()`, `destacamentosDeSuAlcance()` |

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

| Módulo | Ruta | Notas |
|---|---|---|
| **Principal (muro)** | `/dashboard/principal` | Renderiza `UserProfileView` (`src/sections/user/view`) con `useSessionProfile`. Publicaciones, comentarios, reacciones, reportes, compartidos, ocultar, amistades y seguidores. Firestore. |
| **Niveles organizacionales** | `/dashboard/level/{national,regional,sectional,dest}` | CRUD + organigrama de directiva por nivel. |
| **Miembros** | `/dashboard/level/member` | Lista (tabla y tarjetas), ficha, creación, carga masiva por Excel, PDF, solicitudes de cambio. |
| **Miembros de un destacamento** | `/dashboard/level/dest/[id]/edit/members` | Pestaña que reutiliza la misma vista de miembros. |
| **Directivas** | `.../edit/leadership`, `.../edit/youth-leadership` | Organigrama, asignaciones, diseños. El diseño de **Líderes Juveniles es uno solo para todos los destacamentos** (`destacamento-juvenil_global`); sin él se lee el de Tribu de Judá 18 (`231`), el modelo. Test: `tests/directivas/diseno-juvenil-global.test.mjs`. |
| **Asistencia** | `/dashboard/level/attendance` | Pase de lista diario, resumen, informe avanzado, exportación. Offline-capable. |
| **Dispensa médica** | `/dashboard/level/member/[id]/edit/health` | Info básica, medicamentos, alergias, condiciones, documentos, solicitudes de acceso. |
| **Sistema de ascenso** | `.../edit/awards` | Catálogo de 490 premios transcrito del inventario oficial. |
| **Padres / tutores** | `.../edit/parents` | Con notas y autoguardado. |
| **Historial del miembro** | `.../edit/history` | |
| **Chat** | `/dashboard/chat` | Conversaciones, grupos, reacciones, presencia, recibos de lectura, adjuntos. Buzones compartidos **Tienda Virtual** (`?bandeja=tienda`) y **Oficina Nacional** (`?bandeja=oficina`), según los cargos de cada quien; el Administrador Global ve los dos y cambia su foto. 27 ficheros de test. |
| **Notificaciones** | Campana + `/dashboard/admin/notifications` | Tipos, plantillas, preferencias y tareas en Firestore. |
| **Tienda** | `/dashboard/product`, `/checkout`, `/order`, `/invoice` | Productos, inventario, reseñas, carrito, órdenes, recibos. |
| **Certificados** | `/dashboard/certificates` | Plantillas y generación. |
| **Documentos ministeriales** | `/dashboard/file-manager` | Firestore + Storage. |
| **Calendario** | `/dashboard/calendar` | Firestore. |
| **Administración** | `/dashboard/admin/*` | Administradores, logs, aprobaciones, permisos, roles, combinaciones, mantenimiento, salud del sistema. |
| **Cuenta propia** | `/dashboard/user/account` | |

### 4.2 Parcialmente implementados 🟡

| Elemento | Qué falta |
|---|---|
| **Crear recibo a mano** (`/dashboard/invoice/new`) | El formulario **no guarda nada**: `handleSaveAsDraft` y `handleCreateAndSend` solo hacen `console.info`. Arranca con `INV-1990` y direcciones de `_addressBooks`. O se conecta o se quita del menú. |
| **Alcance en el servidor** | Ver §3. El bloqueo vive en el navegador. |
| **`contadores_comercio`** | Cae bajo el comodín de `firestore.rules`: escribible por cualquier sesión válida. El contador de órdenes debería tener su propio bloque. |
| **Numeración de órdenes** | Conviven tres formatos: `ORD-26-0001` (nuevo), `REC-26-0001` (transitorio) y `ORD-1777776824429` (antiguo). El chat reconoce los tres. |
| **Buscar por número de recibo** | La búsqueda de `/order` consulta `numeroOrden`; pegar el número del recibo no encuentra la orden. |

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

| id | División | Edad |
|---|---|---|
| 1 | Navegantes | 5–7 |
| 2 | Pioneros | 8–10 |
| 3 | Seguidores | 11–13 |
| 4 | Exploradores | 14–17 |
| 5 | Liderazgo | 18+ |

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
`organigramaDirectivaDestacamentos`, `cargosDirectiva` *(obsoleta)*

**Miembro** — `informacion_medica_basica_miembros`, `medicamentos_miembros`,
`alergias_miembros`, `condiciones_medicas_miembros`,
`documentos_salud_miembros`, `solicitudes_acceso_dispensa_medica`,
`notas_tutores_miembros`, `itemsAscenso`, `carpetasAscenso`,
`progresoAscensoMiembros`, `vinculosCertificadosAscenso`,
`favoritosAscensoMiembros`

**Asistencia** — `asistencias`, `registrosAsistencia`,
`ultimasAsistenciasMiembros`

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

**Otros** — `solicitudes_cambio`, `solicitudes_cambio_miembro`,
`auditoria_sistema`, `gestorArchivos`, `plantillasCertificados`

### 5.3 Storage ✅ — `storage.rules`

`miembros/`, `destacamentos/`, `documentos/`, `certificados/`, `chat/`,
`principal/`, `propuestas/`

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

| Carpeta | Responsabilidad |
|---|---|
| `src/app/` | Rutas (App Router). `page.jsx` = página; `api/**/route.js` = endpoint. |
| `src/sections/` | Las vistas de cada módulo. **Aquí vive el grueso de la lógica de pantalla.** |
| `src/components/` | Componentes reutilizables sin dominio (form, table, iconify, upload…). |
| `src/services/` | Acceso a datos: Firestore y `fetch` a `/api`. |
| `src/models/` | Forma de los datos y esquemas Zod. |
| `src/server/` | Código que solo corre en servidor (`.mjs` para poder probarlo con `node --test`). |
| `src/auth/` | Contexto de sesión, guardas, permisos y roles. |
| `src/catalogs/` | Catálogos fijos transcritos de documentos oficiales. |
| `src/utils/` | Reglas transversales. **`member-access.js` y `org-level-access.js` son el corazón del alcance.** |
| `src/layouts/` | Layouts y navegación (`nav-config-dashboard.jsx`). |
| `src/theme/` | Sistema visual. |
| `src/_mock/` | Datos de la plantilla. ⛔ No lo uses para nada nuevo. |
| `tests/` | Pruebas con `node --test`. |
| `docs/` | Auditorías y encargos al equipo .NET. |

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

⚠️ `tests/member/` **no tiene script**. Ejecútala así:

```bash
node --test tests/member/*.test.mjs
```

Todo junto:

```bash
node --test tests/acceso/*.test.mjs tests/admin/*.test.mjs tests/ascenso/*.test.mjs tests/chat/*.test.mjs tests/directivas/*.test.mjs tests/member/*.test.mjs tests/tienda/*.test.mjs
```

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

| # | Riesgo | Gravedad |
|---|---|---|
| 1 | **El alcance de escritura se decide en el navegador.** Las rutas `/api` de destacamentos/secciones/regiones solo exigen sesión. | 🔴 Alta |
| 2 | **La API .NET devuelve el padrón entero.** Sin el trabajo de `docs/backend-dotnet-checklist.md`, cualquier sesión válida puede leer todos los miembros. | 🔴 Alta |
| 3 | **Comodín en `firestore.rules`.** Todo lo no excluido explícitamente es escribible por cualquier sesión válida. Cada colección nueva **hereda ese permiso**; hay que excluirla a mano. | 🔴 Alta |
| 4 | **Upstream frágil** (0,3 s a 17 s, plan gratuito). Ya hay caché y timeouts, pero es un punto único de fallo. | 🟠 Media |
| 5 | **~20 módulos de plantilla sin conectar** y sus dependencias pesadas. | 🟠 Media |
| 6 | **Cuatro proveedores de auth sin usar.** | 🟡 Baja |
| 7 | **Formato inconsistente.** | 🟡 Baja |
| 8 | **Sin CI.** ❓ | 🟠 Media |
| 9 | **`package.json` con el nombre de la plantilla.** | 🟡 Baja |
| 10 | **Ficheros grandes**: `notification-service.js` (2.889 líneas), `member-access.js` (2.725), `member-list-view.jsx` (1.105), `org-level-access.js` (890). | 🟠 Media |

---

## 14. Decisiones arquitectónicas (y por qué no se revierten)

1. **Dos fuentes de datos.** La API .NET es heredada; Firestore es donde crece la
   aplicación. Migrar el padrón no está en el alcance actual.
2. **Caché de upstream con *stale* servible.** Antes que una lista vacía, la de
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

---

## 15. Glosario

| Término | Significado |
|---|---|
| **Destacamento** | Unidad local, ligada a una iglesia. La unidad operativa básica. |
| **Sección** | Agrupa destacamentos. Su relación se resuelve por la iglesia. |
| **Región** | Agrupa secciones. |
| **Consejo Nacional / Ejecutivo** | Cargos de nivel país. |
| **Oficina Nacional** | Rol que **aprueba o rechaza** cambios sobre entidades y directivas. No modifica por su cuenta. |
| **Directiva** | Conjunto de cargos de una entidad. Hay de destacamento (local y juvenil), sección, región y nacional. |
| **Alcance** | Hasta dónde llega un cargo: destacamento, sección, región, nacional o global. |
| **Cargo** | Puesto en una directiva. Una persona puede tener varios. |
| **Rol principal** | El de mayor nivel entre sus cargos. **No decide por sí solo**: los guardas miran todos. |
| **División** | Grupo por edad: Navegantes, Pioneros, Seguidores, Exploradores, Liderazgo. |
| **Sistema de Ascenso** | Catálogo de premios que un miembro completa. |
| **Dispensa Médica** | Información de salud del miembro, con acceso restringido. |
| **Código de miembro** | `EDR-NNNNN`. También es el usuario de acceso. |
| **Padrón** | El conjunto de miembros de la organización. |
| **Solicitud de cambio** | Propuesta pendiente de aprobación de la Oficina Nacional. |
| **Candado de alcance** | Componente que bloquea una pantalla fuera del alcance del usuario. |
| **Upstream** | La API .NET en `systexploradores.somee.com`. |

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

*Última revisión: 2026-09-09. Si el código y este documento se contradicen, manda
el código — y corrige el documento.*
