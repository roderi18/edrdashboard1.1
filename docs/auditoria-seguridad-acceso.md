# Auditoría de seguridad — Acceso, administradores y recuperación de contraseña

Fecha: 2026-08-23 · Rama: `development` · Alcance: inicio de sesión de miembros y
administradores, códigos de un solo uso, recuperación de contraseña, reglas de
Firestore y superficie `/api` asociada.

Todo lo que sigue sale de leer el código de este repositorio. Lo marcado como
**verificar** depende de la configuración de la consola de Firebase, que no se
puede leer desde aquí.

---

## Estado (actualizado 2026-08-23)

Se implementaron **C-1 (parcial), C-2, C-4, C-5, A-1 (parcial) y A-7**. El detalle
está en «Lo implementado» al final de este documento. Lo demás sigue pendiente tal
como se describe abajo.

> **ORDEN DE DESPLIEGUE — no saltárselo.** Las reglas nuevas comprueban que
> exista `usuarios_roles/{uid}`, y hay perfiles guardados por id de miembro. Hay
> que ejecutar primero el backfill:
>
> ```bash
> node scripts/permissions/backfill-usuarios-roles-por-uid.mjs
> ```
>
> revisar la lista de «cuentas sin ficha», repetir con `--apply`, y **solo
> entonces** desplegar `firestore.rules`. Al revés, deja fuera a usuarios reales.

---

## Resumen ejecutivo

El flujo de códigos de un solo uso está bien pensado: el código se guarda como
huella PBKDF2, vence, se agota a los cinco intentos, no toca la contraseña
existente y muere al usarse. El problema no está ahí, sino **debajo**: la
frontera de confianza de la aplicación es "tener una cuenta de Firebase Auth", y
esa cuenta **la puede crear cualquier persona de internet** desde
`/auth/firebase/sign-up` o con el botón de Google. A partir de ahí, casi todas
las reglas de Firestore (`estaAutenticado()`) y casi todas las rutas `/api`
(sin comprobación ninguna) se abren.

Cinco cosas hay que arreglar **antes** de salir a producción:

1. Cerrar el alta pública de cuentas (C-1).
2. Autenticar `/api/members/` y las rutas de escritura sin guardia (C-2, A-6).
3. Dejar de derivar la contraseña inicial del código del miembro (C-3).
4. Sacar `clavesAnteriores` y `codigoRestablecimiento` de una colección que lee
   cualquier usuario (C-4).
5. Validar el **alcance** al generar códigos de restablecimiento (C-5).

---

## CRÍTICO

### C-1 · Cualquiera puede crear una cuenta y con ella leer media base de datos

- `src/app/auth/firebase/sign-up/page.jsx` publica el registro abierto
  (`createUserWithEmailAndPassword` con la API key pública).
- `src/auth/view/firebase/firebase-sign-in-view.jsx` ofrece "continuar con
  Google" en la pantalla de acceso.

`AuthProvider` cierra la sesión social si no encuentra perfil
(`auth-provider.jsx:311`), pero **eso ocurre después** de que Firebase ya emitió
un ID token válido. Con ese token:

- `firestore.rules:750-782` — `usuarios_roles`, `admins`, `asignacionesDirectiva`,
  `directivasOrganizacionales`, `combinaciones_roles` y `auditoria_sistema` son
  legibles con `estaAutenticado()`.
- `firestore.rules:784-811` — el comodín final concede **lectura y escritura** a
  cualquier autenticado sobre toda colección no listada arriba (el propio archivo
  lo reconoce como PENDIENTE).

Es decir: un desconocido se registra en treinta segundos y se lleva el directorio
de roles, la directiva completa y la bitácora, y puede escribir en cualquier
colección no blindada.

**Arreglo**
- Quitar la ruta `sign-up` y el proveedor Google del formulario, o dejar Google
  solo para *vincular* desde una cuenta ya existente (que es lo que hace
  `account-change-password.jsx`).
- En la consola de Firebase: deshabilitar el alta pública del proveedor
  "Correo/contraseña", o mover la creación de cuentas al Admin SDK (ver C-3) y
  bloquear el registro con App Check.
- Sustituir `estaAutenticado()` por un predicado real:
  `esUsuarioDelSistema()` = existe `usuarios_roles/$(uid)` o `admins/$(uid)`.
- Cerrar el comodín final: inventariar las colecciones restantes y darles bloque
  propio. Mientras tanto, al menos `allow read: if esUsuarioDelSistema()` y
  `allow write: if false` para lo que ya escribe el servidor.

