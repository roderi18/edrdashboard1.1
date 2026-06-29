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

## Fase 2 — pendiente (mayor impacto)

**Agregar el conteo en un route handler de Next** (`/api/<nivel>/summary`) para
que el navegador haga **una sola** llamada con los números ya calculados.

- [ ] `/api/regional/summary`: `Promise.all` server-side de regiones, secciones,
      iglesias, destacamentos y miembros; calcular `secciones`, `destacamentos` y
      `miembros` por región; devolver regiones con los conteos.
- [ ] Igual para `/api/sectional/summary` (cuenta destacamentos y miembros).
- [ ] `export const revalidate = 60` (o caché con TTL) en esos routes → respuestas
      siguientes ~50–150 ms.
- [ ] Conectar las vistas de Regiones y Secciones a la llamada única; eliminar el
      cruce de conteos en el cliente.
- [ ] Quitar la duplicación upstream: `/api/regional` y `/api/sectional` piden
      `Secciones`/`Iglesias` dos veces cada recarga.

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
