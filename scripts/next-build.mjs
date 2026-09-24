// `next build` con el compilador que aguanta cada hosting.
//
// En Firebase App Hosting el buildpack de yarn instala las dependencias en
// /layers y deja `node_modules` como enlace a esa carpeta. Turbopack (el de
// fabrica en Next 16) se niega a seguir un enlace que sale del proyecto y el
// build moria con "Symlink node_modules is invalid, it points out of the
// filesystem root". Alli se compila con webpack; Netlify y el equipo local
// siguen con Turbopack, que les funciona.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const next = createRequire(import.meta.url).resolve('next/dist/bin/next');
const args = [next, 'build'];
const env = { ...process.env };
if (process.env.FIREBASE_APP_HOSTING) {
  args.push('--webpack');
  // Con webpack, el build se comia los ~2 GB de heap que Node se da por defecto
  // en la maquina de Cloud Build y moria con "JavaScript heap out of memory"
  // tras seis minutos. Va en NODE_OPTIONS para que lo hereden los workers de Next.
  env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --max-old-space-size=6144`.trim();
}

const { status } = spawnSync(process.execPath, args, { stdio: 'inherit', env });
process.exit(status ?? 1);
