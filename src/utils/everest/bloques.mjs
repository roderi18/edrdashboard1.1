// ----------------------------------------------------------------------
// LOS BLOQUES QUE EDITA EXPLORA DESIGNER.
//
// Es la UNICA lista. De aqui salen el menu del Designer, lo que se puede publicar
// y como se limpia cada cosa antes de pintarse. Un bloque nuevo en la portada se
// añade aqui y en ningun otro sitio de la logica.
//
// CADA BLOQUE GUARDA LA MISMA FORMA QUE HOY RECIBE SU COMPONENTE. Lo publicado
// sustituye tal cual al valor de fabrica de `datos-de-ejemplo.js`, sin traducir
// nada, y por eso un bloque que nunca se publico se ve exactamente como hoy. Los
// campos mas ricos (fechas de verdad, botones, audiencia) se añaden a cada forma
// cuando llegue su editor, no antes.
//
// `sanear` devuelve el contenido limpio o `null`. Un `null` no se pinta: la
// portada vuelve al valor de fabrica de ese bloque (ver `portada.mjs`).
//
// `externo` marca lo que ya tiene su propio almacen y su propio saneado —el
// encabezado de la tienda—. El Designer lo aloja, pero no lo guarda aqui.
// ----------------------------------------------------------------------

import { PANTALLAS_EXPLORA } from './colecciones.mjs';
import {
  boton,
  clave,
  icono,
  lista,
  medio,
  texto,
  numero,
  destino,
  esObjeto,
  fechaISO,
  siTodoVale,
  acentoDeMarca,
  colorDeEstado,
  conOpcionales,
  clavesSinRepetir,
} from './saneado.mjs';

export const GRUPOS_DE_BLOQUES = Object.freeze({
  encabezados: 'Encabezados',
  inicio: 'Inicio',
  lateral: 'Columna lateral',
});

const DIA_DEL_MES = /^(0[1-9]|[12]\d|3[01])$/;
const MES_ABREVIADO = /^[A-ZÁÉÍÓÚÑ]{3}$/;

/** Una lista con claves validas y que no se repiten. */
const listaConClaves = (valor, elemento, opciones) => {
  const elementos = lista(valor, elemento, opciones);

  return elementos && clavesSinRepetir(elementos) ? elementos : null;
};

// ----------------------------------------------------------------------

const sanearBienvenida = (contenido) => {
  if (!esObjeto(contenido) || !esObjeto(contenido.nivel)) return null;

  const base = siTodoVale({
    lema: texto(contenido.lema, { max: 160, obligatorio: true }),
    cifras: listaConClaves(
      contenido.cifras,
      (cifra) =>
        esObjeto(cifra)
          ? siTodoVale({
              clave: clave(cifra.clave),
              valor: numero(cifra.valor, { min: 0, max: 1_000_000 }),
              etiqueta: texto(cifra.etiqueta, { max: 40, obligatorio: true }),
              icono: icono(cifra.icono),
            })
          : null,
      { max: 4 }
    ),
    nivel: siTodoVale({
      numero: numero(contenido.nivel.numero, { min: 0, max: 100, entero: true }),
      nombre: texto(contenido.nivel.nombre, { max: 40, obligatorio: true }),
      porcentaje: numero(contenido.nivel.porcentaje, { min: 0, max: 100 }),
    }),
  });

  // El fondo propio (fase 4). La bienvenida es un banner ancho con texto encima:
  // solo imagen, igual que su lapiz de hoy.
  return conOpcionales(base, contenido, {
    fondo: (valor) => medio(valor, { tipos: ['imagen'] }),
  });
};

const sanearAccesosRapidos = (contenido) =>
  listaConClaves(
    contenido,
    (acceso) =>
      esObjeto(acceso)
        ? siTodoVale({
            clave: clave(acceso.clave),
            titulo: texto(acceso.titulo, { max: 40, obligatorio: true }),
            icono: icono(acceso.icono),
            acento: acentoDeMarca(acceso.acento),
            href: destino(acceso.href),
          })
        : null,
    { max: 8 }
  );

