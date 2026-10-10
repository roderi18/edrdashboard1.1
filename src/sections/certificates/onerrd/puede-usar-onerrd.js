import { isOficinaNacional } from 'src/utils/org-level-access';
import { ejerceAdministradorGlobal } from 'src/utils/administrador-global-reina.mjs';

// Quién ve la pestaña ONERRD: el registro de destacamentos es de la Oficina
// Nacional, y el Administrador Global lo ve todo. `firestore.rules` exige lo
// mismo (`certificadosOnerrd*`). Aparte de la pantalla para que Certificados
// sepa si pinta la pestaña sin cargarla.
export const puedeUsarOnerrd = (user) => ejerceAdministradorGlobal(user) || isOficinaNacional(user);
