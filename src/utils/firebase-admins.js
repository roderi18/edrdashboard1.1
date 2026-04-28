import { getDocs, collection } from 'firebase/firestore';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------

export const obtenerAdministradores = async () => {
  const snapshot = await getDocs(collection(FIRESTORE, 'admins'));

  return snapshot.docs.map((adminDoc) => ({
    id: adminDoc.id,
    ...adminDoc.data(),
  }));
};
