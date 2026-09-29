# Mapa de prueba de República Dominicana

Ruta aislada: `/pruebas/mapa-republica-dominicana/`.

Acceso: menú **Datos demográficos** (debajo de Asistencias), ruta `/dashboard/level/datos-demograficos`; la de `/pruebas` redirige ahí. Antes: **Desarrollo · plantilla →
Pruebas → Mapa Rep. Dom.**. Pruebas aparece encima de Aplicación y utiliza el
desplegable compartido del menú, con un casco de constructor registrado localmente.

El contorno se guarda localmente en `republica-dominicana.geo.json`: 580 vértices
en tres polígonos (territorio principal, Beata y Saona). Procede de Natural Earth,
Admin 0 – Countries a escala 1:10.000.000, de dominio público:

- https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/
- https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson

Se extrajo únicamente la entidad `ADM0_A3 = DOM` el 26 de septiembre de 2026.
`geometria-mapa.mjs` conserva todos los vértices y proyecta el conjunto a Mercator
con una sola escala y encuadre automático, sin deformar ni suavizar artificialmente
las costas. La precisión es cartográfica, no catastral.

El mapa no solicita datos geográficos a servicios externos durante su uso.

La opción **Provincias** (esquina inferior derecha; "Ver regiones", Provincias y Nombres empiezan encendidos)
superpone las 31 provincias y el Distrito Nacional, guardados en
`provincias.geo.json`. Fuente: Natural Earth Admin 1, 1:10m, dominio público:
https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/
Se extrajo `adm0_a3 = DOM` del GeoJSON del mismo repositorio de Natural Earth.
Todas las divisiones usan exactamente la proyección y el encuadre del país.

**Nombres de provincias**, debajo de Provincias, solo se habilita cuando las
divisiones están activadas. Apagarlas desmarca y oculta también los nombres.
Los rótulos usan las posiciones de Natural Earth y los nombres en español
(Elías Piña y Distrito Nacional normalizados); el Distrito Nacional lleva una
línea de referencia hacia su rótulo para evitar solaparlo con Santo Domingo.

Arriba a la derecha: restablecer y pantalla completa; debajo: acercar y alejar.
Los controles usan MUI e iconos locales. Los navegadores sin Fullscreen API tienen
una vista ampliada fija con salida por el mismo botón o Escape.
`use-gestos-mapa.js` mantiene los Pointer Events de cada dedo para combinar
pellizco y desplazamiento. Pulsar o tocar el mapa no crea marcadores.
La rueda centra el zoom en el cursor y los botones en el centro del mapa.

El lápiz, debajo de los controles de zoom, abre un editor ligero de composición.
En ese modo el mapa y cada elemento se pueden mover y redimensionar. Se pueden
crear recuadros, círculos, líneas, textos, iconos decorativos y entidades
organizacionales. Los iconos y las imágenes organizacionales tienen botones
independientes en la barra. Los textos
tienen contenido, color, opacidad y tamaño de letra configurables.

Las entidades se cargan bajo demanda desde los catálogos ya existentes de Consejo
Nacional, regiones, secciones y destacamentos; el editor no consulta ni ofrece
miembros. Cada entidad puede mostrar su imagen de perfil o el símbolo de su nivel,
con el nombre opcional y ajustable. **Guardar** conserva posiciones, tamaños y
apariencia como porcentajes en `localStorage` (`mapa-rd-composicion-v1`), por lo
que la composición se adapta a diferentes tamaños de pantalla y permanece solo
en el navegador actual.

Verificación de geometría y zoom: `node --test tests/mapa-rd/*.test.mjs`.

**Destacamentos en el mapa** (como en la landing de registro, pero con el padrón
entero): un número por provincia y, abajo, las cuatro regiones con su total. Al
señalar un número o una región sale la lista de sus destacamentos (en el móvil, al
tocar), y la región señalada se pinta sobre el mapa. La provincia sale de la
dirección del destacamento (o de la de su iglesia); la región es la real
(iglesia → sección → región). "Provisional" no cuenta, y los que no tienen
provincia en el padrón solo suman en su región (la leyenda dice cuántos son).
Piezas: `destacamentos-del-mapa.mjs` (regla) y `destacamentos-en-mapa.jsx`.
Test: `tests/mapa-rd/destacamentos-en-el-mapa.test.mjs`.
