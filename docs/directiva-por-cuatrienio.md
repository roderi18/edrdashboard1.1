# Directiva Nacional por cuatrienio

> Estado: **implementado** (pantalla, reglas, permisos y carga del listado). La
> carga del listado 2022-2026 **no se ha corrido todavía**: la lanza el
> Administrador Global desde la pantalla, después de ver la vista previa.
> Fuente del listado: `Listado de los votantes 123.docx`, copiado en
> `src/catalogs/directiva-2022-2026.mjs`.

## 1. Qué es

En `/dashboard/level/national` el cuatrienio se elige en el propio título de la
lista (**Directiva Nacional 2026-2030 · Actual ▾**). El vigente son las casillas
de hoy, como siempre; uno pasado (`?cuatrienio=2022-2026`) es la **memoria de la
organización**, pintada en la misma tabla con los mismos filtros.
`?vista=cuatrienios`, el enlace de antes, abre el último cuatrienio cerrado. Cada cuatrienio guarda quién ocupó cada cargo de
la **Directiva Nacional**, que incluye:

- el Consejo Ejecutivo nacional, sus oficiales y sus ex comandantes,
- la directiva de **cada región**,
- la directiva de **cada sección**.

Se guarda aunque esas personas hoy no tengan ningún cargo: es historia, no permisos.

| Cuatrienio | Desde | Hasta | Estado |
|---|---|---|---|
| `2022-2026` | 20/08/2022 | 22/08/2026 | cerrado |
| `2026-2030` | 22/08/2026 | (22/08/2030 previsto) | vigente |

El 22/08/2026 termina uno y empieza el otro el mismo día: esa fecha ya es
2026-2030 (`fin` es exclusivo). Las fechas viven en `CUATRIENIOS`, en
`src/utils/directiva-cuatrienios.mjs`; el siguiente cuatrienio se añade ahí.

## 2. Reglas de negocio (no se cambian sin su test)

1. **Foto fija.** Un cuatrienio guardado no cambia cuando cambia el padrón, el
   nombre de una región o sección, ni la foto de perfil. La foto se **copia** a
   Storage (`directiva-historica/{cuatrienio}/`); nunca se enlaza la del perfil,
   porque al cambiarla Storage reemplaza el archivo y el enlace viejo deja de servir.
2. **La historia no da permisos.** Los permisos salen de los cargos **actuales**.
   Un cargo de un cuatrienio pasado no da ni quita nada, y guardar la historia no
   toca el rol actual de nadie.
3. **Excepción: Director Nacional.** Quien es o fue Director Nacional —o
   Comandante Nacional, su nombre antiguo— conserva **todos los permisos de
   Director Nacional**. Lo aplica el servidor al calcular el rol
   (`leerAsignacionesDe` en `src/server/rol-por-cargo.js`): suma una casilla de
   Director Nacional que no se guarda en ninguna parte. Llega a la persona en su
   siguiente inicio de sesión o con "Sincronizar roles".
4. **Ex comandante nacional es para siempre.** Los del grupo "Ex comandantes" y
   quien fue Director Nacional en un cuatrienio **cerrado** salen siempre en la
   lista de Directiva actual como **Ex Comandante Nacional** (Consejo Ejecutivo),
   con su filtro de posición, tengan o no cargo hoy. No se pueden dar de baja
   desde esa lista: es historia, no una asignación.
5. **Una persona, un cargo por cuatrienio.** Si un nombre se repite, vale **la
   primera posición** y las siguientes se ignoran (la casilla queda vacía). Ser ex
   comandante no cuenta como posición: se suma al cargo. El editor también lo
   impide.
6. **Casilla sin persona o "Vacante" → no se agrega nada.**
7. **Casilla con persona pero sin cargo conocido → cargo "Provisional"**, que se
   corrige a mano. (El documento actual trae cargo en todas.)
8. **Quién edita:** Administrador Global y Oficina Nacional (por cualquiera de sus
   cargos). Cada cambio pasa por `proponerCambio` (ámbito `directiva_historica`):
   se aplica al momento, queda en Historial y **avisa al otro** por la campana. Si
   el aviso falla, el cambio se guarda igual.
9. **Crear en el padrón es del Administrador Global.** La carga del listado crea
   secciones y miembros en la API .NET, y esas rutas solo se las permiten a él; la
   Oficina Nacional ve la vista previa y corrige la historia, pero no la lanza.
10. **Quién ve:** cualquiera que entre a Nacional.

## 3. Personas nuevas: miembros normales en un destacamento Provisional

- Quien **no esté en el padrón** se crea como miembro normal en la API .NET, con
  su **código EDR correlativo** (`generateMemberId`, sin renumerar nada),
  división Liderazgo y estatus activo. Oficiales y ex comandantes también.
