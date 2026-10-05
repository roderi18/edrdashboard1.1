# Entorno de QA igual a producción (Firebase + servidores)

> Esta es la guía operativa de creación y refresco de QA. El diseño completo de
> Desarrollo → QA → Producción y sus fases de ejecución está en
> [`plan-ambientes-desarrollo-qa-produccion.md`](./plan-ambientes-desarrollo-qa-produccion.md).

Guía para montar un **segundo entorno (QA)** con la misma base de datos de
Firebase, sus archivos, sus usuarios y su propio servidor, sin que nada de lo
que se haga en QA toque producción ni a personas reales.

> Estado actualizado (05/10/2026): existen Producción, Desarrollo y QA.
> Firestore, Authentication y Storage de QA ya fueron poblados y verificados.
> App Hosting y los secretos de servidor continúan pendientes.

---

## 1. Cómo está hoy

| Pieza | Producción |
|---|---|
| Proyecto de Firebase | `systexploradores` (`.firebaserc` → `prod`) |
| Bucket de Storage | `systexploradores.firebasestorage.app` |
| Hosting actual | Firebase App Hosting, backend heredado `explora` (`apphosting.yaml`), `https://explora--systexploradores.us-central1.hosted.app` |
| Nombre objetivo | **EXPEDITION**; backends `expedition-dev`, `expedition-qa` y `expedition` |
| Secretos (Secret Manager) | `FIREBASE_SERVICE_ACCOUNT`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `TAREAS_PROGRAMADAS_SECRETO` |
| Reglas e índices | `firestore.rules`, `firestore.indexes.json`, `storage.rules` (en el repositorio) |
| Padrón | API .NET `https://systexploradores.somee.com/api` (**fuera de Firebase, una sola**) |
| Tareas programadas | Cloud Scheduler → `/api/tareas/*` (horario en `src/utils/tareas-programadas.mjs`) |

Lo que la aplicación sabe del proyecto lo lee de las variables
`NEXT_PUBLIC_FIREBASE_*` (se incrustan **al compilar**) y de la cuenta de servicio
`FIREBASE_SERVICE_ACCOUNT` (en el servidor). Un entorno nuevo = otros valores en
esas variables.

---

## 2. Decisiones que hay que tomar ANTES de empezar

1. **¿Qué hace QA con la API .NET?** Es lo que más cambia el plan (ver §6.1).
   - a) QA lee de producción y **no escribe** (guarda en `/api/*`).
   - b) Hay una API .NET de pruebas con una copia de su base de datos.
   - c) QA escribe en producción (**no recomendado**: el padrón real cambia).
2. **¿Datos reales o anonimizados?** Es el padrón de una organización juvenil
   (menores, salud, tutores, teléfonos). Ver §6.5.
3. **¿Copia única o refresco periódico?** Si QA debe parecerse a producción con
   el tiempo, conviene dejar el refresco en un script (§8). **Siempre de
   producción a QA, nunca al revés.**
4. **Nombre del proyecto de QA.** En esta guía: `systexploradores-qa`.

---

## 3. Lo que solo puede hacer el dueño de la cuenta

Son pasos de cuenta, facturación o credenciales:

- [x] Crear el proyecto `systexploradores-qa` en la consola de Firebase.
- [ ] Activar el plan **Blaze** en **los dos** proyectos (export/import de
      Firestore y App Hosting lo exigen).
- [x] Registrar la app web en QA y anotar su configuración (`apiKey`,
      `authDomain`, `messagingSenderId`, `appId`).
- [ ] Activar en QA: Firestore y Authentication ya están activos; faltan
      proveedores externos y Storage.
- [x] Copiar los **parámetros del hash de contraseñas** de producción: Consola →
      Authentication → Users → ⋮ → *Password hash parameters* (`base64_signer_key`,
      `base64_salt_separator`, `rounds`, `mem_cost`). **No se guardan en el
      repositorio.**
- [ ] Generar la cuenta de servicio de QA (Configuración → Cuentas de servicio →
      Generar clave) para el secreto `FIREBASE_SERVICE_ACCOUNT` de QA.
- [ ] Dar los valores de los secretos de QA (§5.3).

---

## 4. Preparación local

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

```bash
gcloud auth login
```

Alias de proyectos en `.firebaserc`:

```json
{
  "projects": {
    "default": "systexploradores-dev",
    "dev": "systexploradores-dev",
    "prod": "systexploradores",
    "qa": "systexploradores-qa"
  }
}
```