### C-2 · `/api/members/` devuelve el padrón completo sin autenticación

`src/app/api/members/route.js:66-96` reenvía el header `Authorization` **si
existe**, y si no existe llama igual al upstream. La pantalla de acceso —sin
sesión— descarga la lista entera:

- `src/utils/member-sign-in.js:36` (`fetch('/api/members/')` para resolver el correo)
- `src/auth/view/firebase/firebase-reset-password-view.jsx:61`
- `src/auth/view/firebase/firebase-primer-acceso-view.jsx:213`

Un `curl https://<dominio>/api/members/` desde cualquier parte devuelve nombres,
correos, teléfonos, fechas de nacimiento y destacamento de **todos los miembros,
incluidos los menores de edad**. Es la peor fuga de datos del sistema y no
requiere ninguna habilidad.

**Arreglo**
- Exigir token en `GET /api/members/` (`requireRole` o `identificarSolicitante`)
  y devolver 401 sin él.
- Para el inicio de sesión no hace falta el padrón: ya existe
  `POST /api/auth/correo-acceso`. Que la pantalla llame solo a eso y que ese
  endpoint devuelva **únicamente** lo mínimo (ver A-1).
- Para "¿este correo ya es de otro miembro?" (`primer-acceso`), crear un endpoint
  server-side que responda un booleano con la sesión del propio miembro, en vez
  de descargar la lista y compararla en el navegador.

### C-3 · La contraseña inicial es el código del miembro, y los códigos son secuenciales

`src/utils/member-auth-credentials.js:24` — `buildMemberAuthPassword` devuelve el
código en mayúsculas (`EDR-10002`). `member-auth-provisioning-service.js:113`
crea la cuenta con esa contraseña y el correo interno `edr-10002@exploradores.app`,
igual de deducible.

Un atacante recorre `EDR-10001…EDR-1NNNN` y entra como cualquier miembro que aún
no haya cambiado su clave. La marca `debeCambiarClave` **solo bloquea la interfaz**
(`auth-guard.jsx:43`, cliente): el intruso ya tiene un ID token válido y puede
llamar a `POST /api/auth/clave-miembro` para fijar él la contraseña definitiva,
quedándose la cuenta para siempre y dejando fuera al miembro real.

**Arreglo**
- Crear la cuenta en el servidor (Admin SDK) con una contraseña **aleatoria que
  nadie ve**; el miembro entra la primera vez con el código de un solo uso que ya
  existe (`/api/auth/codigo-restablecimiento`), que es exactamente el mecanismo
  correcto y ya está construido.
- Migración: generar contraseña aleatoria para todas las cuentas que sigan con
  `debeCambiarClave: true`, y avisar a los coordinadores para que repartan códigos.
- Mientras tanto, **hacer cumplir `debeCambiarClave` en el servidor** (ver A-4).

### C-4 · Las huellas de las contraseñas las puede leer cualquier usuario

`registrarHuellaClave` (`src/server/claves-miembro.js:246`) guarda
`clavesAnteriores[]` —PBKDF2-SHA256, 120 000 iteraciones, sal de 16 bytes— y
`codigoRestablecimiento` dentro de `usuarios_roles/{id}`. Y
`firestore.rules:750` dice `allow read: if estaAutenticado()`.

Cualquier usuario con sesión (y, por C-1, cualquiera de internet) puede
descargarse las huellas de las **cinco últimas contraseñas reales** de todos los
usuarios y atacarlas sin conexión. Con el mínimo de 6 caracteres que impone
`clave-miembro/route.js:24`, un diccionario rompe una parte apreciable.

**Arreglo**
- Mover `clavesAnteriores`, `codigoRestablecimiento`, `debeCambiarClave` y
  `claveCambiadaEn` a una colección aparte —`secretos_acceso/{uid}`— con
  `allow read, write: if false`. Solo el Admin SDK la toca; el cliente no la
  necesita (ya pregunta por `/api/auth/estado-clave`).
- Subir el mínimo de contraseña a 10-12 caracteres y rechazar las más comunes.

### C-5 · Un Líder de Grupo puede emitir una sesión para cualquier persona del país

`src/app/api/auth/codigo-restablecimiento/route.js:71` solo comprueba
`solicitante.puedeGestionarOtros`, que en `claves-miembro.js:399` es
`rol === 'administrador_global' || permisos.has(MIEMBROS_EDITAR)`. Ese permiso lo
tienen Líder de Grupo, Líder Asistente, Coordinador y Asistente de Destacamento,
Pastor, Consejo y Capellán (`role-permissions.js:169,218`).