- Se busca en el padrón por nombre **sin tildes ni mayúsculas**: con una sola
  coincidencia se enlaza a esa persona; con varias no se adivina, se guarda el
  nombre sin enlazar y se corrige a mano.
- Van a un **destacamento "Provisional"** (con su iglesia "Provisional", que la
  API exige) de la **sección "Provisional"** de la **región "Provisional"**. Se
  trasladan después con el flujo normal; la historia no se rompe porque va
  enlazada por `idMiembros`.
- **Secciones del listado que no existen** se crean con el nombre del documento
  dentro de su región. Hoy existen Este Oriental I y II, Santiago, Haina, San
  Cristóbal y San Francisco (de Macorís, por alias); se crean Este Central I,
  Central II, Oeste Occidental, Oeste Central, San Pedro, Romana 1, Romana 2, Hato
  Mayor, Seibo, Higüey, Baní-Ocoa, Azua, San Juan–Elías Piña y La Vega. San Pedro
  y las dos Romanas son secciones nuevas aunque existan "San Pedro Norte" y "La
  Romana": el documento las nombra así.
- La carga se puede repetir: entidades y personas se buscan antes de crearse y
  cada fila del cuatrienio tiene id fijo (sale de la casilla).

## 4. Modelo de datos

```
directiva_cuatrienios_integrantes/{cuatrienio__nivel__entidad__cargo}
  cuatrienio, nivel: 'nacional' | 'regional' | 'seccional'
  grupo: 'directiva' | 'oficiales' | 'ex_comandantes'
  cargo, cargoNombre, orden
  idPosicionDirectiva      ← la casilla del organigrama de hoy (o null)
  regionId, regionNombre   ← nombre copiado
  seccionId, seccionNombre ← nombre copiado
  idMiembros, codigoMiembro, nombres, apellidos
  fotoUrl, fotoRuta        ← copia en directiva-historica/
  desde, hasta, nota, actualizadoPor…

directiva_nacional_permanentes/{idMiembros}
  directorNacional, exComandante, permisosDirectorNacional
  nombres, apellidos, fotoUrl, cuatrienios
```

- Los oficiales y ex comandantes llevan además la persona en el id
  (`…__oficiales__juan-perez`), porque son grupos y no casillas.
- `directiva_nacional_permanentes` se recalcula cada vez que cambia una fila de
  esa persona. Lo lee el servidor para la regla 3, así que escribirlo es dar
  permisos: mismas reglas que los integrantes.
- Reglas en `firestore.rules` (explícitas, fuera del comodín) y `storage.rules`.

## 5. Pantalla

- El título es el selector (`src/sections/national/cuatrienios/selector-de-cuatrienio.jsx`):
  al elegir un cuatrienio pasado, la tabla de la Directiva actual (Nombre,
  Posición, Nivel organizacional, Estructura, con sus filtros y la vista de
  tarjetas) se llena con los integrantes guardados, con la foto congelada.
  Provisionales, oficiales y ex comandantes van detrás de los cargos.
- **Pulsar la posición** abre los organigramas de siempre
  (`src/sections/{national,regional,sectional}/leadership`) en **modo histórico**
  (`historico`): mismos componentes, ocupantes y fotos del cuatrienio, solo
  lectura, sin tocar la directiva de hoy.
- **El diseño sí se edita** (el lápiz, solo el Administrador Global), igual que
  en la directiva de hoy: recolocar casillas y líneas. **Hay un solo diseño por
  organigrama para todos los cuatrienios**: se edite desde la directiva de hoy o
  desde una anterior, va a la misma entidad de `disenosDirectiva` y se ve en todas
  (`entidadesDeDisenoDe`); solo cambian los ocupantes, que ahí no se tocan. El
  documento `nacional_general-cuatrienio-2022-2026` es de una prueba anterior y
  ya no se lee (su contenido se copió al diseño nacional el 23/09/2026).
  Test: `tests/directivas/diseno-por-cuatrienio.test.mjs`.
- La pestaña **Jerarquía** lista todas las regiones y secciones del padrón
  (también las que no tienen a nadie asignado) y pinta el organigrama completo,
  con el alto de su diseño.
- Para quien edita: **Agregar** en el encabezado, **Editar** y **Eliminar** en
  el menú de cada fila (y por selección); **Cargar listado 2022-2026** en el
  encabezado (vista previa → Cargar); en el cuatrienio vigente, **Guardar en la
  memoria de 2026-2030** (copia las casillas nacionales, regionales y seccionales
  actuales con su foto). Lectura y diálogos en
  `src/sections/national/cuatrienios/herramientas-del-cuatrienio.jsx`.

