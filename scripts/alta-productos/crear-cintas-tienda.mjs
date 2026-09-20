// ALTA DE CINTAS DE LA TIENDA.
//
// Por defecto solo muestra lo que haria. Para escribir en Firebase:
//   node scripts/alta-productos/crear-cintas-tienda.mjs --aplicar

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import {
  formatearCodigoProducto,
  prefijoDeCategoriaProducto,
} from '../../src/utils/producto-codigo.mjs';

const RAIZ = 'C:/Users/rdpr1/OneDrive/Escritorio/next-js';
const CARPETA = path.join(RAIZ, 'public/parches/Cintas y medallas/cintas-perfil/tienda');
const APLICAR = process.argv.includes('--aplicar');
const EXISTENCIAS = 10;
const VALOR = 200;

const leerEnv = () => {
  const texto = fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8');
  const env = {};

  texto.split(/\r?\n/).forEach((linea) => {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) return;
    const corte = limpia.indexOf('=');
    if (corte === -1) return;
    env[limpia.slice(0, corte).trim()] = limpia
      .slice(corte + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  });

  return env;
};

const env = leerEnv();
const credencial = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);

if (!getApps().length) {
  initializeApp({ credential: cert(credencial), storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET });
}

const db = getFirestore();
const almacen = getStorage().bucket();

