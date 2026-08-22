import { doc, getDocs, writeBatch, collection, runTransaction } from 'firebase/firestore';

import { CAPACIDADES, analizarCombinacion } from 'src/utils/simulador-permisos';
import { mergeCombinationCapabilityReview } from 'src/utils/role-combination-reviews';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import {
  COMBINACIONES,
  ETIQUETA_NIVEL,
  COMBINACION_POR_ID,
} from 'src/catalogs/combinaciones-roles';

import { AMBITOS_CAMBIO, proponerCambio } from './solicitudes-cambio-service';

// ----------------------------------------------------------------------
// El catalogo efectivo de las combinaciones de roles.
//
// Hasta ahora lo que puede hacer cada pareja de cargos solo existia repartido
// entre las funciones que lo preguntan. Aqui se escribe entero en Firestore,
// sembrado con lo que hoy hace el codigo, para poder verlo, revisarlo y
// corregirlo sin tocar el programa.
//
// La siembra NUNCA pisa lo que alguien ajusto a mano: solo rellena lo que
// todavia no existe, salvo que se pida rehacerlo a proposito.
// ----------------------------------------------------------------------

export const COLECCION_COMBINACIONES = 'combinaciones_roles';

const asegurarFirebase = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado: no se puede leer el catálogo de combinaciones.');
  }
};

/** Lo que hace hoy el codigo para esa pareja, calculado en el momento. */
export const calcularCombinacion = (combinacion) => {
  const { combinado, avisos } = analizarCombinacion(combinacion);

  const solicitaA = Object.fromEntries(
    CAPACIDADES.filter(
      (capacidad) => combinado[capacidad.id] === 'aprobacion' && capacidad.solicitaA
    ).map((capacidad) => [capacidad.id, capacidad.solicitaA])
  );

  return { capacidades: combinado, solicitaA, avisos };
};

const documentoBase = (combinacion) => {
  const { capacidades, solicitaA, avisos } = calcularCombinacion(combinacion);

  return {
    id: combinacion.id,
    rolDestacamento: combinacion.destacamento.codigo,
    nombreDestacamento: combinacion.destacamento.nombre,
    rolAcompanante: combinacion.acompanante.codigo,
    nombreAcompanante: combinacion.acompanante.nombre,
    nivelAcompanante: combinacion.nivelAcompanante,
    etiquetaNivel: ETIQUETA_NIVEL[combinacion.nivelAcompanante] ?? '',
    capacidades,
    solicitaA,
    avisos,
    revisado: false,
    nota: '',
  };
};

/** Todo lo guardado, indexado por id de combinacion. */
export async function obtenerCombinacionesRoles() {
  asegurarFirebase();

  const snapshot = await getDocs(collection(FIRESTORE, COLECCION_COMBINACIONES));

  return Object.fromEntries(snapshot.docs.map((item) => [item.id, { id: item.id, ...item.data() }]));
}

/**
 * Escribe en Firestore las combinaciones que falten, con lo que hoy hace el
 * codigo. Con `rehacer` vuelve a calcular tambien las que ya estaban, que es
 * como se descarta un ajuste manual y se vuelve al comportamiento real.
 */
export async function sembrarCombinacionesRoles({ usuario = null, rehacer = false } = {}) {
  asegurarFirebase();

  const guardadas = await obtenerCombinacionesRoles();
  const pendientes = COMBINACIONES.filter((combinacion) => rehacer || !guardadas[combinacion.id]);

  if (!pendientes.length) return { sembradas: 0, total: COMBINACIONES.length };

  const marca = new Date().toISOString();
  const autor = usuario?.uid || usuario?.email || 'sistema';

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.combinacionesRoles,
    entidad: { tipo: 'catalogo_combinaciones', id: COLECCION_COMBINACIONES, nombre: 'Combinacion de roles' },
    usuario,
    aplicarDirecto: true,
    descripcion: rehacer
      ? `Catálogo de combinaciones rehecho desde el comportamiento actual (${pendientes.length})`
      : `Catálogo de combinaciones sembrado (${pendientes.length} nuevas)`,
    cambios: [
      {
        campo: 'combinaciones',
        etiqueta: 'Combinaciones escritas',
        antes: String(Object.keys(guardadas).length),
        despues: String(COMBINACIONES.length),
      },
    ],
    aplicar: async () => {
      // El limite de un lote son 500 escrituras.
      for (let inicio = 0; inicio < pendientes.length; inicio += 400) {
        const tanda = pendientes.slice(inicio, inicio + 400);
        // La escritura ocurre DENTRO de `aplicar`: el cambio ya quedo registrado.
        // eslint-disable-next-line no-restricted-syntax
        const lote = writeBatch(FIRESTORE);

        tanda.forEach((combinacion) => {
          const anterior = guardadas[combinacion.id];

          lote.set(
            doc(FIRESTORE, COLECCION_COMBINACIONES, combinacion.id),
            {
              ...documentoBase(combinacion),
              // Al rehacer se conserva lo que es del revisor, no del calculo.
              revisado: anterior?.revisado ?? false,
              nota: anterior?.nota ?? '',
              revisionesCapacidades: anterior?.revisionesCapacidades ?? {},
              sembradoEn: marca,
              sembradoPor: autor,
            },
            { merge: true }
          );
        });

        // En serie a proposito: son lotes, no peticiones sueltas.
         
        await lote.commit();
      }
    },
  });

  return { sembradas: pendientes.length, total: COMBINACIONES.length };
}

