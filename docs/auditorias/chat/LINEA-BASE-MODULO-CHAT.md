# Línea base verificable del módulo `/chat`

Fecha: 5 de agosto de 2026

Rama: `main`

Commit inicial: `d3677f7`

## Propósito

Esta línea base fija el estado técnico previo a las correcciones del módulo de mensajería. Permite comparar seguridad, comportamiento, rendimiento y pruebas después de cada punto aprobado.

## Flujos inspeccionados

- `GET /api/chat?endpoint=contacts`: carga el directorio utilizado para iniciar conversaciones.
- `GET /api/chat?endpoint=conversations`: lista conversaciones del miembro.
- `GET /api/chat?endpoint=conversation`: recupera una conversación y sus mensajes recientes.
- `GET /api/chat?endpoint=older-messages`: pagina mensajes anteriores.
- `GET /api/chat?endpoint=mark-as-seen`: restablece el contador no leído.
- `POST /api/chat`: crea conversaciones individuales o grupales.
- `PUT /api/chat`: envía mensajes.
- `PATCH /api/chat`: edita, elimina, restaura y reacciona a mensajes; también silencia, reporta, limpia, anuncia escritura y administra participantes.

## Identidad antes de la corrección

Los cuatro métodos de la API confiaban en `idMiembros` recibido desde query o body. No verificaban un token Firebase en el endpoint. Por tanto, el navegador podía declarar qué miembro ejecutaba una operación.

Casos de regresión definidos:

1. Solicitud sin token.
2. Encabezado que no usa `Bearer`.
3. Token inválido o expirado.
4. Token verificado sin `uid`.
5. Usuario autenticado sin vínculo con `idMiembros`.
6. Perfil de miembro inactivo.
7. Perfiles o claims con identificadores contradictorios.
8. Query o body que intenta suplantar otro `idMiembros`.
9. Remitente o creador que intenta usar un identificador diferente al autenticado.

Las pruebas ejecutables están en `tests/chat` y se ejecutan con `npm run test:chat-auth`.

## Persistencia y configuración

Colecciones utilizadas directamente por el módulo:

- `conversaciones_chat`.
- Subcolección `conversaciones_chat/{id}/mensajes`.
- `users`, `usuarios_roles` y `admins` para perfiles.
- Colecciones de notificaciones definidas por `COLECCIONES_NOTIFICACIONES`.
- `fotos` para imágenes de perfil.

Configuración versionada al establecer esta línea base:

- `firebase.json` solo referencia `storage.rules`.
- No existe `firestore.rules` versionado.
- No existe un archivo de índices de Firestore versionado.
- `storage.rules` no contiene una coincidencia para rutas `chat/...`.

Las reglas de Firestore, Storage y los índices se corregirán en los puntos pendientes correspondientes; no forman parte de los puntos 1 y 2.

## Métricas iniciales disponibles

- Lint dirigido de la auditoría original: código de salida 0.
- Build de producción de la auditoría original: aproximadamente 107.3 segundos.
- Tiempo de compilación informado: aproximadamente 78 segundos.
- Páginas generadas por Next.js: 258.
- Polling de conversaciones y conversación activa: 45 segundos como red de seguridad adicional al tiempo real.
- Página inicial de mensajes: 30 mensajes por conversación.
- Caché del endpoint externo de miembros: deshabilitada mediante `cache: 'no-store'`.

No existían métricas instrumentadas de p50/p95/p99, lecturas de Firestore por sesión, tasa de errores, mensajes por segundo o usuarios concurrentes. Esa instrumentación permanece en el punto de observabilidad y rendimiento.

## Criterio de aceptación de autenticación

- Toda operación de `/api/chat` exige un token Firebase válido.
- El servidor deriva `uid` e `idMiembros`; no los acepta como identidad desde query o body.
- Un usuario sin vínculo activo con un miembro recibe una denegación explícita.
- Los intentos de suplantar remitente o creador se reemplazan por la identidad autenticada.
- La ausencia de Firebase Admin produce una respuesta controlada de servicio no configurado.
- Las pruebas de `tests/chat` pasan, junto con el lint dirigido y el build completo.

## Resultado al cerrar los puntos 1 y 2

- Fase roja: las pruebas de regresión fallaron porque no existía el autenticador, los cuatro métodos no lo invocaban y la ruta todavía leía `idMiembros` desde query/body.
- Fase verde: 18 de 18 pruebas de autenticación e identidad pasaron.
- Lint dirigido a los archivos modificados: código de salida 0.
- Build de producción final: código de salida 0; compilación en 48 segundos y generación de 258 páginas en 16.6 segundos.
- Prueba HTTP local del build: `/api/chat` respondió `503` con el código controlado `CHAT_AUTH_SERVER_NOT_CONFIGURED` al no existir credencial de Firebase Admin.
- Estado de configuración local: `FIREBASE_SERVICE_ACCOUNT` no está definido. La prueba de integración con un token Firebase real no puede ejecutarse hasta instalar esa credencial en el entorno; no se versionó ni se imprimió ningún secreto.
- Lint global del repositorio: continúa fallando por deuda previa fuera de este alcance (168 errores y 236 advertencias). Los archivos de esta implementación pasan el lint dirigido y el build completo sí termina correctamente.

## Separación de alcance

Esta fase autentica y vincula la identidad. La autorización completa por participación, permisos y alcance organizacional corresponde al punto 3 y permanece pendiente.