**No se valida el alcance.** Un líder de grupo de un destacamento cualquiera puede
generar un código de un solo uso para un miembro de otro destacamento, de otra
región, o para alguien que además ocupa un cargo nacional o es administrador —y
el código abre una sesión con **los permisos del objetivo**. Es escalada de
privilegios horizontal y vertical en una sola llamada.

Lo mismo aplica a `POST /api/auth/correo-cuenta-miembro`: con
`puedeGestionarOtros` se puede poner **el correo propio** como correo de acceso de
otra persona y luego usar "olvidé mi contraseña" contra ese correo.

**Arreglo**
- Resolver el alcance del solicitante (destacamento/sección/región, igual que hace
  la interfaz) y exigir que el miembro objetivo caiga dentro.
- Negar siempre si el objetivo tiene rol administrativo o un cargo de nivel igual
  o superior al del solicitante.
- Registrar cada emisión en `auditoria_sistema` (quién, a quién, cuándo, desde qué
  IP) — hoy solo queda en el historial del miembro.
- En `correo-cuenta-miembro`, exigir verificación del correo nuevo **antes** de
  que sirva para recuperar la contraseña.

---

## ALTO

### A-1 · `/api/auth/correo-acceso` filtra correos sin autenticación
`src/app/api/auth/correo-acceso/route.js:23` — con solo el código o el id del
miembro devuelve el correo real de su cuenta. Sin token, sin límite. Permite
cosechar correos de todo el padrón aunque se arregle C-2.
**Arreglo:** que devuelva un discriminador opaco (p. ej. `{ usaCorreoInterno: true|false }`)
en vez del correo, y ponerle límite por IP.

### A-2 · "Cambiar contraseña" de la cuenta no cambia nada
`src/sections/account/account-change-password.jsx:111-119`: `onSubmit` espera
500 ms, limpia el formulario y muestra "¡Actualización exitosa!". **La contraseña
nunca se toca.** Está enrutado en cinco paneles
(`/dashboard/{dest,level,member,national,regional}/account/change-password`).
Un usuario que sospeche que le robaron la clave creerá haberla cambiado.
**Arreglo:** llamar a `cambiarClaveMiembro` (ya existe) exigiendo reautenticación
con la clave actual, o retirar la pantalla hasta que funcione.

### A-3 · Cambiar la contraseña no exige la contraseña actual
`POST /api/auth/clave-miembro` acepta cualquier ID token válido
(`clave-miembro/route.js:31`). Firebase obliga a reautenticar precisamente para
esto; el servidor se lo salta. Un token robado —o la sesión cacheada de un equipo
compartido— basta para quedarse la cuenta.
**Arreglo:** pedir la clave actual y verificarla (`signInWithPassword` en el
cliente o REST de Firebase Auth en el servidor) salvo cuando la sesión venga del
código de un solo uso. Tras cambiarla, `revokeRefreshTokens(uid)`.

### A-4 · `debeCambiarClave` solo se aplica en el navegador
`auth-guard.jsx:43` es la única barrera. Ninguna ruta `/api` ni las reglas de
Firestore la consultan. Quien entre con el código de un solo uso —o con la clave
derivada del C-3— tiene un token plenamente operativo antes de elegir contraseña.
**Arreglo:** poner la marca en los custom claims al emitir el custom token
(`acceso-con-codigo/route.js:100`) y rechazar en las reglas y en las rutas `/api`
cualquier token con `debeCambiarClave: true` salvo para `/api/auth/clave-miembro`.

### A-5 · La sesión cacheada en `sessionStorage` es de fiar y no debería
`auth-provider.jsx:41-84` guarda usuario, rol, alcance, `permisosRol`,
`permisosExcluidos` y `debeCambiarClave` en `sessionStorage`, y `readCachedSession`
lo rehidrata tal cual durante 30 minutos. Editarlo desde la consola del navegador
da una interfaz con privilegios ajenos; como la mayoría de las rutas `/api` no
autorizan nada (A-6), eso se traduce en acceso real a datos.
**Arreglo:** cachear solo lo cosmético (nombre, foto). Rol, alcance y permisos se
resuelven siempre desde los claims/servidor, y las decisiones se toman en el
servidor, nunca solo en la interfaz.

