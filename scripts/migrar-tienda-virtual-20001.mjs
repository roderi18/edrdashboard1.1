// ----------------------------------------------------------------------
// TIENDA VIRTUAL: DE -900001 A 20001.
//
// La Tienda participaba en el chat con `idMiembros` -900001. Los normalizadores
// del chat solo aceptan positivos, asi que se caia de sus propias conversaciones
// y nadie podia contestarle. Pasa a 20001 (codigo EDR-20001), ver
// `src/utils/chat-tienda-virtual.mjs`.
//
// El id de una conversacion individual se arma con los dos participantes
// (`individual_<menor>_<mayor>`), asi que cambiar el numero CAMBIA EL ID: la
// conversacion `individual_-900001_147` pasa a ser `individual_147_20001`. Este
// script:
//
//   1. Copia cada conversacion vieja a su id nuevo, con sus mensajes, recibos y
//      auditoria, cambiando el numero dentro de todo (participantes, remitentes,
//      contadores de no leidos, reacciones...).
//   2. Reescribe los avisos que enlazaban a las conversaciones viejas, para que
//      "Responder" siga abriendo el hilo.
//   3. Borra las conversaciones viejas, ya copiadas.
//   4. Deja constancia en `auditoria_sistema`.
//
// Es idempotente: si el id nuevo ya existe con los mismos mensajes, no duplica.
//
//   node scripts/migrar-tienda-virtual-20001.mjs           -> simulacion
//   node scripts/migrar-tienda-virtual-20001.mjs --aplicar -> escribe
// ----------------------------------------------------------------------

import fs from 'node:fs';
import process from 'node:process';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import {
  ID_TIENDA_VIRTUAL,
  CODIGO_TIENDA_VIRTUAL,
  AVATAR_TIENDA_VIRTUAL,
  ID_TIENDA_VIRTUAL_ANTERIOR,
} from '../src/utils/chat-tienda-virtual.mjs';

const APLICAR = process.argv.includes('--aplicar');

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((linea) => linea.includes('=') && !linea.trim().startsWith('#'))
    .map((linea) => {
      const corte = linea.indexOf('=');
      return [
        linea.slice(0, corte).trim(),
        linea
          .slice(corte + 1)
          .trim()
          .replace(/^["']|["']$/g, ''),
      ];
    })
);

if (!getApps().length) initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });

const db = getFirestore();

const VIEJO = ID_TIENDA_VIRTUAL_ANTERIOR;
const NUEVO = ID_TIENDA_VIRTUAL;

const idNuevoDe = (idViejo) => {
  const miembros = idViejo
    .replace(/^individual_/, '')
    .split('_')
    .map(Number)
    .map((id) => (id === VIEJO ? NUEVO : id))
    .sort((a, b) => a - b);

  return `individual_${miembros.join('_')}`;
};

const esObjetoPlano = (valor) =>
  valor !== null && typeof valor === 'object' && Object.getPrototypeOf(valor) === Object.prototype;

/**
 * Cambia el numero de la Tienda en TODO el documento: valores numericos, textos
 * que son el numero, claves de mapas (`noLeidosPorIdMiembros['-900001']`) y los
 * ids de conversacion que aparezcan dentro de rutas o metadatos. No toca
 * Timestamps ni otros objetos de Firestore: solo recorre objetos planos y listas.
 */
const crearTransformador = (idsViejosANuevos) => {
  const transformar = (valor) => {
    if (valor === VIEJO) return NUEVO;

    if (typeof valor === 'string') {
      if (valor === String(VIEJO)) return String(NUEVO);

      // LOS ADJUNTOS NO SE TOCAN. Su ruta en Storage y su URL de descarga llevan
      // el id VIEJO de la conversacion (`chat/individual_-900001_219/...`), y los
      // archivos no se mueven: cambiar el texto dejaria el enlace apuntando a un
      // archivo que no existe. La URL lleva su token y sigue abriendo igual.
      if (/^https?:\/\//i.test(valor) || valor.includes('chat/') || valor.includes('%2F')) {
        return valor;
      }

      let texto = valor;

      idsViejosANuevos.forEach((nuevo, viejo) => {
        texto = texto.split(viejo).join(nuevo);
      });

      return texto;
    }

    if (Array.isArray(valor)) return valor.map(transformar);

    if (esObjetoPlano(valor)) {
      const esLaTienda = valor.idMiembros === VIEJO || valor.idMiembros === String(VIEJO);
      const salida = Object.fromEntries(
        Object.entries(valor).map(([clave, dentro]) => [
          clave === String(VIEJO) ? String(NUEVO) : clave,
          transformar(dentro),
        ])
      );

      // El participante de la Tienda sale con su codigo y su cara de ahora.
      if (esLaTienda) {
        if ('codigoMiembro' in salida) salida.codigoMiembro = CODIGO_TIENDA_VIRTUAL;
        if ('avatarUrl' in salida && !salida.avatarUrl) salida.avatarUrl = AVATAR_TIENDA_VIRTUAL;
      }

      return salida;
    }

    return valor;
  };

  return transformar;
};

const SUBCOLECCIONES = ['mensajes', 'recibos', 'auditoria', 'respuestas_tienda'];

