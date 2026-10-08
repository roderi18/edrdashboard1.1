# Membresía ONERRD 2027

Aplicación Next.js independiente del dashboard `next-js`, ubicada en el Escritorio. Reutiliza el patrón visual MUI de `errd-registro`, el mismo padrón .NET de destacamentos y el mismo proyecto Firebase; **no copia credenciales** al repositorio.

## Pantallas

Hechas con el tema y los componentes del dashboard (los mismos que `errd-registro`: `Label`, `Iconify`, `Field`, `Upload`, calendario en español). Pública, sin cuenta.

| Ruta | Qué es |
| --- | --- |
| `/` | Portada: cómo funciona, planes, documentos y avance nacional. |
| `/registro/destacamento` | Paso 1: se elige del censo; región, sección, iglesia, pastor y coordinador salen de la base de datos. Las 4 compuertas se ven antes de seguir. |
| `/registro/plan` | Paso 2: solo los planes que le tocan (`src/utils/planes-membresia.mjs`). |
| `/registro/pago` | Paso 3: correo y teléfono del que paga; transferencia con comprobante o PayPal. |
| `/registro/resultado?solicitud=…` | Paso 4: estado de la solicitud y descarga del certificado y la factura. |

Piezas en `src/sections/membresia/`. El estado del registro lo comparte `registro/contexto-registro.jsx`; solo el destacamento y el plan se recuerdan en la pestaña.

## Tarifas

- No registrado en 2026: RD$2,500 (con RRI TRaC), única opción.
- Registrado en 2026: RD$2,250 (con RRI TRaC), descuento por fidelidad.
- Con licencia RRI TRaC que habilita 2027: además RD$1,500 (solo cuota de registro).

El registro 2026 sale de «Registrado en la Oficina Nacional» del padrón; `elegibilidadMembresia2027/{id}` lo corrige. Las licencias se marcan con `node --env-file=.env.local scripts/licencias-rri-trac.mjs 97 179 --aplicar`.

## Estado

- Flujo paginado: destacamento → plan → pago → resultado, adaptable a móvil.
- Destacamentos, iglesia, pastor, región, sección y coordinador consultados en las fuentes de `errd-registro`.
- La elegibilidad 2026/2027 y las licencias se leen de Firestore. No hay licencias ni datos personales hardcodeados.
- Tarifas calculadas de nuevo en el servidor. Con licencia habilitada para 2027 hay dos opciones: RD$1,500 o RD$2,250.
- Transferencias con comprobante privado y aprobación/rechazo administrativa. PayPal Orders v2 con captura servidor-servidor y webhook verificado.
- El código `ONERRD 2027-XXXX` se asigna al confirmar mediante transacción Firestore. PDF de certificado con QR firmado y factura con desglose.
- Correos con los dos PDF al confirmar y aviso de rechazo mediante Resend, si se configuran las credenciales.
- Estadísticas públicas agregadas por región; no exponen personas ni montos.

**No está listo para cobros reales sin completar la configuración y las decisiones al final de este documento.** No se han ejecutado transacciones reales de PayPal ni aprobado comprobantes reales.

La bandera `ONERRD_LANZAMIENTO_HABILITADO` está en `false` por defecto. Aun con datos bancarios o PayPal cargados, los endpoints de cobro devuelven 503 hasta que la Oficina Nacional apruebe el lanzamiento.

## Desarrollo

1. `npm install`
2. Crear `.env.local` a partir de `.env.example`; compartir las variables Firebase y `API_NET_URL` del proyecto existente sin subirlas a Git.
3. `npm run dev` y abrir `http://localhost:3050`.
4. `npm test` y `npm run build`.

La API administrativa requiere `Authorization: Bearer <ONERRD_ADMIN_API_KEY>` (mínimo 32 caracteres). No publicar esta clave en el navegador ni en Git. La pantalla de administración con inicio de sesión por cuenta del dashboard aún no está integrada; esta API es una base técnica, no un panel para el equipo.

## Datos compartidos

| Origen | Uso |
| --- | --- |
| API .NET: destacamentos, iglesias, secciones, regiones y miembros | Identificación oficial y nombres del liderazgo. |
| Firestore `estado_destacamentos` y `asignacionesDirectiva` | Estatus operativo y coordinador. |
| Firestore `elegibilidadMembresia2027/{idDestacamento}` | `existeCenso2026`, `registrado2026` y `habilitado2027` (booleanos validados por la Oficina Nacional). |
| Firestore `licenciasRriTrac/{idDestacamento}` | `licencias`: lista de `{titular, fechaActivacion, estado, habilita2027, nota}`. Puede haber varias licencias para un mismo destacamento. |
| Firestore `configuracionMembresia2027/tasa` | `{fecha: "AAAA-MM-DD", rdPorUsd: número}`; debe actualizarse cada día para activar PayPal. |
| Firestore `configuracionMembresia2027/contador` | `ultimo` consecutivo; modificar solo mediante el flujo transaccional. |
| Firestore `membresiasOnerrd2027/{idDestacamento}` | Una solicitud por destacamento/año; eventos de auditoría en la subcolección `eventos`. |