### A-6 · Rutas `/api` que escriben sin ninguna comprobación
Del barrido de `src/app/api`: `churches/post`, `churches/put`, `dest/post`,
`dest/put`, `dest` (DELETE), `regional` (POST/DELETE), `regional/post`,
`regional/put`, `sectional` (DELETE), `sectional/post`, `sectional/put`,
`calendar` (POST/PUT/PATCH), `kanban` (POST), `notifications/seed`,
`notifications/birthdays`, `members/template`. Ninguna lee el token.
También `members/route.js` DELETE: reenvía el header **si viene**, pero no exige
nada por su cuenta — depende de que el upstream .NET lo rechace.
**Arreglo:** guardia por defecto. Lo más limpio es un `middleware.ts` que exija un
ID token válido para todo `/api/*` salvo una lista blanca explícita
(`acceso-con-codigo`, `correo-recuperacion`), y `requireRole` encima donde
corresponda.

### A-7 · Sin límite de intentos propio
Ninguna ruta de `/api/auth` tiene rate limiting. Consecuencias concretas:
- `acceso-con-codigo`: cinco intentos fallidos **queman el código** de un miembro
  (`route.js:56-72`) — un atacante puede anular sistemáticamente todas las
  recuperaciones en curso.
- `correo-acceso` y `correo-recuperacion`: enumeración masiva a máxima velocidad.
- El inicio de sesión prueba **varios correos en serie** con la misma contraseña
  (`firebase-sign-in-view.jsx:186-200`), lo que multiplica los fallos contra
  Firebase y acerca el bloqueo por abuso del usuario legítimo.

**Arreglo:** límite por IP y por identificador (p. ej. 10/min, 50/hora) en todas
las rutas de `/api/auth`, más Firebase App Check en el cliente.

---

## MEDIO

- **M-1 · Enumeración de usuarios en la recuperación.** `firebase-reset-password-view.jsx:131`
  distingue "No encontramos un miembro con ese usuario" de los demás mensajes.
  `acceso-con-codigo` sí lo hace bien (un único `NO_VALE`); imitarlo aquí.
- **M-2 · Contraseña mínima de 6 caracteres** (`clave-miembro/route.js:24`,
  `firebase-sign-in-view.jsx:84`, `primer-acceso-view.jsx:56`). Subir a 10-12 y
  contrastar contra una lista de contraseñas filtradas.
- **M-3 · Datos personales en los registros del servidor.**
  `claves-miembro.js:404` vuelca `{uid, idMiembros, rol, cargos}` en cada fallo de
  permiso; varios `console.error` sueltan objetos de error de Firebase que llevan
  correos dentro. En producción, registrar identificadores opacos.
- **M-4 · Sin cabeceras de seguridad.** `next.config.mjs` solo define cabeceras
  para `sw.js` y el manifiesto. Faltan `Content-Security-Policy`,
  `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options`,
  `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy`.
- **M-5 · `requireRole` y `identificarSolicitante` no coinciden.** El primero lee
  `decoded.rol` (custom claims), el segundo lee Firestore y suma cargos. Los claims
  solo se ponen si alguien llama a mano a `/api/admin/set-user-claims`, así que hay
  usuarios legítimos que fallan en unas rutas y pasan en otras. Unificar en una
  única función de autorización del servidor.
- **M-6 · `set-user-claims` acepta el rol desde Firestore.** `route.js:82` usa
  `caller.rol || callerAssignment?.rolId`, y `usuarios_roles` es escribible por
  cualquier autenticado si las reglas desplegadas son las abiertas (ver V-1): eso
  convierte una escritura en Firestore en claims de administrador global.
  Cerrando C-1/V-1 se cierra esto, pero conviene exigir el claim y no el documento.
- **M-7 · El custom token no revoca sesiones previas.** `acceso-con-codigo` emite
  un token nuevo sin invalidar los existentes; si la cuenta ya estaba comprometida,
  el intruso sigue dentro después de la recuperación. Llamar a
  `revokeRefreshTokens(uid)` al emitir el código y al cambiar la contraseña.
- **M-8 · Fallo abierto en `estado-clave`.** Ante un error devuelve
  `{ debeCambiarClave: null }` (`route.js:48`), y `primer-acceso-view.jsx:135`
  solo retira la pantalla si es `false` — el comportamiento es correcto, pero
  conviene fijarlo con una prueba, porque un cambio de signo ahí abre C-3.

---

## Contradicción a verificar antes de nada

### V-1 · Las reglas del repositorio no pueden ser las que están desplegadas

