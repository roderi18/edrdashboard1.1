# Auditoria y normalizacion del esquema Firestore de EXPEDITION

Fecha: 5 de octubre de 2026  
Rama: `environment-migration`

## Resultado del inventario

- 110 colecciones raiz inspeccionadas en el proyecto actual.
- 5.204 rutas de campo observadas, con una muestra maxima de 50 documentos por coleccion.
- 718 rutas candidatas a revision de nomenclatura.
- 0 colecciones raiz fuera del catalogo central creado.
- 198 referencias directas a colecciones centralizadas en 103 archivos.
- 115 propiedades del catalogo consumidas por el codigo, todas registradas.

Las 718 candidatas no equivalen a 718 columnas que deban renombrarse. Una parte
considerable son claves dinamicas que representan identificadores de sesiones,
permisos o premios. Cambiar esas claves alteraria relaciones de negocio. La
normalizacion automatica se limita por eso a campos estructurales inequívocos.

## Convencion aprobada

- Espanol y `camelCase` para colecciones y campos.
- Plural para colecciones y singular para referencias a una entidad.
- `idMiembro` sustituye gradualmente a `idMiembros` cuando el dato representa un solo miembro.
- `fechaCreacion`, `fechaActualizacion`, `fechaInicio` y `fechaFin` para fechas.
- Fechas nuevas en `Timestamp` de Firestore.
- Claves dinamicas e identificadores de catalogo no se traducen ni se reformatean.

## Casos que requieren consolidacion

El modulo de certificados mantiene dos modelos poblados al mismo tiempo:

| Canonico | Origenes actuales |
| --- | --- |
| `certificados` | `certificados`, `certificates` |
| `lotesCertificados` | `lotesCertificados`, `certificateBatches` |
| `plantillasCertificados` | `plantillasCertificados`, `certificateTemplates` |
| `estadosCertificadosMiembros` | `estadosCertificadosMiembros`, `certificateMemberStatuses` |

La migracion se detiene si dos documentos con el mismo ID tienen contenidos
distintos. No se ha configurado una preferencia silenciosa entre modelos.

## Protecciones implementadas

- Catalogo unico y versionado en `src/config/esquema-firestore.mjs`.
- Alias seguros de campos y detector de colisiones en `src/config/campos-firestore.mjs`.
- Aplicacion en modo `heredado` por defecto; conserva las lecturas y escrituras actuales.
- Auditor de campos y tipos, de solo lectura.
- Migrador recursivo de documentos y subcolecciones, de solo lectura por defecto.
- Confirmacion textual obligatoria para habilitar escrituras.
- Separacion entre migrar colecciones y normalizar campos.
- Bloqueo ante documentos de destino diferentes, salvo autorizacion explicita de sobrescritura.
- Pruebas del catalogo y de la normalizacion.

## Estado de los datos

No se escribio, renombro ni elimino ningun documento en Firebase durante esta
etapa. Tampoco se activo el esquema canonico en la aplicacion. La migracion real
debe comenzar en desarrollo, continuar en QA y llegar a produccion despues de
validar conteos, relaciones, reglas, indices y recorridos funcionales.

## Validacion realizada

- Pruebas nuevas del esquema: correctas (3/3).
- Suite de chat: correcta (277/277).
- Suite de acceso: correcta (397/397).
- Suite de tienda: correcta (233/233).
- Suite de directivas: conserva el fallo anterior del patron de
  `mapMemberToForm`; no fue introducido por esta migracion.
- Compilacion optimizada de Next.js: correcta, 296 paginas generadas.

