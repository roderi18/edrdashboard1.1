# Plan maestro de ambientes: Desarrollo, QA y Producción

Nombre oficial de la aplicación: **EXPEDITION**  
Fecha de inicio: 05/10/2026  
Estado: **Fase 0 iniciada — inventario y decisiones de infraestructura**

Este documento define cómo separar el código, las bases de datos, los archivos,
las cuentas y los procesos automáticos de EXPEDITION en tres ambientes. La guía
operativa para copiar datos y crear QA está en
[`docs/entorno-qa-y-produccion.md`](./entorno-qa-y-produccion.md).

## 1. Resultado esperado

Al terminar, cada ambiente tendrá recursos independientes y un proceso de
promoción controlado:

```text
feature/* → development → qa → main
                 │            │         │
                 ▼            ▼         ▼
           Desarrollo        QA     Producción
```

Un cambio se programa y prueba primero en Desarrollo, se valida con usuarios en
QA y solo después se promueve exactamente el mismo commit a Producción.

## 2. Estado actual confirmado

| Componente | Estado actual | Riesgo |
|---|---|---|
| Código | `main` despliega producción | No existe promoción automatizada |
| Ramas | Existen `development`, `qa` y `main` | Controles y despliegues en preparación |
| Firebase | Solo está configurado `systexploradores` | Desarrollo local puede tocar datos reales |
| Firestore y Storage | Reglas e índices viven en el repositorio | Falta validación automática con emuladores |
| Hosting | Firebase App Hosting, backend heredado `explora` | Debe migrarse a `expedition`; `apphosting.yaml` aún apunta al backend heredado |
| API .NET | Una URL productiva fija en 32 archivos de `src/` | QA o Desarrollo podrían modificar el padrón real |
| CI/CD | No existe `.github/workflows` | Compilación y pruebas dependen de ejecución manual |
| Datos | Miembros, menores, salud y tutores | No deben copiarse a QA sin control o anonimización |
| Cambios locales | Hay correcciones de seguridad aún sin desplegar | Deben promoverse por el nuevo flujo, no manualmente |

## 3. Arquitectura objetivo

| Recurso | Desarrollo | QA | Producción |
|---|---|---|---|
| Rama | `development` | `qa` | `main` |
| Firebase project ID propuesto | `systexploradores-dev` | `systexploradores-qa` | `systexploradores` |
| App Hosting backend objetivo | `expedition-dev` | `expedition-qa` | `expedition` |
| Firestore | Datos sintéticos | Copia anonimizada y renovable | Datos reales |
| Storage | Archivos de prueba | Copia filtrada/anonimizada | Archivos reales |
| Authentication | Usuarios técnicos | Usuarios QA controlados | Usuarios reales |
| API .NET | API de desarrollo o simulador | API QA; temporalmente solo lectura | API productiva |
| Push y correo | Capturados/desactivados | Capturados/desactivados | Habilitados |
| Scheduler | Desactivado | Desactivado salvo prueba puntual | Habilitado |
| Acceso | Equipo técnico | Equipo y validadores designados | Usuarios finales |

### Regla obligatoria de aislamiento

Ninguna credencial, base de datos, bucket, suscripción push, secreto de tareas o
API escribible se comparte entre ambientes. Una prueba en Desarrollo o QA no
puede producir cambios ni avisos en Producción.

## 4. Estrategia de datos

### Desarrollo

- Usar datos sintéticos y usuarios técnicos.
- Preferir Firebase Emulator Suite durante el trabajo local.
- Mantener una semilla repetible para Firestore, Auth y Storage de prueba.
- Prohibir credenciales de servicio productivas en `.env.local` de desarrollo.

### QA

- Usar una copia anonimizada y filtrada de producción cuando sea necesario.
- Conservar relaciones e identificadores técnicos, pero reemplazar nombres,
  correos, teléfonos, direcciones, salud, tutores y fotografías sensibles.
- Vaciar `web_push_subscriptions` después de cada refresco.
- Excluir `respaldos/` y otros archivos que QA no necesita.
- El refresco siempre va de Producción a QA, nunca en sentido contrario.

### Producción

- Solo datos reales.
- Respaldo verificado antes de una migración de datos o reglas de alto impacto.
- Acceso administrativo con mínimo privilegio y auditoría.

## 5. Promoción del código

### Desarrollo: rama `development`

Cada PR debe ejecutar:

1. Instalación reproducible con `npm ci`.
2. Lint de archivos fuente.
3. Suite de pruebas.
4. Compilación `next build`.
5. Validación de reglas de Firestore y Storage con emuladores.
6. Despliegue automático a `expedition-dev` si todo pasa.

### QA: rama `qa`

La promoción desde `development` debe:

