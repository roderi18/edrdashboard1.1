import {
  doc,
  limit,
  query,
  where,
  getDoc,
  setDoc,
  getDocs,
  updateDoc,
  collection,
} from 'firebase/firestore';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------

export const obtenerAdministradores = async () => {
  const snapshot = await getDocs(collection(FIRESTORE, 'admins'));

  return snapshot.docs.map((adminDoc) => ({
    id: adminDoc.id,
    ...adminDoc.data(),
  }));
};

const getMemberRoleProfile = async (member) => {
  const memberId = member?.idMiembros || member?.memberId || member?.id;
  const codigoMiembro = member?.memberCode || member?.codigoMiembro || member?.memberId;

  if (memberId) {
    const directSnap = await getDoc(doc(FIRESTORE, 'usuarios_roles', String(memberId)));

    if (directSnap.exists()) {
      return { ref: directSnap.ref, data: directSnap.data() };
    }

    const byMemberId = query(
      collection(FIRESTORE, 'usuarios_roles'),
      where('idMiembros', '==', Number(memberId)),
      limit(1)
    );
    const byMemberIdSnap = await getDocs(byMemberId);

    if (!byMemberIdSnap.empty) {
      const foundSnap = byMemberIdSnap.docs[0];
      return { ref: foundSnap.ref, data: foundSnap.data() };
    }
  }

  if (codigoMiembro) {
    const byCode = query(
      collection(FIRESTORE, 'usuarios_roles'),
      where('codigoMiembro', '==', String(codigoMiembro)),
      limit(1)
    );
    const byCodeSnap = await getDocs(byCode);

    if (!byCodeSnap.empty) {
      const foundSnap = byCodeSnap.docs[0];
      return { ref: foundSnap.ref, data: foundSnap.data() };
    }
  }

  return null;
};

export const asignarAdministradorDesdeMiembro = async (member) => {
  const memberId = member?.idMiembros || member?.memberId || member?.id;
  const codigoMiembro = member?.memberCode || member?.codigoMiembro || member?.memberId || '';
  const nombres = member?.firstName || member?.nombres || '';
  const apellidos = member?.lastName || member?.apellidos || '';
  const displayName =
    member?.name || [nombres, apellidos].filter(Boolean).join(' ').trim() || codigoMiembro;

  if (!memberId && !codigoMiembro) {
    throw new Error('No se pudo identificar el miembro para asignarlo como administrador.');
  }

  const roleProfile = await getMemberRoleProfile(member);
  const uid = roleProfile?.data?.uid || member?.uid || '';
  const correo = roleProfile?.data?.correo || member?.email || member?.correo || '';
  const adminDocId = uid || String(memberId || codigoMiembro);
  const now = new Date().toISOString();

  const adminPayload = {
    uid,
    idMiembros: Number(memberId) || null,
    codigoMiembro,
    codigoUsuario: codigoMiembro,
    nombres,
    apellidos,
    displayName,
    correo,
    rol: 'administrador',
    estatus: 'activo',
    photoURL: member?.avatarUrl || member?.photoURL || '',
    actualizadoEn: now,
  };

  await setDoc(
    doc(FIRESTORE, 'admins', adminDocId),
    {
      ...adminPayload,
      creadoEn: now,
    },
    { merge: true }
  );

  if (roleProfile?.ref) {
    await updateDoc(roleProfile.ref, {
      rol: 'administrador',
      estado: 'activo',
      actualizadoEn: now,
    });
  } else {
    await setDoc(
      doc(FIRESTORE, 'usuarios_roles', String(memberId || codigoMiembro)),
      {
        idMiembros: Number(memberId) || null,
        codigoMiembro,
        uid,
        correo,
        nombre: displayName,
        rol: 'administrador',
        estado: 'activo',
        creadoEn: now,
        actualizadoEn: now,
      },
      { merge: true }
    );
  }

  if (uid) {
    await setDoc(
      doc(FIRESTORE, 'users', uid),
      {
        uid,
        email: correo,
        username: codigoMiembro,
        codigoMiembro,
        displayName,
        firstName: nombres,
        lastName: apellidos,
        rol: 'administrador',
        role: 'administrador',
        updatedAt: now,
      },
      { merge: true }
    );
  }

  return {
    id: adminDocId,
    ...adminPayload,
  };
};
