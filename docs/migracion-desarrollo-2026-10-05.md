# Migración de EXPEDITION a Desarrollo — 5 de octubre de 2026

## Estado

Proyecto creado: `systexploradores-dev`  
Nombre visible: **EXPEDITION Development**  
Rama de trabajo: `environment-migration`

## Completado

- Firestore `(default)` creado en `nam5`, la misma ubicación del origen.
- Copia de Firestore ejecutada sin renombrar colecciones ni campos:
  - 110 colecciones raíz.
  - 11.974 documentos, incluyendo subcolecciones.
- Respaldo comprimido previo guardado en `docs/backups/` y excluido de Git.
- Reglas e índices de Firestore compilados y desplegados correctamente.
- Firebase Authentication inicializado.
- 56 usuarios copiados y verificados por UID, conservando los hashes de contraseña.
- Proveedor correo/contraseña habilitado con la misma política del origen.
- Aplicación web `EXPEDITION Development Web` registrada.
- Storage activado y reglas desplegadas.
- 2.073 objetos copiados desde Producción y verificados por nombre, tamaño,
  checksum, metadatos y token de descarga (394.585.296 bytes).
- 5.222 referencias en 2.593 documentos de Firestore reescritas para apuntar a
  `systexploradores-dev.firebasestorage.app`; ninguna de esas referencias sigue
  apuntando a Producción.
- Alias Firebase configurados:
  - `default` y `dev` → `systexploradores-dev`.
  - `prod` → `systexploradores`.
- Variables públicas locales creadas en `.env.development.local`, excluido de Git.

## Validación pendiente

La base de origen recibió cambios mientras se realizaba la copia, por lo que una
firma tomada posteriormente no representa la misma instantánea. Además, las
lecturas de comprobación agotaron temporalmente la cuota diaria gratuita del
proyecto de Desarrollo.

Cuando se renueve la cuota, se debe comparar Desarrollo directamente contra el
respaldo exacto creado antes de la escritura:

```powershell
node scripts/firebase/copiar-firestore-entre-proyectos.mjs `
  --destino=systexploradores-dev `
  --verificar-respaldo="docs/backups/firestore-systexploradores-2026-10-05T16-00-10-578Z.json.gz"
```

Esta operación es de solo lectura y no vuelve a copiar ni sobrescribir datos.

## Bloqueos que requieren decisión del propietario

1. **App Hosting:** todavía no existe el backend
   `expedition-dev`.
2. **Servidor local:** falta una cuenta de servicio exclusiva de Desarrollo.
   No debe reutilizarse una credencial de Producción.
3. **Google Sign-In:** existe un usuario vinculado a Google. Debe crearse y
   validar un cliente OAuth propio para Desarrollo antes de habilitarlo.
4. **Apple Sign-In:** está habilitado en Producción, pero no tiene usuarios
   vinculados en la exportación actual; requiere credenciales y dominios propios.

## Garantías aplicadas

- No se eliminó ni modificó ningún documento del proyecto origen.
- No se renombraron colecciones ni campos durante esta copia.
- No se activó facturación.
- No se copiaron secretos a archivos versionados.
- QA y Producción quedaron fuera del alcance de esta ejecución.