/**
 * Guarda la revision de una combinacion: si ya se comprobo y la nota de quien
 * la comprobo. Queda en Historial como cualquier otro cambio.
 */
export async function guardarRevisionCombinacion({
  idCombinacion,
  revisado = false,
  nota = '',
  anterior = {},
  usuario = null,
} = {}) {
  asegurarFirebase();

  const combinacion = COMBINACION_POR_ID[idCombinacion];

  if (!combinacion) {
    throw new Error('Esa combinación de roles no existe.');
  }

  const nombre = `${combinacion.destacamento.nombre} + ${combinacion.acompanante.nombre}`;

  return proponerCambio({
    ambito: AMBITOS_CAMBIO.combinacionesRoles,
    entidad: { tipo: 'combinacion_roles', id: idCombinacion, nombre },
    usuario,
    aplicarDirecto: true,
    descripcion: revisado ? `Combinación revisada: ${nombre}` : `Revisión retirada: ${nombre}`,
    cambios: [
      {
        campo: 'revisado',
        etiqueta: 'Revisada',
        antes: anterior?.revisado ? 'Sí' : 'No',
        despues: revisado ? 'Sí' : 'No',
      },
      { campo: 'nota', etiqueta: 'Nota', antes: anterior?.nota ?? '', despues: nota },
    ].filter((cambio) => String(cambio.antes) !== String(cambio.despues)),
    aplicar: async () => {
      // La escritura ocurre DENTRO de `aplicar`: el cambio ya quedo registrado.
      // eslint-disable-next-line no-restricted-syntax
      const lote = writeBatch(FIRESTORE);

      lote.set(
        doc(FIRESTORE, COLECCION_COMBINACIONES, idCombinacion),
        {
          ...documentoBase(combinacion),
          revisado,
          nota,
          revisadoEn: new Date().toISOString(),
          revisadoPor: usuario?.uid || usuario?.email || 'sistema',
        },
        { merge: true }
      );

      await lote.commit();
    },
  });
}

/**
 * Marca una fila concreta del simulador como validada para una combinación.
 * La transacción vuelve a leer el mapa antes de guardar para que dos clics
 * cercanos no borren entre sí las demás filas ya revisadas.
 */
export async function guardarRevisionCapacidadCombinacion({
  idCombinacion,
  idCapacidad,
  validada = false,
  anterior = false,
  usuario = null,
} = {}) {
  asegurarFirebase();

  const combinacion = COMBINACION_POR_ID[idCombinacion];
  const capacidad = CAPACIDADES.find((item) => item.id === idCapacidad);

  if (!combinacion) {
    throw new Error('Esa combinación de roles no existe.');
  }

  if (!capacidad) {
    throw new Error('Esa fila del simulador no existe.');
  }

  const nombre = `${combinacion.destacamento.nombre} + ${combinacion.acompanante.nombre}`;

  return proponerCambio({
    ambito: AMBITOS_CAMBIO.combinacionesRoles,
    entidad: { tipo: 'capacidad_combinacion_roles', id: idCombinacion, nombre },
    usuario,
    aplicarDirecto: true,
    descripcion: validada
      ? `Fila validada en ${nombre}: ${capacidad.etiqueta}`
      : `Validación retirada en ${nombre}: ${capacidad.etiqueta}`,
    cambios: [
      {
        campo: `revisionesCapacidades.${idCapacidad}`,
        etiqueta: capacidad.etiqueta,
        antes: anterior ? 'Validada' : 'Pendiente',
        despues: validada ? 'Validada' : 'Pendiente',
      },
    ],
    aplicar: async () => {
      const documentRef = doc(FIRESTORE, COLECCION_COMBINACIONES, idCombinacion);
      const marca = new Date().toISOString();
      const autor = usuario?.uid || usuario?.email || 'sistema';

      await runTransaction(FIRESTORE, async (transaction) => {
        const snapshot = await transaction.get(documentRef);
        const document = snapshot.exists() ? snapshot.data() : documentoBase(combinacion);
        const revisionesCapacidades = mergeCombinationCapabilityReview(
          document,
          idCapacidad,
          {
            validada,
            revisadaEn: marca,
            revisadaPor: autor,
          }
        );

        transaction.set(
          documentRef,
          {
            ...(!snapshot.exists() ? document : {}),
            revisionesCapacidades,
            revisionesCapacidadesActualizadasEn: marca,
            revisionesCapacidadesActualizadasPor: autor,
          },
          { merge: true }
        );
      });
    },
  });
}
