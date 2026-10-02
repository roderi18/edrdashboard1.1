# Casillas y contenedores añadidos desde el organigrama

## Qué es

En la Jerarquía de nación, región, sección y destacamento, el Administrador Global
tiene un botón **"Agregar casilla o contenedor"** (el círculo con +, encima del lápiz
de diseño). Pide:

- **Nombre** (2 a 60 letras; no puede repetir el de otro cargo del nivel).
- **Tipo**: *Casilla* (un cargo, se asigna a una persona) o *Contenedor* (una caja
  que agrupa casillas, como "Zonas"; no se asigna).
- **Debajo de**: el nodo del que cuelga, que puede ser otro contenedor añadido.

## Global por nivel

El árbol de un nivel es uno solo: una casilla creada en la directiva de *una*
sección sale en *todas* las secciones (y lo mismo en regiones y destacamentos).
Como el catálogo de cargos y el árbol son la misma cosa, la casilla también sale en
la ficha del miembro:

| Nivel | Campo de la ficha |
|---|---|
| Nacional, Regional, Seccional | "Cargo Nacional" |
| Destacamento | "Nivel posición en tu Destacamento" (con la división de la rama donde se creó) |

Asignarla desde el organigrama o desde la ficha escribe en `asignacionesDirectiva`,
igual que los cargos de fábrica.

## Dónde vive

- Firestore: `casillas_directiva_personalizadas/{id}` —
  `{ id, nivel, nombre, tipo, idNodoPadre, division, orden, activo }`. Solo escribe el
  Administrador Global (`firestore.rules`); no se borra.
- Reglas puras (saneado, árbol, posición del catálogo): `src/utils/casillas-personalizadas.mjs`.
- Registro en el catálogo: `registrarCasillasPersonalizadas` en
  `src/catalogs/directiva-positions.js`, que las suma a `DIRECTIVA_POSITIONS` (así las
  ven todas las pantallas que ya consultan ese catálogo). Se registra en cada lectura
  y solo cambia algo si la lista es otra.
- Lectura, creación y retirada: `obtenerCasillasPersonalizadas`,
  `crearCasillaPersonalizada`, `quitarCasillaPersonalizada` en
  `src/services/directivas-organizacionales-service.js`.
- Pantallas: `useCasillasPersonalizadas` (hook) y `CasillasDirectivaBoton`.

## Ids que no cambian

Una casilla `cXXXX` da la posición `<nivel>-casilla-cXXXX`, el nodo `casilla-cXXXX` y,
en el destacamento, el cargo `casilla_cXXXX`. Su `orden` es fijo (1000) porque entra
en el id de la asignación. No se renumeran nunca.

## Renombrar y quitar

El mismo diálogo lista las añadidas en ese nivel con un lápiz (renombrar: cambia en
todas partes a la vez, porque las asignaciones guardan el id) y una papelera.

Quitar deja la ficha con `activo: false`: deja de dibujarse y de ofrecerse, pero su
nombre se sigue traduciendo en el historial. **No se puede quitar si alguien la
ocupa**: su asignación seguiría activa sin verse y le impediría recibir otro cargo de
consejo. Lo que colgaba de un contenedor quitado sube a su sitio.

Las directivas de un cuatrienio pasado no muestran casillas añadidas.

## Quitar del organigrama (también las de fábrica)

En el panel del lápiz, con una casilla o un contenedor marcado, **Quitar del organigrama**
lo quita de todos los organigramas del nivel. Una añadida se marca inactiva, como siempre.
Una de fábrica vive en el código: se guarda en `casillas_directiva_personalizadas` una ficha
`tipo: 'oculta'` cuyo `idNodoPadre` es el nodo que deja de dibujarse. `arbolesConCasillas`
no lo pinta y sube a su sitio lo que colgaba de él. La raíz no se quita, y una casilla
ocupada tampoco: en la entidad abierta lo comprueba el panel y en las demás del nivel, el
servicio (en el destacamento, solo la entidad abierta). **Devolver**, en el mismo panel,
marca la ficha inactiva. La ficha oculta no entra en el catálogo de posiciones.

## Pendiente

- El PDF de la directiva del destacamento y la vista de Líderes Juveniles no dibujan
  las casillas añadidas.