> `default` apunta a Desarrollo para reducir el riesgo de desplegar
> accidentalmente en Producción. Para QA y Producción siempre se usa `-P qa` o
> `-P prod` de forma explícita.

---

## 5. Paso a paso

### 5.1 Reglas e índices (primero, antes de meter datos)

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage -P qa
```

Así QA nace con las mismas reglas y no queda un rato con Firestore abierto.

### 5.2 Firestore (todas las colecciones y subcolecciones)

1. Bucket intermedio para el export (en producción):

```bash
gcloud storage buckets create gs://systexploradores-exports --project=systexploradores --location=us-central1
```

2. Exportar producción entera:

```bash
gcloud firestore export gs://systexploradores-exports/AAAA-MM-DD --project=systexploradores
```

3. Dar permiso de lectura del bucket a la cuenta de servicio de Firestore **de QA**
   (`service-<NUMERO_PROYECTO_QA>@gcp-sa-firestore.iam.gserviceaccount.com`):

```bash
gcloud storage buckets add-iam-policy-binding gs://systexploradores-exports --member=serviceAccount:service-NUMERO_QA@gcp-sa-firestore.iam.gserviceaccount.com --role=roles/storage.objectViewer
```

4. Importar en QA:

```bash
gcloud firestore import gs://systexploradores-exports/AAAA-MM-DD --project=systexploradores-qa
```

Notas:
- El import **sobrescribe** los documentos con el mismo id y **no borra** lo que
  QA tenga de más. Para una copia limpia, vaciar QA antes
  (`firebase firestore:delete --all-collections -P qa`; **comprobar `-P qa` dos
  veces**).
- Conserva tipos (Timestamp, GeoPoint, referencias). Las **referencias**
  (`DocumentReference`) siguen apuntando a la ruta, no al proyecto, así que valen.
- Se cobra por documento leído y escrito. Con el volumen actual es poco, pero no
  es gratis.
- El export queda en el bucket: borrarlo o ponerle caducidad (lleva datos de
  personas).

### 5.3 Storage (fotos, `everest/`, `directiva-historica/`, tienda…)

```bash
gcloud storage cp -r "gs://systexploradores.firebasestorage.app/*" gs://systexploradores-qa.firebasestorage.app/
```

- Valorar **excluir `respaldos/`** (es pesado y QA no lo necesita):
  `gcloud storage rsync -r -x "^respaldos/" gs://ORIGEN gs://DESTINO`.
- La copia conserva los metadatos, **incluido el token de descarga**
  (`firebaseStorageDownloadTokens`), así que la URL de QA funciona con el mismo
  token cambiando solo el bucket (§6.2).

### 5.4 Authentication (usuarios con su mismo UID)

```bash
firebase auth:export usuarios-prod.json --format=json -P prod
```

```bash
firebase auth:import usuarios-prod.json --hash-algo=SCRYPT --hash-key=BASE64_SIGNER_KEY --salt-separator=BASE64_SALT_SEPARATOR --rounds=8 --mem-cost=14 -P qa
```

- Los valores de `--hash-key`, `--salt-separator`, `--rounds` y `--mem-cost` son
  los de §3. Sin ellos se importan los usuarios, pero **nadie puede entrar con su
  contraseña**.
- Se conservan los **UID**, que es lo que enlaza la cuenta con Firestore
  (`users/{uid}`, roles, chat…). Sin el mismo UID, QA no sirve.
- `usuarios-prod.json` lleva correos y hashes: **borrarlo al terminar** y nunca
  subirlo al repositorio.
- Añadir el dominio de QA en Authentication → Settings → *Authorized domains*.

### 5.5 Servidor (App Hosting de QA)

1. Crear el backend `expedition-qa` en QA:

```bash
firebase apphosting:backends:create -P qa
```

   (rama `qa`; región `us-central1`).

2. Archivo de entorno `apphosting.qa.yaml` (App Hosting lo combina con
   `apphosting.yaml` cuando el entorno del backend se llama `qa`). Solo lo que
   cambia:

```yaml
env:
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: <apiKey de QA>
  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: systexploradores-qa.firebaseapp.com
  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: systexploradores-qa
  - variable: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    value: systexploradores-qa.firebasestorage.app
  - variable: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    value: '<de QA>'
  - variable: NEXT_PUBLIC_FIREBASE_APPID
    value: <appId de QA>
  - variable: WEB_PUSH_VAPID_SUBJECT
    value: https://expedition-qa--systexploradores-qa.us-central1.hosted.app
    availability:
      - RUNTIME
```

3. Secretos de QA (**valores nuevos**, no los de producción):