const cintas = [
  ['12b-cinta-de-proyectos-misioneros.webp', 'Cinta de Proyectos Misioneros', 'Este premio se concede a los individuos que han participado en cualquier viaje misionero internacional o nacional, aprobado por la denominación, durante un mínimo de cinco días excluyendo viaje.'],
  ['12a-cinta-de-reconocimiento-al-liderazgo-nacional.webp', 'Cinta de Reconocimiento al Liderazgo Nacional', 'La Medalla de Reconocimiento al Liderazgo Nacional y la cinta son para líderes organizacionales que sirven como Directores Nacionales para su Nación, quienes han demostrado un servicio excepcional para alcanzar los objetivos del Ministerio de los Exploradores del Rey. El Premio es procesado y otorgado por el Coordinador Regional de RRI.'],
  ['13-historica-cinta-estrella-dorada-para-lideres.webp', 'Cinta de la Estrella Dorada para Líderes', 'La Cinta de la Estrella Dorada es un premio antiguo que se presentaba por liderazgo y servicio. Este premio no está disponible en la actualidad. Los líderes que lo ganaron previamente lo pueden utilizar en su uniforme en cualquier momento, de acuerdo con los lineamientos del uniforme 2.0.'],
  ['14-cinta-de-servicio-destacado.webp', 'Cinta de Servicio Destacado', 'El Premio al Servicio Destacado se otorga tanto a jóvenes como a líderes adultos. Se conceden a individuos para el reconocimiento de servicio excepcional a los Exploradores del Rey. El Premio de Servicio Destacado es otorgado por la región a discreción del Coordinador Regional de RRI.'],
  ['15-cinta-directiva-ejecutiva-distrital-nivel-3.webp', 'Cinta de Liderazgo Ejecutivo Organizacional', 'El Premio de Liderazgo Ejecutivo Organizacional es para todos los líderes organizacionales que sirven en el equipo ejecutivo distrital de Exploradores del Rey y han demostrado una capacidad excepcional para alcanzar los objetivos del ministerio de los Exploradores del Rey.'],
  ['16-cinta-directiva-seccional-nivel-4.webp', 'Cinta de Liderazgo Organizacional', 'El Premio de Liderazgo Organizacional es para todos los miembros del personal de apoyo seccional y del área que han demostrado una capacidad excepcional para alcanzar las metas del ministerio de los Exploradores del Rey (Puede postular un líder con una función específica, pero que no pertenece a la Directiva Ejecutiva Distrital).'],
  ['zzzz.webp', 'Cinta del Águila Plateada y el Racimo Plateado', 'Los premios del Águila Plateada y el Racimo Plateado son premios antiguos que se presentaban por liderazgo y servicio. Estos premios no están disponibles en la actualidad. Los líderes que lo ganaron previamente lo pueden utilizar en su uniforme en cualquier momento, de acuerdo con los lineamientos del uniforme 2.0.'],
  ['18-historica-cinta-del-racimo-dorado-o-racimo-azul.webp', 'Cinta Histórica del Racimo Dorado o Racimo Azul', 'Los premios del Racimo Dorado y el Racimo Azul son premios antiguos que se presentaban por liderazgo y servicio. Estos premios no están disponibles en la actualidad. Los líderes que lo ganaron previamente lo pueden utilizar en su uniforme en cualquier momento, de acuerdo con los lineamientos del uniforme 2.0.'],
  ['19-cinta-y-medalla-para-el-pastor.webp', 'Cinta y Medalla para el Pastor', 'Este premio es concedido a los pastores en reconocimiento a su apoyo al destacamento de Exploradores del Rey. El coordinador del destacamento o el Comité del Destacamento puede conferir el premio al pastor.'],
  ['20-cinta-para-el-coordinador-de-destacamento.webp', 'Cinta para el Coordinador de Destacamento', 'Esta medalla es para los coordinadores de destacamento que han demostrado habilidades sobresalientes al alcanzar los objetivos del programa de los Exploradores del Rey.'],
  ['21-cinta-para-el-lider-de-grupo.webp', 'Cinta para el Líder de Grupo', 'Este premio es para los líderes de grupo que han demostrado habilidades sobresalientes al alcanzar los objetivos del programa de los Exploradores del Rey.'],
  ['22-cinta-de-servicio-del-destacamento.webp', 'Cinta de Servicio del Destacamento', 'Este premio de logro es especial para los líderes asistentes de grupo, capellanes y consejo de destacamento que han demostrado una capacidad sobresaliente al lograr los objetivos del ministerio de los Exploradores del Rey.'],
  ['23-cinta-del-curso-de-adiestramiento-para-lideres-cal.webp', 'Cinta del Curso de Adiestramiento para Líderes CAL', 'Bajo los requisitos de adiestramiento, antes del 2006, el Curso de Adiestramiento para Líderes era el curso de liderazgo teórico ofrecido a los nuevos líderes de Exploradores del Rey. Este premio no se gana en la actualidad, no cuenta dentro de ningún requisito de adiestramiento 2.0.'],
  ['24-historica-medalla-de-oro-al-logro-para-lideres.webp', 'Medalla de Oro al Logro para Líderes', 'Bajo los requisitos de adiestramiento para líderes, antes del 2006, la Medalla de Oro al Logro para Líderes era presentada a los líderes que completaban Orientación para Líderes de la Iglesia (OLI), Adiestramiento para el Consejo de Destacamento (ACD), Fundamentos, Curso de Adiestramiento para Líderes, Campamento para Líderes de Navegantes (CLN), Seguridad, Campamento Nacional de Adiestramiento (CNA), Campamento Nacional de Adiestramiento Avanzado (CNAA), Introducción al Liderazgo Juvenil (ILJ), Campamento de Barras Doradas (CBD), dos o más talleres teóricos y dos o más talleres prácticos de aprendizaje continuo. Este premio no se gana en la actualidad, y no cuenta dentro de ningún requisito de adiestramiento 2.0.'],
  ['25-cinta-del-servicio-de-los-lideres-juveniles.webp', 'Cinta del Servicio de los Líderes Juveniles', 'Este premio es para los líderes juveniles, Guía Mayor, Guía Mayor Auxiliar y Guía de Patrulla. Han demostrado una capacidad sobresaliente al lograr los objetivos del ministerio de los Exploradores del Rey. Los solicitantes deben tener por lo menos once años y haber ganado la Medalla de Bronce de los Seguidores de la Senda o el Premio E1 del Grupo de Exploradores. Los criterios adicionales se encuentran en la solicitud del premio, disponible en la página web de Exploradores del Rey.'],
  ['z5-special-service.webp', 'Cinta de Servicio Especial', 'Cualquier líder sea a nivel del destacamento o a nivel nacional puede presentar este premio. Su propósito es rendir honor a los individuos que tengan dieciocho años o más que hayan hecho contribuciones significativas, servicio o apoyo al ministerio de los Exploradores del Rey. El premio puede ser dado a un líder de Exploradores del Rey o a personas fuera de la organización.'],
  ['27-cinta-de-talleres-practicos-de-aprendizaje-continuo.webp', 'Cinta de Talleres Prácticos de Aprendizaje Continuo', 'Este premio se da por completar de 2 a 4 horas de un adiestramiento práctico de aprendizaje continuo en artes en el ministerio, actividades al aire libre, deportes, habilidades profesionales o tecnologías. Esta capacitación es ofrecida predominantemente fuera del ambiente de clase tradicional. Es dada por o aprobada por la Oficina Nacional de Exploradores del Rey. Algunos cursos pueden tener requisitos previos para asistir, tales como edad, adiestramientos previos o asignaciones. El reconocimiento es dado al completar satisfactoriamente todos los requisitos. Después de ganar la primera cinta, se colocan números centrados en la cinta mostrando el número de adiestramientos prácticos completados.'],
  ['28-cinta-de-talleres-teoricos-de-aprendizaje-continuo.webp', 'Cinta de Talleres Teóricos de Aprendizaje Continuo', 'Este premio se da por completar un adiestramiento teórico de aprendizaje continuo, seminario en línea o módulos en una clase o entorno, o por correspondencia. Es dada por o aprobada por la Oficina Nacional de Exploradores del Rey. Algunos cursos pueden tener requisitos previos para asistir, tales como edad, adiestramientos previos o asignaciones. El reconocimiento es dado al completar satisfactoriamente todos los requisitos. Después de ganar la primera cinta, se colocan números centrados en la cinta mostrando el número de adiestramientos teóricos completados.'],
  ['29-cinta-al-logro-de-exploradores.webp', 'Cinta al Logro de Exploradores', 'Al ganar todos los tres premios de avance al final de cada año, obtienen la cinta al Logro E3, la cual pueden vestir con sus camisas de uniforme aun después que el joven deje Exploradores (ver capítulo 18).'],
  ['30-cinta-al-logro-de-seguidores-de-la-senda.webp', 'Cinta al Logro de Seguidores de la Senda', 'Al ganar todos los tres premios de avance al final de cada año, obtienen la cinta al Logro de Seguidores de la Senda, la cual pueden vestir con sus camisas de uniforme aun después que el joven deje Seguidores (ver capítulo 17).'],
  ['31-cinta-al-logro-de-pioneros.webp', 'Cinta al Logro de Pioneros', 'Al ganar todos los tres premios de avance al final de cada año, obtienen la cinta al Logro de Pioneros, la cual pueden vestir con sus camisas de uniforme aun después que el joven deje Pioneros (ver capítulo 16).'],
  ['32-cinta-al-logro-de-navegantes.webp', 'Cinta al Logro de Navegantes', 'Al ganar todos los tres premios de avance al final de cada año, obtienen la cinta al Logro de Navegantes, la cual pueden vestir con sus camisas de uniforme aun después que el joven deje Navegantes (ver capítulo 15).'],
];

