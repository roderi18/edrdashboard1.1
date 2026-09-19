// ----------------------------------------------------------------------
// Directiva Nacional del cuatrienio 2022-2026, tal como la entregó la
// organización ("Listado de los votantes 123.docx").
//
// Es la fuente de la importación que hace la Oficina Nacional o el Administrador
// Global desde /dashboard/level/national → "Directivas por cuatrienio". Se copia
// aquí, y no se lee del documento, para que la carga sea repetible: correrla dos
// veces no crea a nadie dos veces (ver `directiva-importacion-service.js`).
//
// Los nombres llevan tildes y eñes solo donde la forma escrita no admite duda
// (García, Peña, Muñoz...); un apellido poco común se deja como venía, porque
// "corregirlo" podía ser cambiarle el nombre a alguien. Las cuatro personas que
// el documento escribía de dos maneras van con la misma forma en las dos
// posiciones (Ruddyney Alcántara, Nehemías de León, Héctor Luis Ramírez y
// Federico Muñoz): así la regla "vale la primera posición" las reconoce como la
// misma persona. Los que el documento dejaba a medias se corrigieron con la
// organización: Edison Suárez, Denis Rodríguez, y Arisleida y Alba Luisa con
// "ApellidoDesconocido".
//
// Cada casilla es [cargo, nombres, apellidos]. Sin nombres, es una vacante y no
// se agrega. Los cargos son los de `CARGOS_DIRECTIVA` en
// `src/utils/directiva-cuatrienios.mjs`.
// ----------------------------------------------------------------------

export const ID_CUATRIENIO_LISTADO = '2022-2026';

const directiva = (...casillas) => casillas;

