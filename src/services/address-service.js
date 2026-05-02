import {
  doc,
  query,
  where,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  writeBatch,
} from 'firebase/firestore';

import {
  TEXTO_SIN_TELEFONO,
  TEXTO_SIN_DIRECCION,
  COLECCIONES_COMERCIO,
  dividirDireccionCompleta,
  obtenerIdMiembroComercio,
  obtenerIdUsuarioComercio,
  normalizarTextoFirestore,
} from 'src/utils/firestore-commerce';

import { getDestsApi } from 'src/services/dest-service';
import { getMembers } from 'src/services/member-service';
import { getChurches } from 'src/services/church-service';
import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { crearDocumentoDireccion, mapearDireccionFirestoreAUi } from 'src/models/address-model';

const direccionesCollection = () => collection(FIRESTORE, COLECCIONES_COMERCIO.direcciones);

const hasValue = (value) => value !== null && value !== undefined && value !== '';
const hasMeaningfulValue = (value) =>
  hasValue(value) && value !== TEXTO_SIN_DIRECCION && value !== TEXTO_SIN_TELEFONO;
const pickExistingOrFallback = (existingValue, fallbackValue) =>
  hasMeaningfulValue(existingValue) ? existingValue : fallbackValue;

const getUserKeys = (user = {}, member = null) =>
  new Set(
    [
      user?.uid,
      user?.id,
      user?.idMiembros,
      user?.memberId,
      user?.codigoMiembro,
      user?.codigo,
      user?.email,
      user?.correo,
      member?.id,
      member?.memberId,
      member?.codigoMiembro,
      member?.email,
    ]
      .filter(hasValue)
      .map((value) => normalizarTextoFirestore(value).replace(/\s+/g, ''))
  );

const findCurrentMember = (members = [], user = {}) => {
  const keys = getUserKeys(user);

  return (
    members.find((member) =>
      [member?.id, member?.memberId, member?.codigoMiembro, member?.email].some((value) =>
        keys.has(normalizarTextoFirestore(value).replace(/\s+/g, ''))
      )
    ) || null
  );
};

export const asegurarDireccionesBaseUsuario = async ({
  user,
  member = null,
  dest = null,
  church = null,
} = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE) return [];

  const usuarioId = obtenerIdUsuarioComercio(user);
  if (!usuarioId) return [];

  const miembroId = obtenerIdMiembroComercio(user) || member?.id || member?.memberId || null;
  const profileName =
    user?.displayName ||
    user?.nombre ||
    member?.name ||
    [member?.firstName, member?.lastName].filter(Boolean).join(' ') ||
    'Perfil';
  const memberAddress = member?.memberAddress || member?.direccion || user?.direccion || '';
  const memberPhone = member?.phoneNumber || user?.phoneNumber || user?.telefono || '';
  const { provincia, municipio, sector, calle } = dividirDireccionCompleta(memberAddress);
  const { provincia: iglesiaProvincia, municipio: iglesiaMunicipio, sector: iglesiaSector, calle: iglesiaCalle } =
    dividirDireccionCompleta(church?.address || '');

  const baseDirections = [
    {
      id: `${usuarioId}__destacamento`,
      etiqueta: 'Destacamento',
      tipo: 'destacamento',
      nombre: church?.name || dest?.name || 'Iglesia del destacamento',
      provincia: iglesiaProvincia,
      municipio: iglesiaMunicipio,
      sector: iglesiaSector,
      calle: iglesiaCalle,
      telefono: church?.telefono || '',
      esPredeterminada: true,
      esPrimaria: false,
      esDestacamento: true,
      bloqueada: true,
      bloqueadaEdicion: true,
      esSistema: true,
    },
    {
      id: `${usuarioId}__primaria`,
      etiqueta: 'Primaria',
      tipo: 'primaria',
      nombre: profileName,
      provincia,
      municipio,
      sector,
      calle,
      telefono: memberPhone,
      esPredeterminada: false,
      esPrimaria: true,
      esDestacamento: false,
      bloqueada: true,
      bloqueadaEdicion: false,
      esSistema: true,
    },
  ];

  await Promise.all(
    baseDirections.map(async (direction) => {
      const directionRef = doc(FIRESTORE, COLECCIONES_COMERCIO.direcciones, direction.id);
      const existing = await getDoc(directionRef);
      const existingData = existing.exists() ? existing.data() : null;
      const directionDoc = crearDocumentoDireccion({
        ...direction,
        ...(direction.esDestacamento
          ? {
              nombre: direction.nombre,
              provincia: direction.provincia,
              municipio: direction.municipio,
              sector: direction.sector,
              calle: direction.calle,
              telefono: direction.telefono,
              esPredeterminada: existingData?.esPredeterminada ?? direction.esPredeterminada,
            }
          : {
              nombre: pickExistingOrFallback(existingData?.nombre, direction.nombre),
              provincia: pickExistingOrFallback(existingData?.provincia, direction.provincia),
              municipio: pickExistingOrFallback(existingData?.municipio, direction.municipio),
              sector: pickExistingOrFallback(existingData?.sector, direction.sector),
              calle: pickExistingOrFallback(existingData?.calle, direction.calle),
              telefono: pickExistingOrFallback(existingData?.telefono, direction.telefono),
              esPredeterminada: existingData?.esPredeterminada ?? direction.esPredeterminada,
            }),
        usuarioId,
        miembroId,
        fechaCreacion: existingData?.fechaCreacion ?? null,
      });

      await setDoc(directionRef, directionDoc);
    })
  );

  return baseDirections;
};

