import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default {
  trailingSlash: true,
  serverExternalPackages: ['firebase-admin'],
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
};
