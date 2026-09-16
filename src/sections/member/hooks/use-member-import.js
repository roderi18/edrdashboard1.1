import { useRef, useState } from 'react';

import { generateMemberId } from 'src/utils/generate-member-id';
import { getCell, formatExcelDate, uploadExcelRows, normalizeTextValue } from 'src/utils/excel-upload';

import { getDestsApi } from 'src/services/dest-service';
import { authHeaders, invalidateMembersCache } from 'src/services/member-service';
import { crearNotificacionCuentaCreada } from 'src/services/notification-service';
import { createFirebaseAuthForMember } from 'src/services/member-auth-provisioning-service';
import { guardarAsignacionDirectiva } from 'src/services/directivas-organizacionales-service';

import { toast } from 'src/components/snackbar';

import {
  buildMemberUploadAddress,
  normalizeMemberUploadPhone,
  formatMemberUploadBirthDate,
} from 'src/sections/member/utils/member-upload-normalizers';

import {
  getApiMessage,
  readApiResponse,
  CABECERAS_MIEMBROS,
  DEFAULT_UPLOAD_PROGRESS,
  buscarPosicionDirectiva,
  getTemplateDestIdForUser,
} from '../member-toolbar-download-utils';

export function useMemberImport({ user, onMembersUploaded, onCloseActions }) {
  const uploadInputRef = useRef(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(DEFAULT_UPLOAD_PROGRESS);
  const [templateDownloading, setTemplateDownloading] = useState(false);
  // Del nombre del destacamento tal como viene en el archivo al id real. Se
  // compara sin acentos ni mayusculas y con el numero pegado o suelto, porque
  // quien rellena la hoja escribe "Tribu de Judá 18", "tribu de juda 18" o
  // "Tribu de Juda" indistintamente.
  const buscarDestacamentoPorNombre = (listaDests, texto) => {
    const buscado = normalizeTextValue(texto).replace(/\s+/g, ' ').trim();

    if (!buscado) return null;

    const candidatos = (listaDests || []).map((dest) => {
      const nombre = normalizeTextValue(dest.name || dest.nombre || dest.destName || '');
      const numero = String(dest.destNumber || dest.numero || dest.number || '').trim();

      return {
        dest,
        conNumero: [nombre, normalizeTextValue(numero)].filter(Boolean).join(' ').trim(),
        sinNumero: nombre,
      };
    });

    return (
      candidatos.find((candidato) => candidato.conNumero === buscado)?.dest ||
      candidatos.find((candidato) => candidato.sinNumero === buscado)?.dest ||
      null
    );
  };

  const handleUploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    onCloseActions();
    setUploadProgress({
      ...DEFAULT_UPLOAD_PROGRESS,
      open: true,
      phase: 'reading',
    });

    try {
      const listaDests = await getDestsApi({ includePhotos: false }).catch(() => []);
      // Codigos repartidos en ESTA carga. La lista de miembros se cachea 30
      // segundos y el API tarda en devolver al recien creado, asi que sin
      // llevarlos aparte todas las filas del archivo recibian el mismo codigo:
      // el segundo miembro en adelante entraba con un codigo ya ocupado.
      const codigosReservados = [];

      const result = await uploadExcelRows({
        file,
        processRow: async (row) => {
          // Si la hoja no trae las cabeceras esperadas se leen por POSICION, en el
          // orden de CABECERAS_MIEMBROS. Asi vale igual un Excel exportado de otro
          // sitio o un txt con barras: lo que importa es el orden de las columnas.
          const celdas = Object.values(row);
          const porPosicion = (indice) => celdas[indice] ?? '';
          const traeCabeceras = CABECERAS_MIEMBROS.some((cabecera) => row[cabecera] !== undefined);
          const leerValor = (indice, claves) =>
            traeCabeceras ? getCell(row, claves) : porPosicion(indice);
          // Todo se convierte a TEXTO. Excel guarda el telefono como numero
          // (18297878833) y la API lo exige como cadena: sin esto, cada fila que
          // viniera de un Excel se rechazaba con "could not be converted to String".
          const leer = (indice, claves) => String(leerValor(indice, claves) ?? '').trim();

          const nombre = leer(0, ['Nombre', 'nombre', 'Nombres', 'nombres']);
          const apellido = leer(1, ['Apellido', 'apellido', 'Apellidos', 'apellidos']);
          const nombreCompleto = `${nombre} ${apellido}`.trim();
          let fechaNacimiento = '';
          let telefono = '';

          try {
            fechaNacimiento = formatMemberUploadBirthDate(
              leerValor(2, ['Fecha_Nacimiento', 'fechaNacimiento', 'Fecha nacimiento', 'birthdate'])
            );
          } catch (error) {
            throw new Error(
              `Fecha_Nacimiento inválida para "${nombreCompleto || 'miembro sin nombre'}": ${error.message}`
            );
          }

          try {
            telefono = normalizeMemberUploadPhone(
              leerValor(3, ['Teléfono', 'telefono', 'Telefono'])
            );
          } catch (error) {
            throw new Error(
              `Teléfono inválido para "${nombreCompleto || 'miembro sin nombre'}": ${error.message}`
            );
          }

          const valores = {
            Nombre: nombre,
            Apellido: apellido,
            Fecha_Nacimiento: fechaNacimiento,
            Teléfono: telefono,
            Correo: leer(4, ['Correo', 'correo']),
            Provincia: leer(5, ['Provincia', 'provincia']),
            Municipio: leer(6, ['Municipio', 'municipio']),
            Sector: leer(7, ['Sector', 'sector']),
            Calle_Numero: leer(8, [
              'Calle / número',
              'Calle / Numero',
              'Calle / Número',
              'Calle_Numero',
              'Calle',
              'calle',
            ]),
            Destacamento: leer(9, ['Destacamento', 'destacamento']),
            Posicion_Destacamento: leer(10, [
              'Posición_Destacamento',
              'Posicion_Destacamento',
              'Posición en destacamento',
            ]),
            Posicion_Nacional: leer(11, [
              'Posición_Nacional',
              'Posicion_Nacional',
              'Posición nacional',
            ]),
            'Size_T-Shirt': leer(12, ['Size_T-Shirt', 'sizeCamisas', 'Talla']),
            Sexo: leer(13, ['Sexo', 'sexo', 'genero', 'Género', 'Genero']),
          };

          const direccionAnterior = String(
            getCell(row, ['Dirección', 'direccion', 'Direccion']) ?? ''
          ).trim();
          let direccion = '';

          try {
            direccion = buildMemberUploadAddress({
              province: valores.Provincia,
              municipality: valores.Municipio,
              sector: valores.Sector,
              streetAndNumber: valores.Calle_Numero,
              legacyAddress: direccionAnterior,
            });
          } catch (error) {
            throw new Error(
              `Dirección inválida para "${nombreCompleto || 'miembro sin nombre'}": ${error.message}`
            );
          }

          // Obligatorios solo los tres que identifican a la persona y la colocan. Con
          // todo obligatorio se rechazaba el archivo entero, porque casi nadie tiene
          // aun fecha de nacimiento ni correo registrados.
          const faltantes = ['Nombre', 'Apellido', 'Destacamento'].filter(
            (columna) => !String(valores[columna] ?? '').trim()
          );

          if (faltantes.length) {
            throw new Error(`Faltan: ${faltantes.join(', ')}.`);
          }

          const nombres = valores.Nombre;
          const apellidos = valores.Apellido;

          const destEncontrado = buscarDestacamentoPorNombre(listaDests, valores.Destacamento);
          const idDestacamento =
            Number(getCell(row, ['idDestacamento', 'destId', 'ID Destacamento'])) ||
            Number(destEncontrado?.id || destEncontrado?.idDestacamento) ||
            null;

          if (!idDestacamento) {
            throw new Error(`No existe el destacamento "${valores.Destacamento}".`);
          }

          const cargoDestacamento = buscarPosicionDirectiva(
            'destacamento',
            valores.Posicion_Destacamento
          );
          const cargoNacional = buscarPosicionDirectiva('nacional', valores.Posicion_Nacional);

          // Vacio significa "sin cargo". Solo se protesta cuando viene escrito algo
          // que no existe, que si es un error de quien rellena la hoja.
          if (valores.Posicion_Destacamento && !cargoDestacamento) {
            throw new Error(
              `No existe la posición de destacamento "${valores.Posicion_Destacamento}".`
            );
          }

          if (valores.Posicion_Nacional && !cargoNacional) {
            throw new Error(`No existe la posición nacional "${valores.Posicion_Nacional}".`);
          }

          const codigoMiembro =
            getCell(row, ['codigoMiembro', 'Código', 'Codigo']) ||
            (await generateMemberId({ codigosReservados }));

          codigosReservados.push(codigoMiembro);

          const res = await fetch('/api/members/post/', {
            method: 'POST',
            // Con el token: la ruta exige permiso de cargo y sin cabecera de
            // sesion contesta 401 y la importacion no llegaba a escribir.
            headers: await authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              idMiembros: 0,
              codigoMiembro,
              nombres,
              apellidos,
              // Vacio va como null, no como "": el backend rechaza la cadena vacia
              // en fecha y division ("The JSON value could not be converted to
              // DateOnly"), y toda la fila se perdia sin decir por que.
              genero: valores.Sexo || null,
              fechaNacimiento: valores.Fecha_Nacimiento || null,
              idDestacamento,
              telefono: valores['Teléfono'] || null,
              direccion: direccion || null,
              correo: valores.Correo || null,
              sizeCamisas: valores['Size_T-Shirt'] || null,
              idCargoLocal: Number(getCell(row, ['idCargoLocal'])) || null,
              idCargoInstitucional: Number(getCell(row, ['idCargoInstitucional'])) || null,
              idDivision: Number(getCell(row, ['idDivision'])) || null,
              instructorCertificadoCi:
                getCell(row, ['instructorCertificadoCi', 'Instructor CI']) || false,
              estatusVigenciaCi: getCell(row, ['estatusVigenciaCi', 'Estatus CI']) || false,
              fechaInicioCertificado:
                formatExcelDate(
                  getCell(row, ['fechaInicioCertificado', 'Fecha inicio certificado'])
                ) || null,
              fechaFinCertificado:
                formatExcelDate(getCell(row, ['fechaFinCertificado', 'Fecha fin certificado'])) ||
                null,
              estatusMiembro: getCell(row, ['estatusMiembro', 'Estatus']) || 'activo',
              cargosmiembros: [],
              idDestacamentoNavigation: null,
              idDivisionNavigation: null,
              miembromeritos: [],
              participanteseventos: [],
              tutores: [],
              usuarios: [],
              idUniformes: [],
              uniformesMiembros: [],
            }),
          });
          const responsePayload = await readApiResponse(res);
          const responseMessage = getApiMessage(responsePayload);

          if (!res.ok) {
            throw new Error(responseMessage || `Error creando miembro (${res.status}).`);
          }

          if (responsePayload?.Success === false) {
            throw new Error(responseMessage || 'El API no pudo crear el miembro.');
          }

          // Los cargos se asignan DESPUES de crear al miembro, que es cuando existe
          // el id al que colgarlos. Si el API no lo devuelve, el miembro queda
          // creado y el cargo sin poner: se avisa en vez de callarlo.
          const idCreado =
            responsePayload?.data?.idMiembros ??
            responsePayload?.Data?.idMiembros ??
            responsePayload?.idMiembros ??
            null;

          if (!idCreado) {
            throw new Error(
              'El miembro se creó, pero el API no devolvió su id y quedó sin cargos.'
            );
          }

          // Un cargo por nivel, y solo si la hoja lo trae: sin esta guarda, subir a
          // alguien sin cargo reventaba al leer `idCargo` de null.
          const asignaciones = [
            cargoDestacamento && {
              nivel: 'destacamento',
              idEntidad: idDestacamento,
              nombreEntidad: valores.Destacamento,
              cargo: cargoDestacamento,
            },
            cargoNacional && {
              nivel: 'nacional',
              idEntidad: 'general',
              nombreEntidad: 'Consejo Nacional',
              cargo: cargoNacional,
            },
          ].filter(Boolean);

          for (const asignacion of asignaciones) {
            // En serie: son dos como mucho, y a la vez se pisarian al escribir el
            // mismo documento de directiva.

            await guardarAsignacionDirectiva({
              nivel: asignacion.nivel,
              idEntidad: asignacion.idEntidad,
              nombreEntidad: asignacion.nombreEntidad,
              idCargo: asignacion.cargo.idCargo,
              idPosicionDirectiva: asignacion.cargo.idCargo,
              division: asignacion.cargo.division ?? null,
              orden: asignacion.cargo.orden ?? 1,
              idMiembro: idCreado,
              nombreMiembro: `${nombres} ${apellidos}`.trim(),
              codigoMiembro,
              usuario: user,
            });
          }

          let authCredentials = null;

          try {
            authCredentials = await createFirebaseAuthForMember({
              codigoMiembro,
              firstName: nombres,
              lastName: apellidos,
              destId: idDestacamento,
              memberId: idCreado,
            });
          } catch (authError) {
            if (authError?.code === 'auth/email-already-in-use') {
              console.warn('[member upload] firebase auth user already exists', authError);
            } else {
              throw new Error(
                `El miembro se creó, pero no se pudo crear su cuenta de acceso: ${authError?.message || 'error desconocido'}`
              );
            }
          }

          if (authCredentials) {
            crearNotificacionCuentaCreada({
              cuenta: {
                idMiembros: idCreado,
                codigoMiembro,
                uid: authCredentials.uid,
                displayName: `${nombres} ${apellidos}`.trim(),
                email: authCredentials.emailFake,
              },
              usuario: user,
            }).catch((notificationError) => {
              console.error('[member upload] account notification failed', notificationError);
            });
          }
        },
        onStart: ({ total }) => {
          setUploadProgress((current) => ({
            ...current,
            phase: 'uploading',
            total,
          }));
        },
        onProgress: ({ total, processed, inserted, failed }) => {
          setUploadProgress({
            open: true,
            phase: 'uploading',
            total,
            processed,
            inserted,
            failed,
          });
        },
      });

      invalidateMembersCache();

      if (result.inserted > 0 && onMembersUploaded) {
        setUploadProgress((current) => ({ ...current, phase: 'refreshing' }));

        try {
          await onMembersUploaded();
        } catch (error) {
          console.error('Error refreshing members after upload:', error);
          toast.error('Los miembros se cargaron, pero no se pudo actualizar la vista.');
        }
      }

      setUploadResult(result);
    } catch (error) {
      setUploadResult({
        total: 0,
        inserted: 0,
        failures: [
          {
            rowNumber: 'archivo',
            reason: error?.message || 'No se pudo leer o procesar el documento.',
            row: { archivo: file.name },
          },
        ],
      });
    } finally {
      setUploadProgress(DEFAULT_UPLOAD_PROGRESS);
    }
  };

  const handleDownloadMemberTemplate = async () => {
    setTemplateDownloading(true);

    try {
      const templateDestId = getTemplateDestIdForUser(user);
      const query = templateDestId ? `?destId=${encodeURIComponent(templateDestId)}` : '';
      const response = await fetch(`/api/members/template/${query}`, { cache: 'no-store' });

      if (!response.ok) {
        const payload = await readApiResponse(response);
        throw new Error(getApiMessage(payload) || 'No se pudo generar la plantilla.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = 'plantilla-miembros.xlsx';
      link.click();
      URL.revokeObjectURL(url);
      onCloseActions();
    } catch (error) {
      toast.error(error?.message || 'No se pudo descargar la plantilla de miembros.');
    } finally {
      setTemplateDownloading(false);
    }
  };

  return {
    uploadInputRef,
    uploadResult,
    uploadProgress,
    templateDownloading,
    handleUploadFile,
    handleDownloadMemberTemplate,
    closeUploadResult: () => setUploadResult(null),
  };
}