```bash
firebase apphosting:secrets:set FIREBASE_SERVICE_ACCOUNT -P qa
```

```bash
firebase apphosting:secrets:set WEB_PUSH_VAPID_PRIVATE_KEY -P qa
```

```bash
firebase apphosting:secrets:set TAREAS_PROGRAMADAS_SECRETO -P qa
```

   - `FIREBASE_SERVICE_ACCOUNT`: el JSON de la cuenta de servicio de QA (§3).
   - `WEB_PUSH_VAPID_PRIVATE_KEY`: un **par VAPID nuevo** (`npx web-push
     generate-vapid-keys`); la pública va donde la lea el cliente.
   - `TAREAS_PROGRAMADAS_SECRETO`: uno nuevo, distinto del de producción.

4. Dar acceso a los secretos al backend:

```bash
firebase apphosting:secrets:grantaccess FIREBASE_SERVICE_ACCOUNT,WEB_PUSH_VAPID_PRIVATE_KEY,TAREAS_PROGRAMADAS_SECRETO --backend=<backend-qa> -P qa
```

> **No quitar** `serverExternalPackages: ['firebase-admin']` de `next.config`:
> sin eso revientan las rutas `/api/auth/*`, también en QA.

### 5.6 Tareas programadas (Cloud Scheduler)

Por defecto, **no crearlas en QA**. Si hace falta probar alguna, crearla a mano
con la URL y el secreto de QA y pausarla al terminar.

| Tarea | Ruta | Hora (Santo Domingo) | Riesgo en QA |
|---|---|---|---|
| Cumpleaños | `/api/tareas/cumpleanos-diarios` | 07:00 | Chat de Sistema y campana; push a personas reales si quedan suscripciones |
| Resumen de actualizaciones | `/api/tareas/resumen-actualizaciones-diario` | 09:00 | Avisos duplicados |
| Salud diaria | `/api/tareas/salud-sistema-diaria` | 16:00 | Escribe al chat "ADMINISTRADORES GLOBALES" de QA |
| Salud cada hora | `/api/tareas/salud-sistema-cada-hora` | cada hora salvo 16:00 | Llama a los 7 servicios de la API .NET real |
| Respaldo diario | `/api/tareas/respaldo-diario` | 23:00 | Descarga el padrón de la API .NET y duplica Storage (coste) |

Los comandos de producción salen de `scripts/crear-tareas-programadas.mjs`.
Si se usa para QA, comprobar que apunte al proyecto, la URL y el secreto de QA.

---

## 6. Riesgos y cómo cerrarlos

### 6.1 La API .NET es una sola (el riesgo mayor)

El padrón (miembros, destacamentos, secciones, regiones, iglesias, cargos,
tutores) vive en `systexploradores.somee.com`, **no en Firebase**. Ninguna copia
de Firebase lo duplica. Además, la URL está **escrita a mano en ~34 archivos**
de `src/` (las rutas `/api/*` y `src/server/tareas/respaldo-diario.mjs`), no en
una variable.

Con la opción a) de §2, en QA cualquier edición de un miembro, destacamento,
sección o región iría al padrón **real**. Para cerrarlo:

1. Sacar la URL a una variable (`DOTNET_API_URL`) con producción como valor por
   defecto, en un solo sitio (por ejemplo, junto a `fetchUpstreamText` en
   `src/utils/upstream-cache.js`).
2. Añadir una bandera `SOLO_LECTURA_PADRON=1` en QA que haga responder **403** a
   las rutas que escriben (`*/post`, `*/put`, borrados).
3. Test que lo cubra (por ejemplo, `tests/admin/qa-no-escribe-en-el-padron.test.mjs`).

Con la opción b): misma variable, apuntando a la API de pruebas.

### 6.2 Las URL de Storage guardadas en Firestore apuntan a producción

Fotos de perfil, colección `fotos` (`principalTarjeta/...`), tienda, insignias
personalizadas, directiva histórica, adjuntos del chat… se guardan como URL
completas:

```
https://firebasestorage.googleapis.com/v0/b/systexploradores.firebasestorage.app/o/...?alt=media&token=...
```

Copiadas tal cual, **QA pinta las imágenes de producción**, y lo que se suba o
borre en QA no coincide con lo que se ve. Hace falta un script (Admin SDK, con la
cuenta de servicio **de QA**) que recorra todas las colecciones y subcolecciones
y sustituya en cada cadena:

```
/b/systexploradores.firebasestorage.app/  →  /b/systexploradores-qa.firebasestorage.app/
```

(también la forma `systexploradores.appspot.com` si aparece). El token sirve tal
cual porque la copia de §5.3 lo conserva.

