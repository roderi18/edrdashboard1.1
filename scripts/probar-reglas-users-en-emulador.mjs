// ----------------------------------------------------------------------
// Prueba las reglas de `users/{uid}` contra el emulador de Firestore.
//
// Los tests de `tests/acceso` leen el TEXTO de las reglas; este script las
// ejecuta de verdad, con los ejemplos de la revisión: escribir la ficha de otro,
// darse administrador, ponerse el idMiembros de otro, colar una cuenta suelta… y
// que lo legítimo (vincular Google, el espejo de administrador) siga pasando.
//
// Uso (no toca ningún proyecto real: `demo-*` solo existe en el emulador):
//   firebase emulators:exec --only firestore --project demo-reglas "node scripts/probar-reglas-users-en-emulador.mjs"
// ----------------------------------------------------------------------

const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const PROYECTO = process.env.GCLOUD_PROJECT || 'demo-reglas';
const BASE = `http://${HOST}/v1/projects/${PROYECTO}/databases/(default)/documents`;

// El emulador acepta tokens sin firmar; "owner" se salta las reglas (siembra).
const b64 = (objeto) => Buffer.from(JSON.stringify(objeto)).toString('base64url');
const tokenDe = (uid) => {
  const ahora = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    sub: uid,
    user_id: uid,
    aud: PROYECTO,
    iss: `https://securetoken.google.com/${PROYECTO}`,
    iat: ahora,
    auth_time: ahora,
    exp: ahora + 3600,
    firebase: { sign_in_provider: 'password' },
  })}.`;
};

const valor = (v) => {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  throw new Error(`tipo no soportado: ${v}`);
};
const campos = (datos) => Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, valor(v)]));

const pedir = (metodo, ruta, { como, datos } = {}) => {
  const mascara = datos
    ? `?${Object.keys(datos)
        .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
        .join('&')}`
    : '';
  return fetch(`${BASE}/${ruta}${metodo === 'PATCH' ? mascara : ''}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${como === 'owner' ? 'owner' : tokenDe(como)}`,
    },
    body: datos ? JSON.stringify({ fields: campos(datos) }) : undefined,
  });
};

// --- Siembra --------------------------------------------------------------
// juan: explorador con cuenta. maria: otra miembro. oficina: Oficina Nacional
// (por `rolesQueEjerce`, como la da el servidor). pedro: cuenta suelta.
const siembra = {
  'usuarios_roles/juan': { idMiembros: 101, rolId: 'explorador' },
  'usuarios_roles/maria': { idMiembros: 102, rolId: 'explorador' },
  'usuarios_roles/oficina': {
    idMiembros: 103,
    rolId: 'lider',
    rolesQueEjerce: ['oficina_nacional'],
  },
  'users/juan': {
    uid: 'juan',
    codigoMiembro: 'M101',
    idMiembros: 101,
    rol: 'usuario',
    displayName: 'Juan',
  },
  'users/maria': {
    uid: 'maria',
    codigoMiembro: 'M102',
    idMiembros: 102,
    rol: 'usuario',
    displayName: 'María',
  },
  'users/pedro': { uid: 'pedro', email: 'pedro@ejemplo.test', displayName: 'Pedro' },
};

for (const [ruta, datos] of Object.entries(siembra)) {
  const r = await pedir('PATCH', ruta, { como: 'owner', datos });
  if (!r.ok) throw new Error(`no se pudo sembrar ${ruta}: ${r.status} ${await r.text()}`);
}

// --- Casos ----------------------------------------------------------------
const casos = [
  [
    'Juan cambia el nombre de María',
    'PATCH',
    'users/maria',
    'juan',
    { displayName: 'Otra' },
    false,
  ],
  [
    'Juan se pone rol administrador',
    'PATCH',
    'users/juan',
    'juan',
    { rol: 'administrador' },
    false,
  ],
  [
    'Juan se pone el idMiembros de María',
    'PATCH',
    'users/juan',
    'juan',
    { idMiembros: 102 },
    false,
  ],
  ['Juan se da permisos', 'PATCH', 'users/juan', 'juan', { permisos: ['todo'] }, false],
  [
    'Juan le pone codigoMiembro a Pedro',
    'PATCH',
    'users/pedro',
    'juan',
    { codigoMiembro: 'X1' },
    false,
  ],
  ['Juan borra su ficha', 'DELETE', 'users/juan', 'juan', null, false],
  ['Pedro (cuenta suelta) lee una ficha', 'GET', 'users/maria', 'pedro', null, false],
  [
    'Juan vincula Google (reenviando su mismo rol)',
    'PATCH',
    'users/juan',
    'juan',
    {
      uid: 'juan',
      linkedAuthUid: 'juan',
      rol: 'usuario',
      authProviders: ['member-code', 'google'],
      googleLinked: true,
      googleEmail: 'juan@ejemplo.test',
      googleProviderId: 'google.com',
    },
    true,
  ],
  ['Juan cambia su propio nombre', 'PATCH', 'users/juan', 'juan', { displayName: 'Juan P.' }, true],
  ['Juan lee la ficha de María', 'GET', 'users/maria', 'juan', null, true],
  [
    'Oficina Nacional da administrador a María (espejo)',
    'PATCH',
    'users/maria',
    'oficina',
    { rol: 'administrador', role: 'administrador', updatedAt: '2026-10-05' },
    true,
  ],
  [
    'Oficina Nacional cambia otro campo de María',
    'PATCH',
    'users/maria',
    'oficina',
    { birthdate: '2000-01-01' },
    false,
  ],
];

let fallos = 0;

for (const [nombre, metodo, ruta, como, datos, debePasar] of casos) {
  // eslint-disable-next-line no-await-in-loop
  const r = await pedir(metodo, ruta, { como, datos });
  const paso = r.ok;
  const bien = paso === debePasar;
  if (!bien) fallos += 1;
  console.log(
    `${bien ? 'OK  ' : 'MAL '} ${debePasar ? 'permite' : 'rechaza'} · ${nombre} (HTTP ${r.status})`
  );
}

console.log(
  fallos ? `\n${fallos} caso(s) no hacen lo esperado` : '\nTodos los casos hacen lo esperado'
);
process.exit(fallos ? 1 : 0);
