// ----------------------------------------------------------------------
// LA CAMPANA SOLO ENSEÑA AVISOS REALES.
//
// Qué se rompía: el panel de notificaciones arrancaba con las de ejemplo de la
// plantilla (`_notifications` de `src/_mock`: "Deja Brady te envió una
// solicitud de amistad", "Jayvon Hull te mencionó", pagos, archivos…) y las
// sumaba a las de Firestore, también sin sesión o si la lectura fallaba. Todo
// el mundo veía avisos de personas que no existen.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout = readFileSync(
  new URL('../../src/layouts/dashboard/layout.jsx', import.meta.url),
  'utf8'
);

test('el panel no importa ni mezcla las notificaciones de ejemplo', () => {
  assert.doesNotMatch(layout, /import \{[^}]*_notifications[^}]*\} from 'src\/_mock'/);
  assert.doesNotMatch(
    layout,
    /\.\.\._notifications|useState\(_notifications\)|Drawer\(_notifications\)/
  );
  assert.match(
    layout,
    /const \[notificacionesDrawer, setNotificacionesDrawer\] = useState\(\[\]\);/
  );
});