1. Usar un commit ya aprobado y compilado.
2. Volver a ejecutar pruebas y compilación.
3. Desplegar reglas, índices y aplicación en `systexploradores-qa`.
4. Ejecutar pruebas rápidas de inicio de sesión, permisos, miembros, tienda,
   calendario, documentos y tareas deshabilitadas.
5. Registrar aprobación funcional antes de Producción.

### Producción: rama `main`

Solo se promueve desde `qa` y requiere:

1. Aprobación manual.
2. Pruebas de QA aprobadas.
3. Respaldo reciente y restauración comprobada.
4. Plan de reversión escrito para la versión.
5. Despliegue del mismo commit validado en QA.
6. Pruebas rápidas posteriores y monitoreo.

No se debe corregir directamente en Producción. Una emergencia nace de
`main`, se corrige en una rama `hotfix/*`, pasa por QA y vuelve a integrarse en
`development`.

## 6. Variables y secretos por ambiente

Variables públicas necesarias en cada compilación:

- `NEXT_PUBLIC_APP_ENV`: `development`, `qa` o `production`.
- `NEXT_PUBLIC_FIREBASE_API_KEY`.
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`.
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`.
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`.
- `NEXT_PUBLIC_FIREBASE_APPID`.

Variables privadas del servidor:

- `FIREBASE_SERVICE_ACCOUNT`: una cuenta distinta por proyecto.
- `DOTNET_API_URL`: URL base de la API correspondiente al ambiente.
- `PADRON_READ_ONLY`: `true` en QA hasta disponer de una API QA aislada.
- `WEB_PUSH_VAPID_PRIVATE_KEY`: par distinto por ambiente.
- `WEB_PUSH_VAPID_SUBJECT`.
- `TAREAS_PROGRAMADAS_SECRETO`: distinto por ambiente.
- `TAREAS_PROGRAMADAS_HABILITADAS`: solo `true` en Producción.
- `SALIDA_CORREO`: `capture` en Desarrollo/QA y `live` en Producción.

Los secretos se guardan en Secret Manager/App Hosting. Nunca se guardan en Git,
en documentos compartidos ni dentro de archivos `apphosting.*.yaml`.

## 7. Fases de ejecución

### Fase 0 — Inventario y decisiones (iniciada)

- [x] Confirmar que Producción usa Firebase `systexploradores`.
- [x] Confirmar ramas `development`, `qa` y `main`.
- [x] Confirmar ausencia de CI/CD.
- [x] Identificar 32 archivos con la API .NET productiva escrita directamente.
- [x] Documentar arquitectura, promoción y política de datos.
- [x] Confirmar **EXPEDITION** como nombre oficial de la aplicación.
- [x] Confirmar nombres definitivos de los proyectos Firebase Dev y QA.
- [ ] Decidir dónde correrá la API .NET de Desarrollo y QA.
- [x] Designar al propietario del repositorio como autorizador de Producción.
- [x] Definir la copia controlada de los datos de prueba actuales para Dev y QA.

**Criterio de salida:** decisiones anteriores registradas y responsables
asignados.

### Fase 1 — Preparar el repositorio

- [ ] Centralizar `DOTNET_API_URL` en un módulo del servidor.
- [ ] Reemplazar las 32 URLs fijas por ese módulo.
- [ ] Implementar `PADRON_READ_ONLY` en todas las rutas POST/PUT/DELETE.
- [ ] Implementar indicadores visuales “DEV” y “QA”.
- [ ] Implementar interruptores seguros para correo, push y Scheduler.
- [ ] Crear semillas de datos sintéticos.
- [ ] Crear pruebas que impidan conectar Dev/QA con Producción.
- [ ] Corregir los tres fallos conocidos de la suite actual.
- [ ] Configurar Firebase Emulator Suite en el repositorio.
- [x] Crear CI de validación para pull requests.

**Criterio de salida:** suite, lint, build y emuladores pasan; una ejecución con
`PADRON_READ_ONLY=true` no modifica la API .NET.

### Fase 2 — Crear Desarrollo

- [x] Crear `systexploradores-dev` y Firestore en `nam5`, igual que el origen.
- [x] Activar Firebase Authentication y Firestore.
- [x] Activar Storage y desplegar sus reglas.
- [x] Activar App Hosting y crear el backend `expedition-dev`.
- [x] Crear backend `expedition-dev` conectado a `development`.
- [x] Registrar la app web `EXPEDITION Development Web` y crear variables públicas locales.
- [ ] Configurar secretos de servidor exclusivos de Desarrollo.
- [x] Desplegar reglas e índices de Firestore en Desarrollo.
- [x] Copiar 11.974 documentos de Firestore y 56 usuarios de Authentication con sus UID.
- [x] Copiar y verificar 2.073 objetos de Storage (394.585.296 bytes).
- [x] Reescribir 5.222 referencias de Firestore para usar el bucket de Desarrollo.
- [ ] Repetir la firma de verificación de Firestore cuando se renueve la cuota diaria de lecturas.
- [ ] Verificar que tareas, correo y push estén desactivados/capturados.

**Criterio de salida:** el equipo desarrolla sin credenciales ni datos de
Producción y cada cambio aprobado en `development` se despliega automáticamente.

### Fase 3 — Crear QA

- [x] Crear `systexploradores-qa` y Firestore en `nam5`.
- [x] Activar Firebase Authentication y Firestore.
- [x] Activar Storage y desplegar sus reglas.
- [x] Activar App Hosting y crear el backend `expedition-qa`.
- [x] Crear backend `expedition-qa` conectado a `qa`.
- [x] Registrar la app web `EXPEDITION QA Web` y crear variables públicas locales.
- [ ] Configurar secretos de servidor exclusivos de QA.
- [x] Desplegar reglas e índices de Firestore.
- [x] Copiar y verificar 11.974 documentos desde el respaldo controlado.
- [x] Copiar y verificar 56 usuarios de Authentication conservando sus UID.
- [x] Copiar y verificar 2.073 objetos de Storage (394.585.296 bytes).
- [x] Reescribir 5.222 URLs de Storage para apuntar al bucket QA.
- [x] Bloquear localmente la credencial de push de Producción.
- [ ] Vaciar suscripciones push y configurar captura de correo en el despliegue QA.
- [ ] Mantener el padrón en solo lectura hasta tener API QA.
- [ ] Ejecutar y documentar la matriz de aceptación.

**Criterio de salida:** QA reproduce los flujos de Producción sin tocar datos ni
personas reales y existe una aprobación funcional trazable.

### Fase 4 — Formalizar Producción

- [ ] Crear o migrar el backend productivo de `explora` a `expedition`.
- [ ] Actualizar dominio, `WEB_PUSH_VAPID_SUBJECT` y enlaces operativos.
- [ ] Mantener redirección desde la URL heredada durante la transición.
- [ ] Añadir alias explícito `prod` sin depender del alias `default`.
- [x] Proteger `main` y requerir CI + aprobación.
- [x] Configurar el ambiente `production` con aprobación manual.
- [ ] Documentar respaldo, migración, reversión y pruebas posteriores.
- [ ] Activar alertas de errores, disponibilidad, cuota y respaldo incompleto.
- [ ] Verificar restauración de un respaldo en un ambiente aislado.

**Criterio de salida:** Producción solo recibe versiones aprobadas en QA y puede
volver a la versión anterior de aplicación, reglas y datos.

### Fase 5 — Operación continua

- [ ] Refresco controlado de QA bajo demanda.
- [ ] Rotación periódica de secretos.
- [ ] Revisión trimestral de accesos IAM.
- [ ] Prueba periódica de restauración.
- [ ] Registro de despliegues e incidentes.
- [ ] Revisión de costes, cuotas y capacidad.

## 8. Orden técnico de cada despliegue

Para evitar que una aplicación nueva encuentre reglas o índices incompatibles:

1. Confirmar respaldo y punto de reversión.
2. Aplicar migraciones compatibles hacia adelante.
3. Desplegar índices y esperar a que estén listos.
4. Desplegar reglas compatibles con versión anterior y nueva.
5. Desplegar la aplicación.
6. Ejecutar pruebas rápidas.
7. Aplicar limpieza o endurecimiento que ya no sea compatible hacia atrás.

Los cambios destructivos de datos se dividen en dos versiones: primero se añade
la estructura nueva y se migra; solo en una liberación posterior se elimina la
estructura antigua.

## 9. Reversión

| Componente | Estrategia |
|---|---|
| Aplicación | Volver al último commit/despliegue estable |
| Reglas | Conservar y volver a desplegar la versión anterior |
| Índices | No eliminarlos durante la misma liberación que deja de usarlos |
| Firestore | Restaurar export previo o ejecutar migración inversa comprobada |
| Storage | Versionado/copia previa para operaciones masivas |
| Auth | Export protegido antes de migraciones de usuarios |
| API .NET | Desplegar versión anterior y restaurar su base si hubo migración |

## 10. Primera entrega recomendada

La primera entrega no crea infraestructura. Hace seguro al código para poder
crear los ambientes:

1. `DOTNET_API_URL` centralizada.
2. Guarda `PADRON_READ_ONLY` comprobada por pruebas.
3. Indicador visual del ambiente.
4. Bloqueo de tareas, push y correo fuera de Producción.
5. CI con pruebas, lint y build.
6. Emuladores y datos sintéticos.

Después de esta entrega se crea Desarrollo; cuando sea estable, se crea QA y se
realiza la primera promoción completa hasta Producción.