const colores = [
  ['33-cinta-azul.webp', 'Cinta Azul'], ['34-cinta-roja.webp', 'Cinta Roja'],
  ['35-cinta-verde.webp', 'Cinta Verde'], ['36-cinta-amarilla.webp', 'Cinta Amarilla'],
  ['37-cinta-plateada.webp', 'Cinta Plateada'], ['38-cinta-celeste.webp', 'Cinta Celeste'],
  ['39-cinta-naranja.webp', 'Cinta Naranja'], ['40-cinta-marron.webp', 'Cinta Marrón'],
].map(([archivo, nombre]) => [archivo, nombre, 'Los líderes pueden llevar en su uniforme la cinta del color de los premios de destrezas que han enseñado. Los exploradores pueden llevar las cintas del color de los premios de destreza que han ganado. Un número puede ser colocado en la cinta para indicar el número de premios de destreza enseñados o ganados.']);

const productos = [...cintas, ...colores].map(([archivo, nombre, descripcion]) => ({
  archivo,
  nombre,
  descripcion,
  descripcionCorta: descripcion.match(/^[^,.]+[,.]?/)?.[0]?.replace(/[,.]$/, '') || nombre,
}));

const comoRuta = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const siguienteCodigo = async () => {
  const snapshot = await db.collection('productos').get();
  let maximo = 0;
  const prefijo = prefijoDeCategoriaProducto('cintas', 'Cintas');
  snapshot.docs.forEach((documento) => {
    const numero = Number((String(documento.data()?.codigo || '').match(new RegExp(`^${prefijo}-(\\d+)$`, 'i')) || [])[1]);
    if (Number.isFinite(numero) && numero > maximo) maximo = numero;
  });
  return maximo + 1;
};