export const cargarDireccionesUsuarioFirestore = async (user) => {
  if (!user) return [];

  const [members, dests, churches] = await Promise.all([getMembers(), getDestsApi(), getChurches()]);
  const member = findCurrentMember(members, user);
  const destId =
    member?.idDestacamento ||
    member?.destId ||
    user?.idDestacamento ||
    user?.destId ||
    user?.alcance?.destacamentos?.[0] ||
    null;
  const dest = dests.find((item) => String(item.id) === String(destId)) || null;
  const church = churches.find((item) => String(item.id) === String(dest?.churchId)) || null;

  await asegurarDireccionesBaseUsuario({ user, member, dest, church });

  const directions = await listarDireccionesUsuario(user);

  return directions.map((address) => ({
    ...address,
    fullAddress: address.fullAddress || TEXTO_SIN_DIRECCION,
    phoneNumber: address.phoneNumber || TEXTO_SIN_TELEFONO,
  }));
};

export const listarDireccionesUsuario = async (user) => {
  if (!isFirebaseConfigured || !FIRESTORE) return [];

  const usuarioId = obtenerIdUsuarioComercio(user);
  if (!usuarioId) return [];

  const snapshot = await getDocs(
    query(direccionesCollection(), where('usuarioId', '==', usuarioId))
  );

  return snapshot.docs.map((item) => mapearDireccionFirestoreAUi({ id: item.id, ...item.data() }));
};

export const guardarDireccionUsuario = async ({ user, address, addressId = null }) => {
  if (!isFirebaseConfigured || !FIRESTORE) return null;

  const usuarioId = obtenerIdUsuarioComercio(user);
  if (!usuarioId) return null;

  const directionId = addressId || address?.id || `direccion-${Date.now()}`;
  const directionRef = doc(FIRESTORE, COLECCIONES_COMERCIO.direcciones, directionId);
  const previous = await getDoc(directionRef);
  const isPrimary = address?.isPrimaryAddress || address?.addressType === 'Primaria';
  const isDest = address?.isDestAddress || address?.addressType === 'Destacamento';
  const fields = address?.addressFields || {};

  const directionDoc = crearDocumentoDireccion({
    id: directionId,
    usuarioId,
    miembroId: obtenerIdMiembroComercio(user),
    etiqueta: address?.addressType || address?.etiqueta || 'Direccion',
    tipo: isDest
      ? 'destacamento'
      : isPrimary
        ? 'primaria'
        : address?.forceHomeAddress
          ? 'casa'
          : address?.addressType?.toLowerCase?.() || 'adicional',
    nombre: address?.name || address?.nombre || '',
    provincia: fields.province || fields.provincia || address?.province || '',
    municipio: fields.municipality || fields.municipio || address?.municipality || '',
    sector: fields.sector || address?.sector || '',
    calle: fields.detail || fields.calle || address?.street || '',
    telefono: address?.phoneNumber || address?.telefono || '',
    esPredeterminada: Boolean(address?.primary),
    esPrimaria: isPrimary,
    esDestacamento: isDest,
    bloqueada: Boolean(address?.locked),
    bloqueadaEdicion: Boolean(address?.editLocked),
    esSistema: isPrimary || isDest,
    fechaCreacion: previous.exists() ? previous.data()?.fechaCreacion : null,
  });

  await setDoc(directionRef, directionDoc);

  if (directionDoc.esPredeterminada) {
    await marcarDireccionPredeterminadaUsuario({ user, addressId: directionId });
  }

  return mapearDireccionFirestoreAUi({ id: directionId, ...directionDoc });
};

export const marcarDireccionPredeterminadaUsuario = async ({ user, addressId }) => {
  if (!isFirebaseConfigured || !FIRESTORE) return;

  const usuarioId = obtenerIdUsuarioComercio(user);
  if (!usuarioId) return;

  const snapshot = await getDocs(
    query(direccionesCollection(), where('usuarioId', '==', usuarioId))
  );
  const batch = writeBatch(FIRESTORE);

  snapshot.docs.forEach((item) => {
    batch.set(
      item.ref,
      {
        ...item.data(),
        esPredeterminada: item.id === addressId,
      },
      { merge: true }
    );
  });

  await batch.commit();
};

export const eliminarDireccionUsuario = async (addressId) => {
  if (!isFirebaseConfigured || !FIRESTORE || !addressId) return;

  await deleteDoc(doc(FIRESTORE, COLECCIONES_COMERCIO.direcciones, String(addressId)));
};
