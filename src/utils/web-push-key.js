// LA CLAVE PUBLICA VAPID DE CADA ENTORNO.
//
// Estaba escrita aqui a mano, y era la de produccion. Desarrollo y QA tienen su
// propio par VAPID (su privada vive en Secret Manager de su proyecto): con la
// publica de produccion, el navegador se suscribia con una clave que no casa con
// la privada del servidor y los avisos push no llegaban —o, peor, con la privada
// de produccion un aviso de prueba llegaba al movil de personas reales—.
//
// Cada entorno la pone en su `apphosting.<entorno>.yaml`. Sin variable, la de
// produccion de siempre: produccion no cambia.
const CLAVE_PUBLICA_DE_PRODUCCION =
  'BNVAgCkmt9aP3b4n1wn2EHsPGRRoRb82fBZnlP4i7xjsbMY3TxecXrCA9M5aExYq_pdBIG-ykXl2eWyqhh-Rr1o';

export const WEB_PUSH_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || CLAVE_PUBLICA_DE_PRODUCCION;