const main = async () => {
  console.log(APLICAR ? 'ESCRIBIENDO\n' : 'SIMULACION (usa --aplicar para escribir)\n');

  const viejas = await db
    .collection('conversaciones_chat')
    .where('participantesIds', 'array-contains', VIEJO)
    .get();

  const idsViejosANuevos = new Map(viejas.docs.map((doc) => [doc.id, idNuevoDe(doc.id)]));
  const transformar = crearTransformador(idsViejosANuevos);
  const resumen = [];

  for (const conversacion of viejas.docs) {
    const idNuevo = idsViejosANuevos.get(conversacion.id);
    const destino = db.collection('conversaciones_chat').doc(idNuevo);
    const yaExiste = (await destino.get()).exists;
    const subcolecciones = {};

    for (const nombre of SUBCOLECCIONES) {
      subcolecciones[nombre] = (await conversacion.ref.collection(nombre).get()).docs;
    }

    const adjuntos = subcolecciones.mensajes.filter(
      (mensaje) => (mensaje.data()?.adjuntos || []).length > 0
    ).length;

    console.log(
      `  ${conversacion.id}  ->  ${idNuevo}` +
        `  | mensajes ${subcolecciones.mensajes.length}` +
        `, recibos ${subcolecciones.recibos.length}` +
        `, auditoria ${subcolecciones.auditoria.length}` +
        `, con adjuntos ${adjuntos}` +
        (yaExiste ? '  | el id nuevo YA EXISTE: se fusiona' : '')
    );

    resumen.push({ viejo: conversacion.id, nuevo: idNuevo, mensajes: subcolecciones.mensajes.length });

    // `--muestra`: como quedaria, sin escribir nada.
    if (process.argv.includes('--muestra')) {
      const conAdjunto = subcolecciones.mensajes.find((m) => (m.data()?.adjuntos || []).length);
      const deLaTienda = subcolecciones.mensajes.find((m) => m.data()?.remitenteIdMiembros === VIEJO);
      const recortar = (datos = {}) => ({
        participantesIds: datos.participantesIds,
        creadoPorIdMiembros: datos.creadoPorIdMiembros,
        noLeidosPorIdMiembros: datos.noLeidosPorIdMiembros,
        remitenteIdMiembros: datos.remitenteIdMiembros,
        remitente: datos.remitente?.codigoMiembro,
        participantes: datos.participantes?.map((p) => `${p.idMiembros}/${p.codigoMiembro}`),
        adjunto: datos.adjuntos?.[0]?.url?.slice(0, 110),
      });
      console.log('     conversacion', JSON.stringify(recortar(transformar(conversacion.data()))));
      if (deLaTienda) console.log('     de la Tienda', JSON.stringify(recortar(transformar(deLaTienda.data()))));
      if (conAdjunto) console.log('     con adjunto ', JSON.stringify(recortar(transformar(conAdjunto.data()))));
    }

    if (!APLICAR) continue;

    await destino.set(
      { ...transformar(conversacion.data()), idConversacion: idNuevo },
      { merge: yaExiste }
    );

    for (const nombre of SUBCOLECCIONES) {
      for (const documento of subcolecciones[nombre]) {
        // Los recibos se guardan por uid y los demas por su propio id: los ids de
        // documento no llevan el numero, asi que se conservan.
        await destino.collection(nombre).doc(documento.id).set(transformar(documento.data()));
      }
    }
  }

  // Los avisos que enlazaban a las conversaciones viejas.
  const avisos = await db.collection('notificaciones').get();
  // Solo los que de verdad hablan de la Tienda: un enlace a una de sus
  // conversaciones, o su numero como valor. Buscar "-900001" a secas atrapaba
  // tambien el codigo de un miembro real, `DO-SD-900001`.
  const avisosAfectados = avisos.docs.filter((doc) => {
    const texto = JSON.stringify(doc.data());
    return (
      [...idsViejosANuevos.keys()].some((id) => texto.includes(id)) ||
      new RegExp(`[:\\[,]${VIEJO}[,\\]}]|"${VIEJO}"`).test(texto)
    );
  });

  console.log(`\nAvisos a reescribir: ${avisosAfectados.length}`);

  if (APLICAR) {
    for (const aviso of avisosAfectados) {
      await aviso.ref.set(transformar(aviso.data()));
    }

    // Borrar lo viejo solo DESPUES de haberlo copiado entero.
    for (const conversacion of viejas.docs) {
      for (const nombre of SUBCOLECCIONES) {
        const docs = (await conversacion.ref.collection(nombre).get()).docs;
        for (const documento of docs) await documento.ref.delete();
      }
      await conversacion.ref.delete();
    }

    const auditoria = db.collection('auditoria_sistema').doc();
    await auditoria.set({
      idAuditoria: auditoria.id,
      modulo: 'mensajes',
      accion: 'tienda_virtual_renumerada',
      descripcion: `La Tienda Virtual pasa de ${VIEJO} a ${NUEVO} en el chat: ${resumen.length} conversaciones y ${avisosAfectados.length} avisos.`,
      resultado: 'exitoso',
      severidad: 'informativa',
      entidad: { tipo: 'chat', id: 'tienda-virtual', nombre: 'Tienda Virtual' },
      antes: { idMiembros: VIEJO, conversaciones: resumen.map((item) => item.viejo) },
      despues: { idMiembros: NUEVO, conversaciones: resumen.map((item) => item.nuevo) },
      realizadoPor: { nombre: 'Migracion de la Tienda Virtual', origen: 'script' },
      origen: 'script',
      metadatos: { ambito: 'mensajes', lote: 'tienda-virtual-20001' },
      fecha: new Date().toISOString(),
      fechaServidor: FieldValue.serverTimestamp(),
    });
  }

  console.log(`\nConversaciones: ${resumen.length}  ${APLICAR ? 'migradas' : '(sin cambios)'}`);
};

main().catch((error) => {
  console.error('FALLO:', error.message);
  process.exit(1);
});