const sanearProximaActividad = (contenido) => {
  if (!esObjeto(contenido)) return null;

  // CON FECHA DE INICIO, LAS FECHAS Y LOS DIAS SE CALCULAN AL PINTAR
  // (`actividadParaPintar`), asi que ya no hace falta escribirlos. Sin ella, son
  // obligatorios como en el valor de fabrica.
  const conFechaReal = fechaISO(contenido.fechaInicio) !== null;

  const base = siTodoVale({
    titulo: texto(contenido.titulo, { max: 120, obligatorio: true }),
    lugar: texto(contenido.lugar, { max: 160 }),
    ...(!conFechaReal && {
      fechas: texto(contenido.fechas, { max: 80 }),
      diasQueFaltan: numero(contenido.diasQueFaltan, { min: 0, max: 3650, entero: true }),
    }),
    estado: texto(contenido.estado, { max: 40 }),
  });

  const limpio = conOpcionales(base, contenido, {
    fechaInicio: fechaISO,
    fechaFin: fechaISO,
    fondo: (valor) => medio(valor),
    boton,
  });

  // Una actividad que termina antes de empezar es un error al elegir las fechas.
  if (limpio?.fechaFin && (!limpio.fechaInicio || limpio.fechaFin < limpio.fechaInicio)) {
    return null;
  }

  return limpio;
};

const sanearMiProgreso = (contenido) => {
  if (!esObjeto(contenido)) return null;

  const progreso = siTodoVale({
    nivel: texto(contenido.nivel, { max: 60, obligatorio: true }),
    porcentaje: numero(contenido.porcentaje, { min: 0, max: 100 }),
    hechas: numero(contenido.hechas, { min: 0, max: 10_000, entero: true }),
    total: numero(contenido.total, { min: 1, max: 10_000, entero: true }),
    areas: lista(
      contenido.areas,
      (area) =>
        esObjeto(area)
          ? siTodoVale({
              nombre: texto(area.nombre, { max: 60, obligatorio: true }),
              estado: texto(area.estado, { max: 40, obligatorio: true }),
              avance: numero(area.avance, { min: 0, max: 100 }),
              acento: acentoDeMarca(area.acento),
            })
          : null,
      { max: 6 }
    ),
  });

  // "30 de 24" no es un progreso: es un error de quien lo escribio.
  return progreso && progreso.hechas <= progreso.total ? progreso : null;
};

const sanearHistorias = (contenido) =>
  listaConClaves(
    contenido,
    (historia) =>
      esObjeto(historia)
        ? siTodoVale({
            clave: clave(historia.clave),
            titulo: texto(historia.titulo, { max: 40, obligatorio: true }),
          })
        : null,
    { max: 20 }
  );

const sanearProximosEventos = (contenido) =>
  listaConClaves(
    contenido,
    (evento) =>
      esObjeto(evento)
        ? // La fecha completa es opcional (fase 4): con ella, el evento se deja de
          // enseñar solo cuando ya paso (`eventosVigentes`).
          conOpcionales(
            siTodoVale({
              clave: clave(evento.clave),
              dia: DIA_DEL_MES.test(String(evento.dia)) ? evento.dia : null,
              mes: MES_ABREVIADO.test(String(evento.mes)) ? evento.mes : null,
              titulo: texto(evento.titulo, { max: 120, obligatorio: true }),
              lugar: texto(evento.lugar, { max: 160 }),
              estado: texto(evento.estado, { max: 40 }),
              color: colorDeEstado(evento.color),
            }),
            evento,
            { fecha: fechaISO }
          )
        : null,
    { max: 10 }
  );

const sanearDestacamentoDestacado = (contenido) =>
  esObjeto(contenido)
    ? siTodoVale({
        nombre: texto(contenido.nombre, { max: 120, obligatorio: true }),
        region: texto(contenido.region, { max: 80 }),
        miembros: numero(contenido.miembros, { min: 0, max: 10_000, entero: true }),
        valoracion: numero(contenido.valoracion, { min: 0, max: 5 }),
      })
    : null;

const sanearComunicados = (contenido) =>
  listaConClaves(
    contenido,
    (comunicado) =>
      esObjeto(comunicado)
        ? siTodoVale({
            clave: clave(comunicado.clave),
            origen: texto(comunicado.origen, { max: 80, obligatorio: true }),
            titulo: texto(comunicado.titulo, { max: 160, obligatorio: true }),
            fecha: texto(comunicado.fecha, { max: 40, obligatorio: true }),
          })
        : null,
    { max: 10 }
  );