const subirImagen = async (rutaLocal, productoId) => {
  const destino = `productos/${productoId}/imagen-${Date.now()}-0.webp`;
  const token = crypto.randomUUID();
  await almacen.upload(rutaLocal, {
    destination: destino,
    metadata: {
      contentType: 'image/webp',
      metadata: { tipoEntidad: 'producto', productoId, indice: '0', firebaseStorageDownloadTokens: token },
    },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${almacen.name}/o/${encodeURIComponent(destino)}?alt=media&token=${token}`;
};

const construirProducto = ({ productoId, codigo, producto, imagen }) => {
  const ahora = Timestamp.now();
  return {
    productoId,
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    descripcionCorta: producto.descripcionCorta,
    codigo,
    sku: codigo,
    precio: VALOR,
    precioOferta: 0,
    precioRegistrado: VALOR,
    precioNoRegistrado: VALOR,
    precioPendiente: false,
    cantidad: EXISTENCIAS,
    disponibles: EXISTENCIAS,
    tipoInventario: 'en existencia',
    renglon: 'restringido',
    requiereAprobacion: true,
    tipoProducto: 'simple',
    variantes: [],
    notasAdministrativas: '',
    orden: 0,
    publicacion: 'publicado',
    imagenes: [imagen],
    imagenPortada: imagen,
    categoria: 'cintas',
    colores: [],
    tallas: [],
    etiquetas: [],
    genero: [],
    etiquetaNuevo: { habilitada: false, contenido: '' },
    etiquetaOferta: { habilitada: false, contenido: '' },
    totalCalificaciones: 0,
    totalResenas: 0,
    totalVendidos: 0,
    fechaCreacion: ahora,
    fechaActualizacion: ahora,
  };
};

const main = async () => {
  let numero = await siguienteCodigo();
  const prefijo = prefijoDeCategoriaProducto('cintas', 'Cintas');
  console.log(`Cintas a crear: ${productos.length}`);
  console.log(`Primer codigo libre: ${formatearCodigoProducto(prefijo, numero)}`);
  console.log(APLICAR ? '\nESCRIBIENDO\n' : '\nSIMULACION (usa --aplicar para escribir)\n');

  for (const producto of productos) {
    const codigo = formatearCodigoProducto(prefijo, numero);
    const productoId = `${comoRuta(codigo)}-${comoRuta(producto.nombre)}`;
    const rutaImagen = path.join(CARPETA, producto.archivo);
    if (!fs.existsSync(rutaImagen)) throw new Error(`No existe la imagen ${rutaImagen}`);

    if (APLICAR) {
      const referencia = db.collection('productos').doc(productoId);
      const existente = await referencia.get();
      if (!existente.exists) {
        const imagen = await subirImagen(rutaImagen, productoId);
        await referencia.set(construirProducto({ productoId, codigo, producto, imagen }));
        const auditoria = db.collection('auditoria_sistema').doc();
        await auditoria.set({
          idAuditoria: auditoria.id,
          modulo: 'tienda',
          accion: 'producto_creado',
          descripcion: `Se creo el producto ${producto.nombre} (${codigo}).`,
          resultado: 'exitoso',
          severidad: 'informativa',
          entidad: { tipo: 'producto', id: productoId, nombre: producto.nombre, ruta: `/dashboard/product/${productoId}` },
          antes: null,
          despues: { nombre: producto.nombre, codigo, categoria: 'cintas', renglon: 'restringido' },
          realizadoPor: { nombre: 'Carga de cintas de la tienda', origen: 'script' },
          origen: 'script',
          metadatos: { ambito: 'tienda', lote: 'alta-cintas-tienda' },
          fecha: new Date().toISOString(),
          fechaServidor: FieldValue.serverTimestamp(),
        });
      } else {
        console.log(`  · ya existe, se salta: ${productoId}`);
        numero += 1;
        continue;
      }
    }

    console.log(`  ${codigo}  ${producto.nombre}  RD$${VALOR}/${VALOR}  x${EXISTENCIAS}`);
    numero += 1;
  }
};

main().catch((error) => {
  console.error('FALLO:', error.message);
  process.exit(1);
});