Ojo: `src/app/api/directiva-cuatrienios/congelar-foto/route.js` solo acepta
fotos de `firebasestorage.googleapis.com` **de su propio bucket**. Sin esta
reescritura, en QA no se puede congelar la foto de la directiva.

### 6.3 Notificaciones push a móviles reales

La colección `web_push_subscriptions` guarda los navegadores **reales** de las
personas. Si QA manda un aviso con la misma clave VAPID, **llega a su móvil**.

- Vaciar `web_push_subscriptions` en QA justo después del import.
- Y usar otro par VAPID en QA (§5.5): con otra clave, las suscripciones viejas
  dejan de servir aunque quede alguna.

### 6.4 Que algo apunte a producción a mano

Revisado (04/10/2026): `respaldo-diario.mjs`, `salud-sistema.mjs`,
`chat-storage-rest.mjs`, `fotos-webp.mjs` y `congelar-foto/route.js` construyen
el bucket con `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` o el id del proyecto, así que
siguen a la variable. **Lo único fijo es la API .NET (§6.1).** Antes del primer
despliegue de QA, buscar de nuevo:

```bash
grep -rn "systexploradores" src --include=*.js --include=*.jsx --include=*.mjs
```

Todo lo que no sea `somee.com` debería salir de una variable.

### 6.5 Datos de personas

QA con datos reales es **otra copia** del padrón de menores: salud, tutores,
teléfonos, correos, fotos.

- Acceso al proyecto de QA solo para quien lo necesita (IAM), no "editor" para
  todos.
- Valorar un script de **anonimización** tras el import: nombres, teléfonos,
  correos, direcciones, datos de salud y de tutores. Si se anonimizan los
  correos, **también en Auth** (o nadie podrá entrar con su correo real, que
  quizá es justo lo que se quiere).
- Borrar el export intermedio (§5.2) y `usuarios-prod.json` (§5.4) al terminar.
- `.gitignore` ya excluye los `.env`; no dejar ninguna clave de QA en el
  repositorio.

### 6.6 Correos y avisos a personas

Si alguna ruta manda correos (por ejemplo `src/app/api/auth/correo-cuenta-miembro`),
en QA puede escribir a direcciones reales. Revisar y desactivar o redirigir en
QA antes de abrirlo a pruebas.

### 6.7 Que QA se distinga a simple vista

Fácil equivocarse de pestaña. Recomendado: una franja o etiqueta "QA" en el menú
cuando `NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'systexploradores'`.

---

## 7. Comprobación al terminar

- [ ] Entrar en QA con un usuario real (misma contraseña) y ver su perfil.
- [ ] Las fotos cargan **desde el bucket de QA** (pestaña Red del navegador).
- [ ] Editar algo de Firestore en QA y comprobar que en producción **no** cambió.
- [ ] Intentar editar un miembro en QA: responde lo que se decidió en §6.1.
- [ ] `web_push_subscriptions` vacía en QA.
- [ ] Ninguna tarea de Cloud Scheduler de QA activa sin querer.
- [ ] `/dashboard/admin/health` en QA en verde (salvo lo que dependa de la API .NET).
- [ ] Borrados el export intermedio y `usuarios-prod.json`.

---

## 8. Refrescar QA más adelante

Orden, siempre **de producción a QA**:

1. Export de Firestore (§5.2) → vaciar QA → import.
2. `gcloud storage rsync` de Storage (§5.3).
3. Export/import de Auth (§5.4).
4. Reescritura de URL (§6.2), vaciar `web_push_subscriptions` (§6.3) y, si se
   eligió, anonimizar (§6.5).

Conviene juntarlo en un solo script (por ejemplo
`scripts/refrescar-qa-desde-produccion.mjs`) que **se niegue a correr** si el
proyecto de destino es `systexploradores`.

---

## 9. Qué hay que programar en el repositorio

| Pieza | Para qué |
|---|---|
| Alias `prod`/`qa` en `.firebaserc` | Desplegar sin equivocarse de proyecto |
| `apphosting.qa.yaml` | Variables públicas de QA |
| `DOTNET_API_URL` + `SOLO_LECTURA_PADRON` | §6.1 |
| `scripts/reescribir-urls-storage.mjs` | §6.2 |
| `scripts/refrescar-qa-desde-produccion.mjs` | §8 (con la guarda contra producción) |
| Script de anonimización (opcional) | §6.5 |
| Etiqueta "QA" en la interfaz | §6.7 |
| Test de la guarda del padrón | Regla nueva de negocio → test nuevo |