La lista de licencias se administra con `PUT /api/admin/licencias/{idDestacamento}` y un cuerpo `{ "licencias": [...] }`. Se admite `sin_activar`, pero **no** se concede la tarifa especial hasta que `habilita2027` se marque expresamente. La licencia personal sin destacamento no se vincula a ninguno.

La validación manual de transferencias usa `PATCH /api/admin/membresias/{idDestacamento}` con `{ "accion": "confirmar" | "rechazar", "oficialId": "...", "motivo": "..." }`; el motivo es obligatorio al rechazar. `GET` devuelve el expediente y `?comprobante=1` el archivo privado. La clave administrativa compartida **no demuestra por sí sola la identidad** del oficial indicado: se necesita vincular esta API a Firebase Auth antes de producción.

## Cobro y documentos

| Segmento | Opciones | Desglose propuesto |
| --- | --- | --- |
| No registrado en 2026, sin licencia | RD$2,500 | Registro 1,500 + RRI TRaC 1,000. |
| Registrado en 2026, sin licencia | RD$2,250 | Registro 1,500 + RRI TRaC 1,000 - descuento 250. |
| Licencia que habilita 2027 | RD$1,500 o RD$2,250 | Solo registro 1,500, o registro 1,500 + RRI TRaC 750. |

El desglose es una **interpretación provisional** que suma los totales dados; la conversación original contiene otra distribución de RD$750/RD$1,000 que necesita confirmación contable. El certificado es idéntico para los planes; la factura sí distingue los conceptos, USD y tasa cuando aplica.

PayPal usa `PAYPAL_ENV=sandbox` por defecto. Configurar `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `NEXT_PUBLIC_SITE_URL` público HTTPS y la tasa diaria antes de probar. Registrar el evento `PAYMENT.CAPTURE.COMPLETED` hacia `/api/paypal/webhook/`. El retorno del navegador nunca se toma como comprobante de pago: el servidor captura y contrasta monto, moneda, pedido y transacción directamente con PayPal. El webhook ofrece reconciliación adicional.

La verificación QR usa HMAC SHA-256 y `ONERRD_QR_SECRET` (mínimo 32 caracteres). Mantener esta clave estable durante toda la vigencia de los certificados; cambiarla invalidaría la verificación de los ya emitidos. El token de descarga de cada solicitud es privado y se entrega solo al solicitante o al correo configurado.

## Pendiente antes del lanzamiento

1. Confirmar la fuente oficial del censo/registro 2026 y cargar `registrado2026` y `habilitado2027` desde datos verificados; actualmente la app falla cerrada si faltan.
2. Resolver la vigencia de licencias de 11, 94, 157 y 287; la segunda licencia del 97; y si la licencia sin activar del 18 habilita RD$1,500. Cargar la decisión en Firestore, no en código.
3. Aprobar el desglose contable de las tres tarifas, la vigencia anual frente a la regla de octubre y si se exige iniciar sesión con la cuenta del dashboard.
4. Proporcionar datos bancarios, credenciales PayPal Business, URL pública, dominio de correo verificado y secretos del servidor. Probar sandbox, webhook, comprobantes y envío de correo de extremo a extremo.
5. Integrar un panel administrativo con autenticación real de Firebase, atribución fiable a cada oficial, bandeja de aprobación y mantenimiento de licencias/tasa. La API con clave es temporal.
6. Reconciliar intentos PayPal cancelados o abandonados; no liberar automáticamente una solicitud pendiente sin confirmar en PayPal que no hubo captura.
7. Revisar el certificado visual y la factura con la Oficina Nacional; decidir si se requieren firma, sello, NCF o requisitos fiscales adicionales antes de llamarla factura oficial.
   El dashboard ya tiene un editor y un PDF ONERRD con diseño propio; este repositorio genera un PDF de borrador separado y todavía no reutiliza aquel diseño ni muestra las nuevas emisiones en «Certificados creados». Los cuatro certificados 2027 del dashboard fueron identificados por el solicitante como pruebas: no se mezclan con el nuevo consecutivo.
8. Añadir exportaciones internas CSV/XLSX/PDF y filtros avanzados requeridos por el documento funcional.

Referencias: `Requerimientos Funcionales Membresia ONERRD 2027.pdf` (v2.4, entregado por la Oficina Nacional) y reglas de precios/licencias precisadas por el solicitante en la conversación.
