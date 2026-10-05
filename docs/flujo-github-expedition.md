# Flujo de GitHub de EXPEDITION

## Ramas permanentes

| Rama | Ambiente | Firebase | Backend objetivo |
|---|---|---|---|
| `development` | Desarrollo | `systexploradores-dev` | `expedition-dev` |
| `qa` | QA | `systexploradores-qa` | `expedition-qa` |
| `main` | Producción | `systexploradores` | `expedition` |

## Promoción

```text
feature/*, fix/*, environment-migration
                  ↓ Pull Request
             development
                  ↓ Pull Request
                  qa
                  ↓ Pull Request + aprobación
                 main
```

- `qa` solo acepta `development` o un `hotfix/*` autorizado.
- `main` solo acepta `qa`.
- Los pushes directos y force-push deben quedar bloqueados en las tres ramas.
- Producción requiere aprobación manual.

## Automatización

- `CI` instala dependencias, ejecuta las suites estables y compila la aplicación.
- `Promotion Gate` rechaza promociones que omitan ambientes.
- Firebase App Hosting se conecta por rama mediante un backend independiente.
- Las reglas, índices y secretos pertenecen al ambiente correspondiente; nunca
  se comparten credenciales de Producción con Desarrollo o QA.

## Emergencias

```text
main → hotfix/* → qa → main
                 └────→ development
```

Después de publicar un hotfix se integra también en `development` para evitar
que la corrección se pierda en la siguiente promoción.
