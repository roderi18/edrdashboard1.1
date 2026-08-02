# Contrato de autorización de miembros por alcance (región/sección/destacamento)

Estado: **borrador para revisión**. Define el contrato que implementan, del mismo
lado, el backend **.NET** (`systexploradores.somee.com/api/Miembros`, sistema de
registro) y esta app Next.js (cliente + proxy). El objetivo: que ningún usuario
reciba —ni por API directa ni por el navegador— datos de miembros fuera de su
alcance.

## 1. Dónde vive cada cosa

| Dato | Ubicación real | Dónde se autoriza |
|---|---|---|
| Padrón de miembros | API .NET (sistema de registro) | **API .NET** (esta spec) |
| Estructura (regiones/secciones/destacamentos) | API .NET / rutas Next | API .NET |
| Salud, premios, historial | Firestore | Reglas de Firestore (doc aparte) |
| Roles/permisos/alcance del usuario | Firestore `usuarios_roles` + **custom claims** | — |

> El filtrado de cliente que ya existe (member-access.js) queda como **UX**, no
> como seguridad. La barrera real es el punto 4.

## 2. Identidad: token de Firebase

Toda llamada al API de miembros lleva el **ID token de Firebase** del usuario:

```
Authorization: Bearer <firebase_id_token>
```

- El **cliente** obtiene el token con `auth.currentUser.getIdToken()`.
- El **proxy Next** (`/api/members*`) reenvía ese header al .NET sin modificarlo.
- El **.NET valida el token** contra las llaves públicas de Google (JWKS):
  - Emisor: `https://securetoken.google.com/<PROJECT_ID>`
  - Audiencia: `<PROJECT_ID>` (hoy `systexploradores`)
  - Firma: JWKS de `https://www.googleapis.com/service_accounts/v1/jwks` (o el set
    de `securetoken`), con caché por `max-age`.
- Token ausente/invalid/expirado → **401**. Nunca se responde data sin token válido.

## 3. Alcance del usuario: custom claims

Esta app setea, al asignar el rol, estos **custom claims** en el token (los agrega
un endpoint server-side con firebase-admin; ver A2). El .NET los lee del token ya
validado, sin consultar Firestore:

```jsonc
{
  "rol": "usuario_region",            // código de rol
  "alcanceNivel": "region",           // destacamento | seccion | region | nacional | global
  "regiones":     ["12"],             // ids de región del alcance (vacío si no aplica)
  "secciones":    [],                 // ids de sección
  "destacamentos":[],                 // ids de destacamento
  "soloLectura":  true                // true → el .NET rechaza toda escritura (403)
}
```

- Los ids son **strings** y deben coincidir con los ids que el .NET guarda en cada
  miembro (`idRegion`/`idSeccion`/`idDestacamento`).
- Si el token no trae claims de alcance (usuario sin rol asignado) → sin acceso a
  miembros (**403**), fail-closed.

## 2.2 Notas de implementación del proxy (A3, este repo)

- Las 4 llamadas de `member-service` (listar/crear/editar/eliminar) adjuntan el
  `Authorization: Bearer` con el ID token; el proxy `/api/members*` lo **reenvía**
  al .NET.
- El caché en memoria del proxy (`upstream-cache`) se **particiona por token**
  (`somee:miembros:<hash>`), de modo que la respuesta filtrada de un usuario nunca
  se sirve a otro. Las mutaciones invalidan por prefijo (limpian todas las
  particiones).
- El cliente trata la respuesta del servidor como **autoritativa**: reemplaza su
  espejo en `localStorage` (no fusiona con el previo), para no arrastrar miembros
  fuera de alcance de sesiones anteriores.
- Caveat: en **fallo de red** el cliente cae al espejo local previo (modo offline);
  puede mostrar datos cacheados hasta reconectar. Aceptable como degradación.

## 4. Matriz de autorización por nivel

Para un miembro con `idDestacamento`, `idSeccion`, `idRegion`:

| `alcanceNivel` | Puede LEER un miembro si… |
|---|---|
| `global` | siempre |
| `nacional` | siempre (todo el país, solo lectura) |
| `region` | `miembro.idRegion ∈ claims.regiones` |
| `seccion` | `miembro.idSeccion ∈ claims.secciones` |
| `destacamento` | `miembro.idDestacamento ∈ claims.destacamentos` |

**Escritura (crear/editar/eliminar):** además de estar en alcance, el usuario no
debe ser de solo lectura. **Decisión (A2):** se expone un claim booleano
`soloLectura`. El .NET permite escritura solo si `soloLectura === false` **y** el
miembro está en alcance; si `soloLectura === true` responde **403** aunque el
miembro esté en alcance. Los arrays de alcance gobiernan la lectura; `soloLectura`
gobierna la escritura. (Extensible a futuro con claims de capacidad por operación
sin romper este contrato.)

## 3.1 Endpoint que setea los claims (A2, este repo)

- Ruta server-side Next con `firebase-admin` (p. ej. `POST /api/admin/set-user-claims`).
- **Solo un administrador** con permiso de gestión de roles puede invocarlo: el
  endpoint valida el token del **llamante** y verifica su rol antes de actuar
  (evita escalación de privilegios).
- Lee la asignación del usuario objetivo en `usuarios_roles` (rolId + alcance) y
  deriva `alcanceNivel`, los arrays de ids y `soloLectura` desde el catálogo
  (`role-permissions.js`, única fuente de verdad).
- Setea los custom claims con `admin.auth().setCustomUserClaims(uid, claims)`.
- Se invoca después de `guardarAsignacionRolUsuario`. El cliente refresca su token
  con `getIdToken(true)` para que los nuevos claims tomen efecto.
- Requiere un **service account** en el entorno (`FIREBASE_SERVICE_ACCOUNT`), nunca
  versionado.

## 5. Reglas por endpoint (.NET)

| Endpoint | Regla |
|---|---|
| `GET GetAllMiembros` | Devuelve **solo** los miembros dentro del alcance (filtro server-side por la matriz del punto 4). Nacional/global: todos. |
| `GET GetMiembro?id=` | 404/403 si el miembro no está en el alcance del llamante. |
| `POST SetMiembros` | 403 si el destacamento destino no está en el alcance o el rol es solo-lectura. |
| `POST UpdateMiembros` | 403 si el miembro no está en alcance o el rol es solo-lectura. |
| `DELETE DeleteMiembro` | 403 si el miembro no está en alcance o el rol no puede eliminar. |

Toda decisión de denegar se registra en el log de auditoría del .NET (uid + acción
+ id de miembro).

## 6. Comportamiento fail-closed (resumen)

- Sin token / token inválido → 401.
- Token válido sin claims de alcance → 403.
- Fuera de alcance → el registro **no aparece** (listas) o 403/404 (por id).
- Escritura sin permiso → 403.

## 7. Trabajo por lado

- **Este repo (Next):** A2 (custom claims con firebase-admin), A3 (enviar/reenviar
  el token), A5 (reglas Firestore para salud/premios/historial).
- **Backend .NET (A4):** validar el token (JWKS), leer claims, aplicar los puntos
  4–6 en cada endpoint de `Miembros` (y equivalentes de estructura).
