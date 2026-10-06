# Auditoría de seguridad

Registro de lo que pasa en el acceso a la aplicación: quién hizo qué, a quién, desde
qué IP, cuándo y con qué resultado. Lo escribe **solo el servidor**.

## Por qué existe

Antes, las 16 rutas de `/api/auth` y `/api/admin` no dejaban rastro. Generar un
código de recuperación, entrar con él, cambiar la contraseña o el correo de acceso
(que es quedarse con la cuenta), repartir roles o entrar como otra persona pasaba
sin constancia. Lo mismo un bloqueo por intentos o un 403. La auditoría de negocio
(`auditoria_sistema`) la escribe el navegador: quien se salta la pantalla no la
genera.

## Dónde queda

Cada evento va a **dos sitios**:

1. **Logs del servidor (Cloud Logging)**, siempre, como una línea JSON con
   `severity` (`INFO` si salió bien, `WARNING` si no). Es la copia que no depende
   de nada.
2. **Firestore, colección `auditoria_seguridad`**, salvo lo muy frecuente (ver
   abajo). Solo la lee el Administrador Global; nadie la escribe, corrige ni borra
   desde el navegador (`firestore.rules`), tampoco él.

## Qué se registra

| Acción | Cuándo | ¿Firestore? |
|---|---|---|
| `codigo_recuperacion_generado` / `_denegado` | Un coordinador genera (o intenta, fuera de su alcance) un código | Sí |
| `acceso_con_codigo` | Entrada con código: acierto o fallo (con motivo) | Sí |
| `codigo_recuperacion_congelado` | 5 fallos seguidos congelan el código 15 min | Sí |
| `recuperacion_consultada` | "Olvidé mi contraseña": a qué número | Sí |
| `ayuda_coordinador_solicitada` | Petición de ayuda al coordinador | Sí |
| `correo_de_acceso_consultado` | Cada búsqueda del correo con el que se entra | **Solo log** |
| `clave_cambiada` | Nueva contraseña (y sesiones anteriores cerradas) | Sí |
| `correo_acceso_cambiado` / `_denegado` | Cambio del correo de acceso: de cuál a cuál | Sí |
| `cuenta_creada` | Alta de una cuenta de acceso | Sí |
| `sesion_iniciada` | Inicio de sesión (contraseña o código escritos hace < 5 min) | Sí |
| `rol_administracion_asignado` / `_denegado` | Dar o quitar un rol de administración | Sí |
| `claims_fijados` | Reescritura de los claims de una cuenta | Sí |
| `rol_propio_cambiado` | El Administrador Global se pone otro rol para probar | Sí |
| `roles_sincronizados` | Sincronización masiva de roles (solo al aplicar) | Sí |
| `rol_sincronizado` | El cargo de alguien cambió por la directiva | Sí |
| `administrador_global_creado` | Una cuenta autorizada recibe Administrador Global sola | Sí |
| `suplantacion_iniciada` / `_terminada` / `_denegada` | "Probar como usuario" | Sí |
| `limite_superado` | Alguien choca con un límite de intentos | Sí (1 por ventana) |
| `acceso_denegado` | 403 de `requireRole`/`exigirSesion` y rutas de roles | Sí (1 cada 10 min por persona y ruta) |
| `sesion_revocada_usada` | Se usa un token ya revocado | Sí (1 cada 10 min) |
| `padron_consultado` | Alguien descarga el padrón (`/api/members`) | **Solo log** (1 cada 10 min por cuenta) |

**Nunca se registra**: contraseñas, códigos de un solo uso, tokens, huellas ni sales.
`limpiarDetalle` los quita aunque alguien los pase por error.

## Cómo consultarlo

**Firestore**: consola de Firebase → Firestore → `auditoria_seguridad`, ordenado por
`fecha`. Campos: `accion`, `resultado`, `actor`, `objetivo`, `detalle`, `ip`,
`userAgent`, `ruta`, `fecha`.

**Cloud Logging** (Logs Explorer), por ejemplo, todo lo que no salió bien hoy:

```
jsonPayload.tipo="auditoria_seguridad"
severity>=WARNING
```

O una acción concreta: `jsonPayload.accion="correo_acceso_cambiado"`.

## Retención (hay que activarla una vez)

Cada evento lleva `expiraEn` = fecha + 400 días (`RETENCION_DIAS`). Firestore solo
lo borra si se activa la política TTL de la colección:

```bash
gcloud firestore fields ttls update expiraEn --collection-group=auditoria_seguridad --enable-ttl --project=systexploradores
```

Los logs de Cloud Logging se guardan 30 días en el bucket `_Default`. Si se
quieren más, se crea un bucket con más retención y un sink con el filtro
`jsonPayload.tipo="auditoria_seguridad"`.

## Orden de despliegue

1. **Primero la aplicación** (el servicio de auditoría ya manda `registradoPorUid`).
2. **Después `firestore.rules`**: exige esa firma en `auditoria_sistema` y limita
   quién la lee. Si las reglas van primero, los navegadores con la versión vieja
   abierta no podrán escribir auditoría hasta recargar.

## La IP

Se lee desde la derecha de `x-forwarded-for` (`src/server/ip-del-cliente.mjs`),
con un salto de confianza por defecto (el balanceador de App Hosting). Si en
producción se ve siempre la misma IP para todos, o la del balanceador, ajusta
`PROXIES_DE_CONFIANZA` (0 = la última de la lista).

## Piezas

- Reglas y forma del evento: `src/utils/auditoria-seguridad.mjs`
- Escritura (Admin SDK + log): `src/server/auditoria-seguridad.js`
- Test: `tests/admin/auditoria-de-seguridad.test.mjs`
