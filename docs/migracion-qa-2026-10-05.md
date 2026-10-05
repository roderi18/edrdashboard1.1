# Migración de EXPEDITION a QA — 5 de octubre de 2026

## Estado

Proyecto: `systexploradores-qa`  
Nombre visible: **EXPEDITION QA**  
Rama de trabajo: `environment-migration`

## Completado

- Firestore `(default)` creado en `nam5`.
- Reglas e índices compilados y desplegados.
- Copia cargada desde el respaldo controlado de Producción:
  - 110 colecciones raíz.
  - 11.974 documentos, incluyendo subcolecciones.
  - Firma de origen y destino idéntica:
    `9ba7b10707d5540db1a98890c9d0fe7a571af29c0f4f702c86fccfb941c3d45d`.
- Firebase Authentication inicializado.
- 56 usuarios importados y verificados por UID.
- Acceso por correo/contraseña habilitado con la política del origen.
- App web `EXPEDITION QA Web` registrada.
- Storage activado y reglas desplegadas.
- 2.073 objetos copiados desde Producción y verificados por nombre, tamaño,
  checksum, metadatos y token de descarga (394.585.296 bytes).
- 5.222 referencias en 2.593 documentos de Firestore reescritas para apuntar a
  `systexploradores-qa.firebasestorage.app`; ninguna de esas referencias sigue
  apuntando a Producción.
- Alias `qa` agregado a `.firebaserc`.
- Variables públicas guardadas en `.env.qa.local`, excluido de Git.
- Credencial administrativa y clave privada de Web Push de Producción bloqueadas
  intencionalmente en la configuración local de QA.

## Pendiente

1. Crear App Hosting y el backend `expedition-qa`.
2. Crear una cuenta de servicio exclusiva para QA.
3. Configurar Google Sign-In con un cliente OAuth propio. Uno de los 56 usuarios
   importados tiene una identidad Google vinculada.
4. Configurar Apple Sign-In solo si será probado en QA.
5. Bloquear por código cualquier escritura de QA hacia la API .NET productiva.
6. Configurar captura de correo, desactivar tareas programadas y vaciar o aislar
   suscripciones Web Push antes de publicar el servidor QA.
7. Ejecutar la matriz funcional de aceptación.

## Garantías

- Producción no recibió escrituras ni cambios de configuración.
- QA fue poblado desde un respaldo fijo, no desde una lectura variable de la
  base viva.
- No se renombraron colecciones ni campos.
- No se activó facturación.
- No se copiaron secretos a Git.
