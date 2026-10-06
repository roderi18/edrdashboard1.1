# CI y escaneos de seguridad

Cubre los puntos de "Seguridad: escaneos obligatorios" del checklist de
Desarrollo, QA y Producción. Todo es gratis y corre solo en GitHub Actions:
nada se instala en la aplicación ni afecta su velocidad.

| Qué | Dónde | Punto del checklist |
|---|---|---|
| Lint y todas las pruebas | `.github/workflows/ci.yml` | Linter, pruebas unitarias e integración |
| Semgrep | `.github/workflows/seguridad.yml` + `.semgrepignore` | SAST |
| Gitleaks (todo el historial) | `seguridad.yml` + `.gitleaks.toml` | Detección de secretos |
| `npm audit --audit-level=high` | `seguridad.yml` | SCA |
| SBOM CycloneDX (`sbom.cdx.json`) | `seguridad.yml`, artefacto `sbom` | SBOM |
| Dependabot | `.github/dependabot.yml` (PRs contra `development`) | SCA continuo |

`seguridad.yml` corre en cada PR/push a `development`, `qa` y `main`, cada lunes
y a mano (`workflow_dispatch`). Los informes quedan en los artefactos del run.

## Fases

**Fase 1 (actual) — solo informan.** Lint, todas las pruebas, Semgrep, Gitleaks
y npm audit llevan `continue-on-error: true`: salen en rojo en el resumen pero no
bloquean. Al activarlos había 117 errores de lint, 3 pruebas rojas y 4
vulnerabilidades críticas + 19 altas; bloquear desde el primer día impedía
cualquier PR. Siguen bloqueando, como antes, el esquema de Firestore, acceso,
chat, tienda y el build.

**Fase 2 — bloquean.** Cuando cada hallazgo esté corregido o aceptado por
escrito (responsable y fecha), quitar `continue-on-error` del paso y, en
Semgrep, añadir `--severity ERROR --error` para que solo lo grave bloquee.

## En GitHub (una vez, en Settings del repositorio)

- *Code security* → activar **Dependabot alerts** y **Dependabot security updates**.
- *Branches* → en las reglas de `qa` y `main`, exigir los checks
  `Tests and build` y, en fase 2, `SAST (Semgrep)`, `Secretos (Gitleaks)` y
  `Dependencias (npm audit + SBOM)`.

## Excepciones

`.gitleaks.toml` solo deja pasar las tres claves `AIza…` de `apphosting*.yaml`:
son la configuración pública de Firebase, no secretos. Una clave nueva no se
añade sin confirmar que es pública.

## Estado de dependencias (06/10/2026)

`npm audit --omit=dev`: de 50 (4 críticas, 19 altas) a 2 moderadas.

- `npm audit fix` sin `--force` (incluye `next`, `axios`, `@fastify/busboy`…).
- `maplibre-gl` 5 → 6 (mapa de contacto y ejemplos).
- `pdfjs-dist` 5 → 6: **su worker se copia a mano** a `public/app/pdf.worker.min.mjs`
  (`cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/app/`); si la
  versión del worker no coincide con la librería, la lectura de PDF de
  Certificados falla.
- `xlsx` 0.18.5 → 0.20.3 desde `cdn.sheetjs.com`: SheetJS dejó de publicar en
  npm y la versión de npm tiene CVE sin arreglo.
- `overrides` de `@grpc/grpc-js` ≥ 1.14.5 para `@firebase/firestore` (traía 1.9.16
  vulnerable; `npm audit` proponía bajar Firebase a la v9).
- Pendientes, moderadas: `exceljs` → `uuid` (el arreglo es versión mayor de exceljs).