`firestore.rules:750-758` declara `usuarios_roles` y `admins` como
`allow write: if false`, y todas las colecciones exigen `estaAutenticado()`. Pero
el código hace justo lo contrario:

| Lo que hace el código | Dónde | Qué dicen las reglas |
|---|---|---|
| Escribe en `usuarios_roles` desde el navegador | `admin-permissions-service.js:96`, `firebase-admins.js:358+`, `account-change-password.jsx:162`, `member-auth-provisioning-service.js` | `write: if false` |
| Escribe en `admins` desde el navegador | `account-general.jsx:107`, `admin-permissions-service.js:93` | `write: if false` |
| Lee `admins` **sin sesión** (login e "olvidé mi contraseña" de administrador) | `admin-profile.js:127` vía `resolveAdminSignInEmail` | `read: if estaAutenticado()` |
| Lee `usuarios_roles`/`users`/organigrama y **crea una notificación sin sesión** | `solicitudes-cambio-notificaciones-service.js:410` desde la pantalla de recuperación | requiere sesión |

O esos flujos están rotos en producción, o **las reglas desplegadas son más
abiertas que las del repositorio** — que es la hipótesis probable, y entonces la
base de datos está esencialmente abierta.

**Qué hacer primero:** comparar lo desplegado con el repositorio (pestaña Rules de
la consola de Firebase) y decidir a conciencia. La salida buena es mover esas
cuatro operaciones al servidor con el Admin SDK y desplegar las reglas cerradas.

---

## Plan de salida a producción

**Bloqueantes (antes de abrir)**
1. Cerrar el alta pública de cuentas y sustituir `estaAutenticado()` por
   `esUsuarioDelSistema()` (C-1).
2. Verificar qué reglas están desplegadas y desplegar las cerradas (V-1).
3. Autenticar `GET /api/members/` y todas las rutas de escritura de A-6;
   `middleware.ts` con lista blanca.
4. Contraseñas iniciales aleatorias + migración de las cuentas que sigan con la
   derivada (C-3).
5. Sacar `clavesAnteriores` y `codigoRestablecimiento` a una colección privada (C-4).
6. Validar alcance y jerarquía en `codigo-restablecimiento` y en
   `correo-cuenta-miembro` (C-5).
7. Arreglar o retirar la pantalla de cambio de contraseña (A-2).

**Semana uno**
8. Reautenticación para cambiar contraseña + `revokeRefreshTokens` (A-3, M-7).
9. `debeCambiarClave` en los claims y aplicado en el servidor (A-4).
10. Rate limiting en `/api/auth/*` y Firebase App Check (A-7).
11. Dejar de cachear permisos en `sessionStorage` (A-5).
12. Cabeceras de seguridad en `next.config.mjs` (M-4).

**Endurecimiento continuo**
13. Unificar la autorización del servidor en una sola función (M-5, M-6).
14. Mínimo de contraseña a 12 y lista de contraseñas filtradas (M-2).
15. Cerrar el comodín de `firestore.rules` colección por colección.
16. Auditoría de toda emisión de código y de todo cambio de correo de acceso (C-5).
17. Limpiar datos personales de los registros del servidor (M-3).
18. Mensajes uniformes en la recuperación (M-1).
19. Pruebas automatizadas del flujo de acceso (hoy `tests/` cubre chat, directivas
    y admin, pero no autenticación).

**Higiene de secretos** — correcta hoy: `FIREBASE_SERVICE_ACCOUNT` solo en
`.env.local`, `.env*` ignorados por git, `next.config.mjs` solo expone
`NEXT_PUBLIC_*`. Mantener así, y rotar el service account antes de abrir al
público si alguna vez estuvo en un equipo compartido. Los directorios sin
versionar `outputs/`, `docs/backups/` y `.codex-spreadsheet-work/` conviene
revisarlos antes de cualquier commit masivo.

---

## Lo que está bien hecho (no tocar)

- El código de un solo uso: alfabeto sin caracteres confundibles, huella PBKDF2 en
  vez del código en claro, vencimiento, contador de intentos, mensaje único para
  "no existe / venció / no es", y muerte al usarse (`claves-miembro.js`,
  `acceso-con-codigo/route.js`).
- `correo-recuperacion`: comparar el correo propuesto contra el real de la cuenta
  con el Admin SDK evita el fallo que le cambiaba la contraseña a otra persona.
- El cierre de la solicitud para el segundo coordinador
  (`marcarSolicitudesRecuperacionAtendidas`), que evita que un código dictado por
  teléfono lo tumbe otro generado en paralelo.