Piezas: `src/utils/directiva-cuatrienios.mjs` (reglas puras),
`src/services/directiva-cuatrienios-service.js` (Firestore),
`src/services/directiva-importacion-service.js` (carga y foto de hoy),
`src/app/api/directiva-cuatrienios/congelar-foto/route.js` (copia de la foto),
`src/sections/national/cuatrienios/`.

Tests: `tests/directivas/directiva-cuatrienios.test.mjs` y
`tests/acceso/director-nacional-permanente.test.mjs`.

## 6. Decisiones tomadas sobre el listado

- "Comandante Nacional" es el nombre antiguo de "Director Nacional": los 7 ex
  comandantes conservan los permisos de Director Nacional.
- Son la misma persona (se unieron y vale su primera posición): Ruddyney
  Alcántara, Nehemías de León, Héctor Luis Ramírez y Federico Muñoz.
- Corregidos: Edison Suárez, Denis Rodríguez, y Arisleida y Alba Luisa con
  "ApellidoDesconocido".
- Solo se pusieron tildes y eñes donde la forma escrita no admite duda. Los
  apellidos poco comunes (Manan, Sigaran, Tavares, Gonzales, Turbi, "de lo
  Santos", Pijuan, Marcoas Reynozo, Hernesto, Rigoverto, Debora) quedan como en el
  documento, para corregirlos a mano si hace falta.
- La directiva de la Región Sur usaba "Secretario seccional"; se guarda como
  Secretario Regional. En la sección, Director y Sub-Director ocupan las casillas
  "Coordinador Seccional" y "Sub-Coordinador Seccional" del organigrama.
- El Secretario Nacional tiene casilla (`secretario-nacional`, en la fila del
  Consejo Ejecutivo, antes de Oficiales Especiales). Las filas guardadas cuando
  aún no la tenía llevan la posición vacía y se reconocen por su cargo
  (`ocupanteHistorico`). Test: `tests/directivas/secretario-nacional.test.mjs`.

## 7. Listado 2022-2026

Cargos estándar de cada directiva, en este orden: Director (en el Sur,
Comandante seccional), Sub Director (Sub comandante), Capellán, Secretario,
Coordinador de producción, Coordinador de programa, Coordinador de promoción y
Coordinador de adiestramiento. `—` = casilla vacía, no se agrega.
**Tachado** = repetido; vale su primera posición.

### Directiva Nacional

| Cargo | Persona |
|---|---|
| Director Nacional | Alejandro Terrero |
| Sub Director | Hector Pablo Valerio |
| Capellán | Mario Landa |
| Secretario | Bismal Canela |
| Coord. producción | Edward Encarnacion |
| Coord. programa | Juan Carlos Garcia |
| Coord. promoción | Wellinton Sanchez |
| Coord. adiestramiento | Mirke de Leon |
| Director Ministerio Infantil | Samuel Solis |

**Oficiales de la Nacional:** Bernardo Lorenzo, Eliezer Garcia, Franklin Perez,
Sonia Garcia, Federico Munoz, Maribel Sigaran, Nehemias de Leon, Ruddyney
Alcantara, Hector Luis, Yoryi Marte, Francisco Hassan.

**Ex comandantes nacionales** (regla 4, permanentes): Mirke de Leon (además de su
cargo), Amos Encarnacion, Dany Trinidad, Wilian de la Cruz, Domingo Amancio,
Rafael Cueto, Amarante Cueto.

### Región Central

| Cargo | Región Central | Este Central I | Central II | Este Oriental I | Este Oriental II | Oeste Occidental | Oeste Central |
|---|---|---|---|---|---|---|---|
| Director | Juan Ramon Corporan | Pedro Sanchez | Amaury Ferrer | Pedro Sepulveda | Abraham Batista Abad | Bienvenido Vargas | ~~Josue Rodriguez~~ — |
| Sub Director | Juaquin Martinez | Antony Rodriguez | Juan de Leon | Roderi Pena | Cristina Ester Perez | ~~Carmen Maria Lorenzo~~ — | Victor Lopez |
| Capellán | Tammy Savinon | Reynaldo Reinoso | Denis Rodríguez | Francisco Jose Manan | Cristian Benitez | Merari Mateo | Elvis Ponciano |
| Secretario | Viterbo Cabrera | Jendri Roman | Sayhira Marcelina Heredia | Yailin Martinez | Angel Encarnacion | Juan Carlos Araujo | Nahum Ventura |
| Producción | Carmen Maria Lorenzo | — | Jose Antonio Rosario | Yorman Alfonseca | Josue Garcia Martinez | Ramon Lorenzo | Love Charles |
| Programa | Misael Amancio | — | Modesto Garcia | Daniel Peguero | Antonio Rojas | Cindy Quinta | — |
| Promoción | Josue Rodriguez | Luis Puntiel | Santiago Roca | Wilmer Pena Suero | Enmanuel Alfonseca | Jose Acosta | Jose Holguin |
| Adiestramiento | Starlin Peralta | — | Jorge Luis Pena | ~~Héctor Luis Ramírez~~ — | Rafael Quezada Leon | Robert Terrero | Francisco Rodriguez |

### Región Este

| Cargo | Región Este | San Pedro | Romana 1 | Romana 2 | Hato Mayor | Seibo | Higüey |
|---|---|---|---|---|---|---|---|
| Director | Rhamfi R. Garcia C | Peliardo Vitini | Clary Rosa Cuevas | Santo Gil | Jeison Mendez Almonte | Jose Alberto de lo Santos | Wagner Betances |
| Sub Director | Orlando Canela | Roberto Rivera | Cristian Galvez | Juan Carlos Baez | Ismael Dominguez | Elione Cordero | Erick Guerrero |
| Capellán | Juan Alberto Alvarez | Jesus Tavares | Alexis Caraballo | Jesus Guerrero | Albania de la Cruz | Benjamin Mercedes | Darly de la Rosa |
| Secretario | ~~Federico Muñoz~~ — | Esteven Santiago de Azar | Monica Torres | Luz Esther Sanchez Berroa | Gabriela Turbi | Ruth Reyes | Albania Rodriguez |
| Producción | Benjamin Perez | Ruben Natera | Emilia Silvestre | Angel Martinez | Regino Veras Cabrera | Franklin Andujar | Angel Loren Segura |
| Programa | Alba Luisa ApellidoDesconocido | Ruben Alexis Gonzales | Jose Antonio Baez | Arsenio Encarnacion | Gismaellin Dominguez | Samuel Pijuan | Milciades Moscoso |
| Promoción | Soranyi Santana | Michael Ortiz | Haniel Guerrero | Oscar Javier | Gisela Silvestre | Rosa de lo Santos | Roberto Reyes |
| Adiestramiento | Rony Sanchez | Juana Herrera | Matiel Escorbores | David Ortiz | Victor Jose Florian | Alberto Cote | Jensy Polanco |

### Región Sur

| Cargo | Región Sur | San Cristóbal | Baní-Ocoa | Azua | San Juan–Elías Piña | Haina |
|---|---|---|---|---|---|---|
| Director / Comandante | Wilkin Bautista | Diony Encarnacion | Felix Miguel Espinosa | Yadiel Feliz | ~~Ruddyney Alcántara~~ — | Juan Carlos Campusano |
| Sub Director / Sub comandante | Starling Guzman | Alex Guzman | Robert Pena | Diego Rosario | Ivan Jimenez Alcantara | Elvin Candelario |
| Capellán | Josue Guerrero | Jhon Marcoas Reynozo | Joel Valdez | Ramon Antonio Matos | Francisco A. Sanchez Rosso | Amaurys de Los Santos |
| Secretario | Alberto Campusano | Ana Rosario | Carlos Valdez | Alina Mendez | Neysi Maria Santiago | Rigoverto Salas |
| Producción | Edison Suárez | Francisco Robles | Felix Alberto Espinola | Dailer Tejada | Edwin Quevedo Montero | Franlin Campusano |
| Programa | Marcos Almonte | Fernando Zoquier | Pedro Julio Veloz Reyes | Raphet Suazo Perez | Abel Garcia | Juan Alberto Abreu |
| Promoción | Juan Carlos de Leon | Sandy Sanchez | Roman Mene Amador | Enrique Rodriguez | Hernesto Jaquez Lorenzo | Ruben Maldonado |
| Adiestramiento | Isaias Diaz | Joel Mota | Juan Miguel Santo Baez | Rolando Figueroa | Galvy Montero Medina | Yeudy Brito |

### Región Norte

| Cargo | Región Norte | Santiago | La Vega | San Francisco |
|---|---|---|---|---|
| Director | Daniel Cornelio | — | Abel Castro | Jose Miguel Garcia |
| Sub Director | Edwin Acevedo | — | Yonatan Garcia | Roberto Pichardo |
| Capellán | Milciades Batista | — | Silvio Fernandez | Jesus Hernandez |
| Secretario | Pablo Cirineo | — | Nathaly Vazquez | Carlos Manuel Meran |
| Producción | Eduardo Bonilla | — | Enmanuel Debora | Ehimy Rodriguez |
| Programa | Arisleida ApellidoDesconocido | — | Damaris Castro | Yiriany Olivero |
| Promoción | Domingo Luna | — | Joel Ortega | Veronica Reyes |
| Adiestramiento | ~~Nehemías de León~~ — | — | Ivan Lopez | Alex Campo |

Santiago se crea como sección, con la directiva vacía.
