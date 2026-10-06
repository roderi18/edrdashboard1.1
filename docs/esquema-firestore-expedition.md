# Esquema Firestore de EXPEDITION

## Convencion oficial

- Colecciones: sustantivos en espanol, normalmente plurales, en `camelCase`.
- Campos: nombres en espanol y `camelCase`.
- Identificadores: singular cuando apuntan a una entidad (`idMiembro`, no `idMiembros`).
- Fechas: prefijo `fecha` y valores `Timestamp` de Firestore.
- Booleanos: nombres afirmativos como `activo`, `visible`, `eliminado`.
- Los nombres fisicos se obtienen exclusivamente del catalogo
  `src/config/esquema-firestore.mjs`.

## Compatibilidad

La aplicacion usa por defecto la version `heredado`; por eso esta primera entrega
no cambia donde lee ni donde escribe. La version `canonico` se activa solo con:

```text
ESQUEMA_FIRESTORE_VERSION=canonico
NEXT_PUBLIC_ESQUEMA_FIRESTORE_VERSION=canonico
```

Ambas variables deben tener el mismo valor en cada ambiente. No deben activarse
antes de completar la migracion y su verificacion.

Ejemplos:

| Actual | Canonico |
| --- | --- |
| `users` | `usuarios` |
| `usuarios_roles` | `usuariosRoles` |
| `admins` | `administradores` |
| `auditoria_sistema` | `auditoriaSistema` |
| `conversaciones_chat` | `conversacionesChat` |
| `certificateTemplates` y `plantillasCertificados` | `plantillasCertificados` |
| `everest_publicado` | `designerPublicado` |

## Ejecucion segura

El script siempre inicia en modo de solo lectura:

```powershell
node --env-file=.env.local scripts/firebase/migrar-esquema-firestore.mjs
```

Para limitar la inspeccion:

```powershell
node --env-file=.env.local scripts/firebase/migrar-esquema-firestore.mjs --solo=usuarios,usuariosRoles
```

La escritura exige una confirmacion explicita. En la primera etapa se conservan
los campos exactamente como estan, para que el cambio de colecciones y el de
campos puedan verificarse por separado:

```powershell
node --env-file=.env.local scripts/firebase/migrar-esquema-firestore.mjs `
  --aplicar `
  --confirmar=MIGRAR_ESQUEMA_FIRESTORE
```

La opcion `--normalizar-campos` se reserva para una segunda etapa, cuando todas
las consultas y formularios ya usen los lectores compatibles. No debe combinarse
con la primera copia.

No se debe ejecutar `--aplicar` en produccion hasta tener respaldo, reglas e
indices canonicos, y una comparacion satisfactoria en desarrollo y QA. El script
se detiene si encuentra un documento destino diferente o una colision de campos;
no borra las colecciones heredadas.

## Orden de despliegue

1. Mantener el esquema heredado activo y centralizar las referencias del codigo.
2. Crear respaldo verificable.
3. Copiar y transformar los datos en desarrollo.
4. Comparar conteos, relaciones y muestras funcionales.
5. Repetir en QA y ejecutar pruebas completas.
6. Publicar reglas e indices para ambos esquemas.
7. Activar el esquema canonico en QA.
8. Migrar produccion y activar el esquema canonico.
9. Mantener las colecciones heredadas en solo lectura durante la ventana de retorno.
10. Retirarlas solo después de una aprobacion y un respaldo final.

