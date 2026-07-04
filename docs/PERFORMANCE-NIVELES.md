# Rendimiento — niveles organizacionales

Análisis y mejoras de la carga de Regiones, Secciones, Destacamentos y Miembros
(`/dashboard/level/*`). La data viene de una API externa (`systexploradores.somee.com`)
que solo expone endpoints `GetAll...` y, al ser tier gratuito, **serializa las
peticiones concurrentes** (un mismo `GetAll` varía de ~0.9 s a >17 s).

## Cómo medir

```
node scripts/perf-levels.mjs http://localhost:3032 14 compare
```

El script replica el waterfall de red real de cada vista. El modo `compare`
intercala baseline y fase1 por iteración (misma ventana de latencia) y reporta
la mediana de cada uno y la mejora. No mide las fotos de Firestore (cliente),
pero el waterfall de `/api` es la parte dominante.

## Fase 1 — implementada

Idea: **una sola tanda de fetch por vista, sin duplicados ni gates en serie.**

- **Secciones**: `buildSectionalList` ya no re-pide datos; recibe lo ya cargado.
  `loadData` hace un único `Promise.all` (antes pedía secciones/regiones/iglesias/
  destacamentos hasta 3× y 5 awaits en serie).
- **Regiones**: `getRegionals` entra al mismo `Promise.all` (antes se resolvía en
  serie antes del resto). Secciones sin fotos.
- **Destacamentos**: la metadata se carga en paralelo desde el montaje (antes
  esperaba a los destacamentos base). Secciones/regiones sin fotos.
- **Miembros**: la metadata se carga en paralelo con los miembros (antes esperaba
  a que terminara la carga de miembros).

### Resultado medido (mediana, modo `compare`, 14 iteraciones)

| Vista          | Baseline | Fase 1  | Mejora |
| -------------- | -------- | ------- | ------ |
| Secciones      | 7049 ms  | 2112 ms | −70%   |
| Miembros       | 2176 ms  | 1588 ms | −27%   |
| Destacamentos  | 2197 ms  | 1813 ms | −17%   |
| Regiones       | 2110 ms  | 2135 ms | ~0%    |

La ganancia correlaciona con **reducir el número de llamadas / etapas**, no con
paralelizar (somee serializa la concurrencia). Regiones ya no tenía redundancia
que quitar, por eso queda plano: lo resuelve la Fase 2.

## Fase 2 — implementada (caché TTL server-side)

En lugar de endpoints `summary` nuevos, se agregó un **caché en memoria con TTL
de 60s + dedup de peticiones en vuelo** (`src/utils/upstream-cache.js`) delante
de todos los `GetAll` de somee en los route handlers (`/api/members`, `/api/dest`,
`/api/churches`, `/api/sectional`, `/api/regional`, `/api/cargos`,
`/api/cargos-miembros`). Además:

- `/api/sectional` y `/api/regional` piden sus dos datasets upstream **en
  paralelo** (antes en serie) y comparten la entrada de caché de `Secciones`/
  `Iglesias` (elimina la duplicación upstream por recarga).
- Las rutas de mutación (post/put/delete de cada nivel) **invalidan** la clave
  correspondiente, así los flujos que releen tras crear/editar ven datos frescos.
- Cliente: `getMembers()` tiene caché en memoria (TTL 30s + dedup) invalidada
  por `createMemberApi`/`updateMemberApi`/`deleteMember`/import de Excel, y
  `storage-service` mantiene un espejo en memoria (adiós `JSON.parse` de la
  colección completa por fila renderizada).

### Resultado medido (mediana, modo `fase1`, 7 iteraciones, mismo día)

| Vista          | Antes   | Después | Mejora |
| -------------- | ------- | ------- | ------ |
| Regiones       | 245 ms  | 44 ms   | −82%   |
| Secciones      | 241 ms  | 40 ms   | −83%   |
| Destacamentos  | 360 ms  | 45 ms   | −88%   |
| Miembros       | 266 ms  | 48 ms   | −82%   |

Nota: la medición "antes" se tomó en una ventana **rápida** de somee (~0.3s por
peticion directa). En las ventanas lentas documentadas (2–17s por `GetAll`), el
"antes" escala a segundos mientras el "después" se mantiene en ~40–50 ms con
caché caliente, porque ya no se viaja al upstream en cada vista.

Esperado: Regiones y Secciones a **~0.1–0.5 s** en caché caliente; se elimina el
parpadeo `0 → número` porque los conteos llegan en la primera (y única) respuesta.

## Fase 3 — pendiente (pulido / UX)

- [ ] Quitar `cache: 'no-store'` de `getChurches` (y revisar otros) o usar caché
      HTTP/SWR.
- [ ] Cachear en localStorage los conteos ya calculados para mostrarlos al
      instante en la siguiente visita (hoy el caché guarda `0`).
- [ ] Mostrar `—`/skeleton en las columnas de conteo mientras cargan, en vez de
      `0` literal (elimina la sensación de "trabado").
- [ ] Recortar el payload de los `GetAll` a los campos realmente usados.