- La comparación de huellas con `timingSafeEqual`.
- El caché upstream particionado por token (`buildScopedUpstreamKey`), que impide
  servir datos filtrados de un usuario a otro.


---

## Lo implementado

### C-2 · El padrón deja de ser público
`GET` y `DELETE` de `/api/members/` exigen un ID token válido
(`exigirSesion` en [src/server/require-role.js](../src/server/require-role.js)).
Verificado: sin token responde `401`.

Para que eso fuera posible, las tres pantallas de acceso dejaron de descargar el
padrón. Lo que necesitaban se resuelve ahora en el servidor, en
[src/server/miembros-directorio.js](../src/server/miembros-directorio.js), y de
ahí solo sale el dato concreto:

| Pantalla | Antes | Ahora |
|---|---|---|
| Iniciar sesión | `/api/members/` completo | `POST /api/auth/correo-acceso` con el número |
| Recuperar | `/api/members/` + organigrama + `usuarios_roles` desde el navegador | `POST /api/auth/recuperacion` |
| Primer acceso | `/api/members/` completo | `POST /api/auth/correo-disponible` (con sesión) |

`/api/auth/correo-recuperacion` quedó sin usar y se retiró.

### C-4 · Las huellas salen de la colección que todos leen
`clavesAnteriores` y `codigoRestablecimiento` viven en `secretos_acceso/{id}`,
con `allow read, write: if false`: solo entra el Admin SDK
([src/server/secretos-acceso.js](../src/server/secretos-acceso.js)). La migración
es sola: cada vez que un miembro cambia su clave o le generan un código, sus
huellas se mudan y se borra la copia del perfil.

### C-5 · Alcance y jerarquía al restablecer
[src/server/alcance-gestion-miembros.js](../src/server/alcance-gestion-miembros.js)
añade las dos preguntas que faltaban —¿está en su destacamento/sección/región? y
¿manda más que él?— a `codigo-restablecimiento` y a `correo-cuenta-miembro`. Un
Líder de Grupo ya no puede emitir una sesión para un cargo nacional, ni para
alguien de otro destacamento, ni para un administrador.

La decisión pura está en `alcance-gestion-miembros-core.mjs` con 13 pruebas
(`npm run test:acceso`).

### C-1 · Alta pública (parcial)
- Se retiró la ruta `/auth/firebase/sign-up` y su vista.
- `firestore.rules` ya no se fía de `estaAutenticado()` en las colecciones
  sensibles ni en el comodín: usa `esUsuarioDelSistema()`, que exige ficha en
  `usuarios_roles/{uid}` o `admins/{uid}` —documentos que solo escribe el
  servidor—.
- De paso: la regla del organigrama de destacamentos estaba escrita en camelCase
  y la colección real lleva guiones bajos, así que **no casaba con nada** y el
  organigrama caía en el comodín. Ahora existe con el nombre correcto.

**Falta, y solo se puede hacer en la consola de Firebase:** deshabilitar el alta
del proveedor «Correo/contraseña». Mientras siga activa, cualquiera puede crear
una cuenta llamando directamente a Identity Toolkit con la API key pública; lo
que cambia es que esa cuenta ya no ve nada. Conviene además activar App Check.

### A-1 y A-7 · Enumeración y fuerza bruta
- Límite de intentos por IP y por objetivo en las rutas sin sesión
  ([src/server/limite-intentos.js](../src/server/limite-intentos.js)):
  `acceso-con-codigo` 10/min por IP y 6/hora por número —esto último impide que
  un desconocido queme los códigos en curso—, `recuperacion` 10/min y 5/hora,
  `correo-acceso` 15/min. Verificado: el 429 salta.
- `correo-acceso` responde igual para un número que existe y uno que no.
- `recuperacion` usa un único mensaje para «no existe» y «no tiene correo
  propio».

`correo-acceso` sigue devolviendo el correo de la cuenta, porque el inicio de
sesión de Firebase lo necesita en el navegador. Eliminarlo del todo exige mover
el `signInWithPassword` al servidor (REST de Identity Toolkit); queda pendiente.

### Sigue pendiente, por orden
A-2 (la pantalla de cambio de contraseña no cambia nada), A-3 (reautenticación),
A-4 (`debeCambiarClave` en el servidor), A-5 (caché de permisos), A-6 (las 16
rutas de escritura sin guardia), C-3 (contraseña inicial derivada del código) y
todo el bloque MEDIO.