const sanearLema = (contenido) =>
  esObjeto(contenido)
    ? siTodoVale({
        titulo: texto(contenido.titulo, { max: 120, obligatorio: true }),
        pie: texto(contenido.pie, { max: 80 }),
      })
    : null;

// ----------------------------------------------------------------------

const bloque = (definicion) =>
  Object.freeze({ pantalla: PANTALLAS_EXPLORA.principal, ...definicion });

/** En el orden en que salen en el Designer. */
export const BLOQUES_EXPLORA = Object.freeze([
  bloque({
    id: 'bienvenida',
    nombre: 'Bienvenida',
    grupo: GRUPOS_DE_BLOQUES.encabezados,
    // El fondo sigue en `fotos` → `principalTarjeta/bienvenida` hasta que se
    // publique uno nuevo.
    medioDeTarjeta: Object.freeze({ idTarjeta: 'bienvenida', aceptaVideo: false }),
    sanear: sanearBienvenida,
  }),
  bloque({
    id: 'encabezado-tienda',
    nombre: 'Encabezado de la tienda',
    grupo: GRUPOS_DE_BLOQUES.encabezados,
    pantalla: 'tienda',
    // Tiene almacen y saneado propios (`store-settings-service.js`): el Designer
    // lo aloja, no lo copia.
    externo: 'configuracion_tienda/encabezado',
  }),
  bloque({
    id: 'accesos-rapidos',
    nombre: 'Accesos rápidos',
    grupo: GRUPOS_DE_BLOQUES.inicio,
    sanear: sanearAccesosRapidos,
    // RETIRADO. La portada ya no pinta los accesos rápidos (ni hay interruptor en
    // Ajustes), pero el Designer seguía ofreciendo editarlos y publicarlos sin
    // que cambiara nada. Se queda la definición —y su saneado— para no romper lo
    // que ya estuviera publicado (el lector lo sigue saneando); no sale en el
    // Designer.
    retirado: true,
  }),
  bloque({
    id: 'proxima-actividad',
    nombre: 'Próxima actividad',
    grupo: GRUPOS_DE_BLOQUES.inicio,
    // Admite un video corto, que corre en bucle: el lapiz de hoy ya lo acepta.
    medioDeTarjeta: Object.freeze({ idTarjeta: 'proxima-actividad', aceptaVideo: true }),
    sanear: sanearProximaActividad,
  }),
  bloque({
    id: 'mi-progreso',
    nombre: 'Mi progreso',
    grupo: GRUPOS_DE_BLOQUES.inicio,
    sanear: sanearMiProgreso,
  }),
  bloque({
    id: 'historias',
    nombre: 'Historias',
    grupo: GRUPOS_DE_BLOQUES.inicio,
    sanear: sanearHistorias,
  }),
  bloque({
    id: 'proximos-eventos',
    nombre: 'Próximos eventos',
    grupo: GRUPOS_DE_BLOQUES.lateral,
    sanear: sanearProximosEventos,
  }),
  bloque({
    id: 'destacamento-destacado',
    nombre: 'Destacamento destacado',
    grupo: GRUPOS_DE_BLOQUES.lateral,
    sanear: sanearDestacamentoDestacado,
  }),
  bloque({
    id: 'comunicados',
    nombre: 'Comunicados oficiales',
    grupo: GRUPOS_DE_BLOQUES.lateral,
    sanear: sanearComunicados,
  }),
  bloque({
    id: 'lema',
    nombre: 'Lema',
    grupo: GRUPOS_DE_BLOQUES.lateral,
    // El titulo admite un salto de linea (`\n`): `PrincipalLema` lo pinta como el
    // `<br />` que llevaba escrito.
    sanear: sanearLema,
  }),
]);

export const bloquePorId = (id) => BLOQUES_EXPLORA.find((item) => item.id === id) ?? null;

/** Los bloques que se guardan en el documento publicado de esa pantalla. */
export const bloquesPublicablesDe = (pantalla) =>
  BLOQUES_EXPLORA.filter((item) => item.pantalla === pantalla && !item.externo);

/** Los que ofrece el Designer: todos menos los retirados. */
export const BLOQUES_DEL_DESIGNER = Object.freeze(BLOQUES_EXPLORA.filter((item) => !item.retirado));
