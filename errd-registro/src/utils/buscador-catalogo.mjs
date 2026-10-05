// ----------------------------------------------------------------------
// EL CATALOGO QUE SE BUSCA DESDE LA CABECERA.
//
// El buscador solo miraba los nombres de las PANTALLAS del menu, y lo que la
// gente escribe ahi son nombres de cosas: "emblema", "1 Cronicas", "cinta". Aqui
// vive lo que decide que sale y en que orden, sin React ni Firebase, para poder
// probarlo con el codigo de verdad.
// ----------------------------------------------------------------------

// Cada premio sale con el icono de su GRUPO cuando lo tiene y, si no, con el de
// su DIVISION. Son los mismos archivos que ya usa la pantalla de ascenso, de 3 a
// 20 kB y en la cache del navegador: aparecen a la vez que el texto. Los premios
// no tienen imagen propia en ninguna parte —`itemsAscenso` solo guarda nombre,
// grupo, division y ruta—, asi que esta es la unica cara honesta que se les puede
// poner.
const ICONO_POR_GRUPO = {
  instructor: '/icons/academia-ministerial.png',
  'lider-juvenil': '/icons/ilj.png',
  'lider-de-destacamento': '/icons/cuadro-avanzado.png',
  'lider-organizacional': '/icons/lider-organizacional.png',
  fundamentos: '/icons/fundamentos.png',
  mentores: '/icons/mentores.png',
  'seguridad-y-primeros-auxilios': '/icons/seguridad.png',
  'destacamento-de-clase-mundial': '/icons/dcm.png',
  'campamento-nacional-ministerial': '/icons/cnm.png',
  'campamento-de-barras-doradas': '/icons/cbd.png',
  'cuadro-avanzado': '/icons/cuadro-avanzado.png',
};

const ICONO_POR_DIVISION = {
  exploradores: '/icons/exploradores.png',
  pioneros: '/icons/pioneros.png',
  navegantes: '/icons/navegantes.png',
  seguidores: '/icons/seguidores.png',
};

const ICONO_POR_DEFECTO = '/icons/exploradores-del-rey.png';

const clave = (valor) =>
  String(valor ?? '')
    .trim()
    .toLowerCase();

export const iconoDePremio = ({ idGrupo = '', idDivision = '' } = {}) => {
  const grupo = clave(idGrupo);

  if (ICONO_POR_GRUPO[grupo]) return ICONO_POR_GRUPO[grupo];

  // Los grupos del sistema de ascenso llevan la division delante
  // (`pioneros__premios-biblicos-naranja`), asi que se mira ahi antes de rendirse.
  const division = clave(idDivision) || grupo.split('__')[0];

  return ICONO_POR_DIVISION[division] ?? ICONO_POR_DEFECTO;
};

// ----------------------------------------------------------------------
// LA BUSQUEDA
// ----------------------------------------------------------------------

/**
 * Sin tildes y en minusculas.
 *
 * Quien busca "cronicas" tiene que encontrar "1 Crónicas", y quien busca
 * "Crónicas" tambien: en un teclado de telefono la tilde se pone sola o no se
 * pone, y el catalogo no puede depender de eso.
 */
export const normalizarTexto = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

/**
 * Los resultados de una consulta, ordenados por lo cerca que empiezan.
 *
 * Lo que EMPIEZA por lo escrito va antes que lo que lo lleva por dentro: al
 * escribir "emb", "Emblema grande" tiene que salir por encima de "Distintivo con
 * emblema". Y el tope no es decoracion: el desplegable enseña unos pocos y la
 * lista entera son 600 nombres.
 */
export const buscarEnCatalogo = ({ catalogo = [], consulta = '', tope = 6 } = {}) => {
  const texto = normalizarTexto(consulta);

  if (!texto) return [];

  return catalogo
    .map((elemento) => {
      // Tambien por categoria y por grupo: mucha gente busca por familia
      // ("parches", "accesorios", "premios biblicos") y no por el nombre exacto.
      const campos = [
        elemento.nombre,
        elemento.codigo,
        elemento.categoria,
        elemento.grupo,
        elemento.division,
      ]
        .filter(Boolean)
        .map(normalizarTexto);
      const posicion = campos
        .map((campo) => campo.indexOf(texto))
        .filter((indice) => indice >= 0)
        .sort((a, b) => a - b)[0];

      return posicion === undefined ? null : { elemento, posicion };
    })
    .filter(Boolean)
    .sort(
      (a, b) => a.posicion - b.posicion || a.elemento.nombre.localeCompare(b.elemento.nombre, 'es')
    )
    .slice(0, tope)
    .map(({ elemento }) => elemento);
};