export const DIRECTIVA_2022_2026 = {
  nacional: {
    directiva: directiva(
      ['director', 'Alejandro', 'Terrero'],
      ['subdirector', 'Héctor Pablo', 'Valerio'],
      ['capellan', 'Mario', 'Landa'],
      ['secretario', 'Bismal', 'Canela'],
      ['produccion', 'Edward', 'Encarnación'],
      ['programa', 'Juan Carlos', 'García'],
      ['promocion', 'Wellinton', 'Sánchez'],
      ['adiestramiento', 'Mirke', 'de León'],
      ['ministerio_infantil', 'Samuel', 'Solís']
    ),
    oficiales: [
      ['Bernardo', 'Lorenzo'],
      ['Eliezer', 'García'],
      ['Franklin', 'Pérez'],
      ['Sonia', 'García'],
      ['Federico', 'Muñoz'],
      ['Maribel', 'Sigaran'],
      ['Nehemías', 'de León'],
      ['Ruddyney', 'Alcántara'],
      ['Héctor Luis', 'Ramírez'],
      ['Yoryi', 'Marte'],
      ['Francisco', 'Hassan'],
    ],
    // "Comandante Nacional" es el nombre antiguo de "Director Nacional".
    exComandantes: [
      ['Mirke', 'de León'],
      ['Amós', 'Encarnación'],
      ['Dany', 'Trinidad'],
      ['Wilian', 'de la Cruz'],
      ['Domingo', 'Amancio'],
      ['Rafael', 'Cueto'],
      ['Amarante', 'Cueto'],
    ],
  },

  regiones: [
    {
      nombre: 'Región Central',
      directiva: directiva(
        ['director', 'Juan Ramón', 'Corporán'],
        ['subdirector', 'Juaquín', 'Martínez'],
        ['capellan', 'Tammy', 'Saviñón'],
        ['secretario', 'Viterbo', 'Cabrera'],
        ['produccion', 'Carmen María', 'Lorenzo'],
        ['programa', 'Misael', 'Amancio'],
        ['promocion', 'Josué', 'Rodríguez'],
        ['adiestramiento', 'Starlin', 'Peralta']
      ),
      secciones: [
        {
          nombre: 'Este Central I',
          directiva: directiva(
            ['director', 'Pedro', 'Sánchez'],
            ['subdirector', 'Antony', 'Rodríguez'],
            ['capellan', 'Reynaldo', 'Reinoso'],
            ['secretario', 'Jendri', 'Román'],
            ['produccion'],
            ['programa'],
            ['promocion', 'Luis', 'Puntiel'],
            ['adiestramiento']
          ),
        },
        {
          nombre: 'Central II',
          directiva: directiva(
            ['director', 'Amaury', 'Ferrer'],
            ['subdirector', 'Juan', 'de León'],
            ['capellan', 'Denis', 'Rodríguez'],
            ['secretario', 'Sayhira Marcelina', 'Heredia'],
            ['produccion', 'José Antonio', 'Rosario'],
            ['programa', 'Modesto', 'García'],
            ['promocion', 'Santiago', 'Roca'],
            ['adiestramiento', 'Jorge Luis', 'Peña']
          ),
        },
        {
          nombre: 'Este Oriental I',
          directiva: directiva(
            ['director', 'Pedro', 'Sepúlveda'],
            ['subdirector', 'Roderi', 'Peña'],
            ['capellan', 'Francisco José', 'Manan'],
            ['secretario', 'Yailin', 'Martínez'],
            ['produccion', 'Yorman', 'Alfonseca'],
            ['programa', 'Daniel', 'Peguero'],
            ['promocion', 'Wilmer', 'Peña Suero'],
            ['adiestramiento', 'Héctor Luis', 'Ramírez']
          ),
        },
        {
          nombre: 'Este Oriental II',
          directiva: directiva(
            ['director', 'Abraham', 'Batista Abad'],
            ['subdirector', 'Cristina Ester', 'Pérez'],
            ['capellan', 'Cristian', 'Benítez'],
            ['secretario', 'Ángel', 'Encarnación'],
            ['produccion', 'Josué', 'García Martínez'],
            ['programa', 'Antonio', 'Rojas'],
            ['promocion', 'Enmanuel', 'Alfonseca'],
            ['adiestramiento', 'Rafael', 'Quezada León']
          ),
        },
        {
          nombre: 'Oeste Occidental',
          directiva: directiva(
            ['director', 'Bienvenido', 'Vargas'],
            ['subdirector', 'Carmen María', 'Lorenzo'],
            ['capellan', 'Merari', 'Mateo'],
            ['secretario', 'Juan Carlos', 'Araujo'],
            ['produccion', 'Ramón', 'Lorenzo'],
            ['programa', 'Cindy', 'Quinta'],
            ['promocion', 'José', 'Acosta'],
            ['adiestramiento', 'Robert', 'Terrero']
          ),
        },
        {
          nombre: 'Oeste Central',
          directiva: directiva(
            ['director', 'Josué', 'Rodríguez'],
            ['subdirector', 'Víctor', 'López'],
            ['capellan', 'Elvis', 'Ponciano'],
            ['secretario', 'Nahum', 'Ventura'],
            ['produccion', 'Love', 'Charles'],
            ['programa'],
            ['promocion', 'José', 'Holguín'],
            ['adiestramiento', 'Francisco', 'Rodríguez']
          ),
        },
      ],
    },
    {
      nombre: 'Región Este',
      directiva: directiva(
        ['director', 'Rhamfi R.', 'García C.'],
        ['subdirector', 'Orlando', 'Canela'],
        ['capellan', 'Juan Alberto', 'Álvarez'],
        ['secretario', 'Federico', 'Muñoz'],
        ['produccion', 'Benjamín', 'Pérez'],
        ['programa', 'Alba Luisa', 'ApellidoDesconocido'],
        ['promocion', 'Soranyi', 'Santana'],
        ['adiestramiento', 'Rony', 'Sánchez']
      ),
      secciones: [
        {
          nombre: 'San Pedro',
          directiva: directiva(
            ['director', 'Peliardo', 'Vitini'],
            ['subdirector', 'Roberto', 'Rivera'],
            ['capellan', 'Jesús', 'Tavares'],
            ['secretario', 'Esteven', 'Santiago de Azar'],
            ['produccion', 'Rubén', 'Natera'],
            ['programa', 'Rubén Alexis', 'Gonzales'],
            ['promocion', 'Michael', 'Ortiz'],
            ['adiestramiento', 'Juana', 'Herrera']
          ),
        },
        {
          nombre: 'Romana 1',
          directiva: directiva(
            ['director', 'Clary Rosa', 'Cuevas'],
            ['subdirector', 'Cristian', 'Gálvez'],
            ['capellan', 'Alexis', 'Caraballo'],
            ['secretario', 'Mónica', 'Torres'],
            ['produccion', 'Emilia', 'Silvestre'],
            ['programa', 'José Antonio', 'Báez'],
            ['promocion', 'Haniel', 'Guerrero'],
            ['adiestramiento', 'Matiel', 'Escorbores']
          ),
        },
        {
          nombre: 'Romana 2',
          directiva: directiva(
            ['director', 'Santo', 'Gil'],
            ['subdirector', 'Juan Carlos', 'Báez'],
            ['capellan', 'Jesús', 'Guerrero'],
            ['secretario', 'Luz Esther', 'Sánchez Berroa'],
            ['produccion', 'Ángel', 'Martínez'],
            ['programa', 'Arsenio', 'Encarnación'],
            ['promocion', 'Óscar', 'Javier'],
            ['adiestramiento', 'David', 'Ortiz']
          ),
        },
        {
          nombre: 'Hato Mayor',
          directiva: directiva(
            ['director', 'Jeison', 'Méndez Almonte'],
            ['subdirector', 'Ismael', 'Domínguez'],
            ['capellan', 'Albania', 'de la Cruz'],
            ['secretario', 'Gabriela', 'Turbi'],
            ['produccion', 'Regino', 'Veras Cabrera'],
            ['programa', 'Gismaellin', 'Domínguez'],
            ['promocion', 'Gisela', 'Silvestre'],
            ['adiestramiento', 'Víctor José', 'Florián']
          ),
        },
        {
          nombre: 'Seibo',
          directiva: directiva(
            ['director', 'José Alberto', 'de lo Santos'],
            ['subdirector', 'Elione', 'Cordero'],
            ['capellan', 'Benjamín', 'Mercedes'],
            ['secretario', 'Ruth', 'Reyes'],
            ['produccion', 'Franklin', 'Andújar'],
            ['programa', 'Samuel', 'Pijuan'],
            ['promocion', 'Rosa', 'de lo Santos'],
            ['adiestramiento', 'Alberto', 'Cote']
          ),
        },
        {
          nombre: 'Higüey',
          directiva: directiva(
            ['director', 'Wagner', 'Betances'],
            ['subdirector', 'Erick', 'Guerrero'],
            ['capellan', 'Darly', 'de la Rosa'],
            ['secretario', 'Albania', 'Rodríguez'],
            ['produccion', 'Ángel Loren', 'Segura'],
            ['programa', 'Milciades', 'Moscoso'],
            ['promocion', 'Roberto', 'Reyes'],
            ['adiestramiento', 'Jensy', 'Polanco']
          ),
        },
      ],
    },
    {
      nombre: 'Región Sur',
      directiva: directiva(
        ['director', 'Wilkin', 'Bautista'],
        ['subdirector', 'Starling', 'Guzmán'],
        ['capellan', 'Josué', 'Guerrero'],
        ['secretario', 'Alberto', 'Campusano'],
        ['produccion', 'Edison', 'Suárez'],
        ['programa', 'Marcos', 'Almonte'],
        ['promocion', 'Juan Carlos', 'de León'],
        ['adiestramiento', 'Isaías', 'Díaz']
      ),
      secciones: [
        {
          nombre: 'San Cristóbal',
          directiva: directiva(
            ['director', 'Diony', 'Encarnación'],
            ['subdirector', 'Alex', 'Guzmán'],
            ['capellan', 'Jhon Marcoas', 'Reynozo'],
            ['secretario', 'Ana', 'Rosario'],
            ['produccion', 'Francisco', 'Robles'],
            ['programa', 'Fernando', 'Zoquier'],
            ['promocion', 'Sandy', 'Sánchez'],
            ['adiestramiento', 'Joel', 'Mota']
          ),
        },
        {
          nombre: 'Baní-Ocoa',
          directiva: directiva(
            ['director', 'Félix Miguel', 'Espinosa'],
            ['subdirector', 'Robert', 'Peña'],
            ['capellan', 'Joel', 'Valdez'],
            ['secretario', 'Carlos', 'Valdez'],
            ['produccion', 'Félix Alberto', 'Espínola'],
            ['programa', 'Pedro Julio', 'Veloz Reyes'],
            ['promocion', 'Román', 'Mene Amador'],
            ['adiestramiento', 'Juan Miguel', 'Santo Báez']
          ),
        },
        {
          nombre: 'Azua',
          directiva: directiva(
            ['director', 'Yadiel', 'Féliz'],
            ['subdirector', 'Diego', 'Rosario'],
            ['capellan', 'Ramón Antonio', 'Matos'],
            ['secretario', 'Alina', 'Méndez'],
            ['produccion', 'Dailer', 'Tejada'],
            ['programa', 'Raphet', 'Suazo Pérez'],
            ['promocion', 'Enrique', 'Rodríguez'],
            ['adiestramiento', 'Rolando', 'Figueroa']
          ),
        },
        {
          nombre: 'San Juan–Elías Piña',
          directiva: directiva(
            ['director', 'Ruddyney', 'Alcántara'],
            ['subdirector', 'Iván', 'Jiménez Alcántara'],
            ['capellan', 'Francisco A.', 'Sánchez Rosso'],
            ['secretario', 'Neysi María', 'Santiago'],
            ['produccion', 'Edwin', 'Quevedo Montero'],
            ['programa', 'Abel', 'García'],
            ['promocion', 'Hernesto', 'Jáquez Lorenzo'],
            ['adiestramiento', 'Galvy', 'Montero Medina']
          ),
        },
        {
          nombre: 'Haina',
          directiva: directiva(
            ['director', 'Juan Carlos', 'Campusano'],
            ['subdirector', 'Elvin', 'Candelario'],
            ['capellan', 'Amaurys', 'de los Santos'],
            ['secretario', 'Rigoverto', 'Salas'],
            ['produccion', 'Franlin', 'Campusano'],
            ['programa', 'Juan Alberto', 'Abreu'],
            ['promocion', 'Rubén', 'Maldonado'],
            ['adiestramiento', 'Yeudy', 'Brito']
          ),
        },
      ],
    },
    {
      nombre: 'Región Norte',
      directiva: directiva(
        ['director', 'Daniel', 'Cornelio'],
        ['subdirector', 'Edwin', 'Acevedo'],
        ['capellan', 'Milciades', 'Batista'],
        ['secretario', 'Pablo', 'Cirineo'],
        ['produccion', 'Eduardo', 'Bonilla'],
        ['programa', 'Arisleida', 'ApellidoDesconocido'],
        ['promocion', 'Domingo', 'Luna'],
        ['adiestramiento', 'Nehemías', 'de León']
      ),
      secciones: [
        // Existe en el padrón y el documento la trae sin nadie.
        {
          nombre: 'Santiago',
          directiva: directiva(),
        },
        {
          nombre: 'La Vega',
          directiva: directiva(
            ['director', 'Abel', 'Castro'],
            ['subdirector', 'Yonatan', 'García'],
            ['capellan', 'Silvio', 'Fernández'],
            ['secretario', 'Nathaly', 'Vázquez'],
            ['produccion', 'Enmanuel', 'Debora'],
            ['programa', 'Damaris', 'Castro'],
            ['promocion', 'Joel', 'Ortega'],
            ['adiestramiento', 'Iván', 'López']
          ),
        },
        {
          // En el padrón se llama "San Francisco de Macorís".
          nombre: 'San Francisco',
          alias: ['San Francisco de Macorís'],
          directiva: directiva(
            ['director', 'José Miguel', 'García'],
            ['subdirector', 'Roberto', 'Pichardo'],
            ['capellan', 'Jesús', 'Hernández'],
            ['secretario', 'Carlos Manuel', 'Merán'],
            ['produccion', 'Ehimy', 'Rodríguez'],
            ['programa', 'Yiriany', 'Olivero'],
            ['promocion', 'Verónica', 'Reyes'],
            ['adiestramiento', 'Alex', 'Campo']
          ),
        },
      ],
    },
  ],
};
