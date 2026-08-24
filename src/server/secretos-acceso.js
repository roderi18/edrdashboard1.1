import 'server-only';

import { getAdminDb } from 'src/server/firebase-admin';

// ----------------------------------------------------------------------
// Donde viven las huellas.
//
// De cada contraseña se guarda una huella PBKDF2 —para poder responder a "¿esta
// clave ya la usaste?"— y del codigo de un solo uso otra igual. Ninguna de las
// dos deja volver a la clave, pero las dos se pueden atacar SIN CONEXION: quien
// se las lleve puede probar contra ellas todo el diccionario que quiera, a su
// ritmo y sin que nadie lo vea.
//
// Estaban dentro de `usuarios_roles`, que cualquier usuario con sesion puede
// leer entera. Aqui tienen coleccion propia, cerrada a cal y canto en las reglas
// (`allow read, write: if false`): solo el Admin SDK entra, que es quien las
// necesita.
//
// El documento se llama IGUAL que el perfil del miembro en `usuarios_roles`,
// para que quien encuentre uno encuentre el otro sin buscar nada.
// ----------------------------------------------------------------------

const COLECCION = 'secretos_acceso';
const COLECCION_PERFILES = 'usuarios_roles';

const referencia = (id) => getAdminDb().collection(COLECCION).doc(String(id));

/**
 * Las huellas de ese miembro.
 *
 * `perfil` es el documento de `usuarios_roles` cuando quien llama ya lo tiene a
 * mano: de ahi salen las huellas de antes de la mudanza, que siguen valiendo
 * hasta que el miembro cambie su clave y se reescriban donde toca.
 */
export const leerSecretos = async (id, perfil = null) => {
  if (!id) return {};

  const documento = await referencia(id)
    .get()
    .catch((error) => {
      console.error('[secretos-acceso] no se pudo leer', error);

      return null;
    });
  const datos = documento?.exists ? documento.data() : null;
  const heredado = perfil?.data?.() ?? perfil ?? {};

  return {
    clavesAnteriores: datos?.clavesAnteriores ?? heredado?.clavesAnteriores ?? [],
    codigoRestablecimiento: datos?.codigoRestablecimiento ?? heredado?.codigoRestablecimiento ?? null,
  };
};

/**
 * Guarda las huellas y limpia las que quedaran en el perfil.
 *
 * Las dos cosas juntas a proposito: mientras la copia vieja siga en
 * `usuarios_roles`, mudarlas no sirve de nada. Cada miembro que pasa por aqui
 * —cambia su clave, o le generan un codigo— queda migrado.
 */
export const guardarSecretos = async (id, datos = {}) => {
  if (!id) return;

  const db = getAdminDb();
  const perfil = db.collection(COLECCION_PERFILES).doc(String(id));

  // Lo que queda en el perfil de antes de la mudanza. Hay que traerselo AHORA:
  // abajo se borra, y quien llama casi siempre trae solo uno de los dos campos
  // —el codigo, o las claves—. Sin este paso, generarle un codigo a alguien le
  // borraba el historial de contraseñas sin haberlo copiado a ninguna parte.
  const heredado = (await perfil.get().catch(() => null))?.data() ?? {};
  const aGuardar = {
    ...(heredado.clavesAnteriores ? { clavesAnteriores: heredado.clavesAnteriores } : {}),
    ...(heredado.codigoRestablecimiento
      ? { codigoRestablecimiento: heredado.codigoRestablecimiento }
      : {}),
    ...datos,
  };

  await referencia(id).set(
    { ...aGuardar, actualizadoEn: new Date().toISOString() },
    { merge: true }
  );

  await perfil
    .set({ clavesAnteriores: null, codigoRestablecimiento: null }, { merge: true })
    .catch((error) => {
      // Que no se pueda limpiar el rastro viejo no invalida lo ya guardado, pero
      // tiene que verse: es justo lo que deja la huella expuesta.
      console.error('[secretos-acceso] no se pudo limpiar el perfil', error);
    });
};
