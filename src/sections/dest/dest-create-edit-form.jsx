import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { normalizeText } from 'src/utils/normalize-text';
import { countMembersByDestId } from 'src/utils/member-count';
import { esperar, RETARDO_GUARDADO_MS } from 'src/utils/ui-delays';
import { isDestacamentoAdminRole } from 'src/utils/admin-role-label';
import { construirResumenMiembro } from 'src/utils/leadership-assignments';
import { getImageOptimizationMessage } from 'src/utils/upload-optimization-message';
import {
  getOwnRegionIdsForUser,
  canMemberManageMembers,
  isCoordinadorDestacamentoRole,
} from 'src/utils/member-access';
import {
  subirFotoEntidad,
  subirFotoEntidadPropuesta,
  obtenerFotosPrincipalesPorEntidad,
} from 'src/utils/firebase-photos';
import {
  isAdminGlobal,
  isFullOrgManager,
  getSectionScopeIds,
  isRegionScopedCreator,
  canCreateDestInSection,
  isSectionScopedManager,
  canEditDest as canGestionarDestPorAlcance,
} from 'src/utils/org-level-access';

import { AUTH } from 'src/lib/firebase';
import barriosData from 'src/data/barrios.json';
import { DestSchema } from 'src/models/dest-schema';
import provinciasData from 'src/data/provincias.json';
import municipiosData from 'src/data/municipios.json';
import { ChurchSchema } from 'src/models/church-schema';
import { getMembers } from 'src/services/member-service';
import { getRegionals } from 'src/services/regional-service';
import { getSectionals } from 'src/services/sectional-service';
import { DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';
import { asegurarPastorDelDestacamento } from 'src/services/pastor-destacamento-service';
import {
  getChurches,
  createChurchApi,
  updateChurchApi,
  buildChurchPayload,
} from 'src/services/church-service';
import {
  guardarAsignacionDirectiva,
  obtenerAsignacionesDirectiva,
} from 'src/services/directivas-organizacionales-service';
// import { ChurchSchema } from 'src/models/church-schema';
// import { saveChurch } from 'src/services/church-service';
// import { createChurch } from 'src/models/church-model';
// import { createChurchApi } from 'src/services/church-service';
import {
  saveDest,
  getDestsApi,
  createDestApi,
  updateDestApi,
  mapApiDestToUI,
  proponerFotoDestacamento,
} from 'src/services/dest-service';

// Posicion del catalogo que corresponde al Coordinador de Destacamento: de ella
// salen el id de cargo y el orden con los que se guarda la asignacion.
const POSICION_COORDINADOR_DEST = DIRECTIVA_POSITIONS.find(
  (position) => position.idCargo === 'destacamento-coordinador-destacamento'
);

// ¿Cambio algo de la IGLESIA respecto a lo que ya esta guardado?
//
// Se compara por VALOR y no por "campo tocado" del formulario: asi, escribir algo
// y deshacerlo tampoco dispara una escritura. La direccion se compara ya armada,
// que es como viaja al backend (provincia, municipio, sector y calle van juntas
// en un solo texto).
const hayCambiosDeIglesia = (datosIglesia, iglesiaActual) => {
  // Sin registro previo no hay con que comparar: se intenta la actualizacion.
  if (!iglesiaActual) return true;

  const payload = buildChurchPayload(datosIglesia);

  return (
    payload.nombre !== (iglesiaActual.name ?? '') ||
    payload.pastor !== (iglesiaActual.pastor ?? '') ||
    payload.direccion !== (iglesiaActual.address ?? '') ||
    String(payload.idSeccion) !== String(iglesiaActual.idSeccion ?? '')
  );
};

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';
import StatusLabel from 'src/components/common/status-label';
import { ContextInfo } from 'src/components/info/context-info';
import DashedAccordion from 'src/components/expandable/DashedAccordion';
import { EntityInfoPdfMenu } from 'src/components/info/entity-info-pdf-menu';
import ChurchDestSection from 'src/components/form/dest-form/ChurchDestSection';
import DestGeneralSection from 'src/components/form/dest-form/DestGeneralSection';

import { useAuthContext } from 'src/auth/hooks';
import { can, PERMISOS, puedeModificar, estaDentroDelAlcance } from 'src/auth/permissions';
// ----------------------------------------------------------------------
const provinces = provinciasData;

const municipios = municipiosData.map((m, index) => ({
  ...m,
  id: index + 1,
  municipioId: index + 1,
}));

const sectores = barriosData;

const disabledReadableFieldSx = {
  '& .MuiAutocomplete-popupIndicator.Mui-disabled, & .MuiSelect-icon.Mui-disabled': {
    display: 'none',
  },
};

const mapDestToForm = (dest, sectionals, regionals, churches, members) => {
  const church = churches.find((c) => String(c.id) === String(dest.churchId)) || {};
  const direccionParts = (church.address || '')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

  const [provinceName = '', municipioName = '', sectorName = '', street = ''] = direccionParts;
  const province = provinces.find(p => p.nombre?.trim() === provinceName);
  const municipio = municipios.find(m => m.nombre === municipioName);
  const sector = sectores.find(s => s.nombre === sectorName);

  return {
    avatarUrl: dest.avatarUrl ?? null,

    name: dest.name ?? '',
    destNumber: dest.destNumber ?? '',

    coordinatorId: dest.coordinatorId ?? null,

    registradoOfnc: dest.registradoOfnc ?? true,
    rritrackActivo: dest.rritrackActivo ?? false,

    correo:
      dest.correo && dest.correo.startsWith('nomail_')
        ? ''
        : dest.correo ?? '',
    telefono: dest.telefono ?? '',
    direccion: dest.direccion ?? '',
    concilio: dest.concilio ?? '',
    fechaInicio: dest.fechaInicio ?? '',

    country: dest.country ?? 'República Dominicana',

    churchId: dest.churchId ?? null,

    destMeetingDays: dest.destMeetingDays ?? '',
    destMeetingTimes: dest.destMeetingTimes ?? '',

    isVerified: dest.isVerified ?? true,

    churchName: church.name ?? '',
    pastor: church.pastor ?? '',
    address: church.address ?? '',
    provinceId: province?.id ? String(province.id) : '',
    municipioId: municipio?.id ? String(municipio.id) : '',
    sectorId: sector?.id ? String(sector.id) : '',
    street: street ?? '',
    countryId: church.countryId ?? '',

    // el church mapeado expone idSeccion (no sectionId); leer ambos por compatibilidad
    sectionId: church.sectionId ?? church.idSeccion ?? '',
    sectionalName: church.sectionalName ?? '',
  };
};
// ----------------------------------------------------------------------

export function DestCreateEditForm({ currentDest }) {
  const isCreateView = !currentDest;
  const [step, setStep] = useState(isCreateView ? 1 : 2);
  const router = useRouter();
  const { user } = useAuthContext();
  const [dests, setDests] = useState([]);
  const [sectionals, setSectionals] = useState([]);
  const [regionals, setRegionals] = useState([]);
  const [churches, setChurches] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  // Coordinador guardado en la base de datos (Firestore). `undefined` mientras no
  // se resuelve; `null` cuando el destacamento no tiene coordinador asignado.
  const [coordinatorFromDb, setCoordinatorFromDb] = useState(undefined);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const membersCount = countMembersByDestId(allMembers, currentDest?.id);
  const isDestacamentoAdmin = isDestacamentoAdminRole(user);
  // Administrador "pleno" (global/funcional/legado) sin restriccion de alcance.
  // Los admin de seccion/region NO entran aqui: editan solo dentro de su alcance.
  const isLegacyAdmin = isFullOrgManager(user);


  const defaultValues = {
    avatarUrl: null,

    name: '',
    destNumber: '',

    coordinatorId: null,
    churchId: null,

    country: '',

    destMeetingDays: '',
    destMeetingTimes: '',

    correo: '',
    telefono: '',

    registradoOfnc: true,
    rritrackActivo: false,

    // status: 'active',
    isVerified: true,

    churchName: '',
    pastor: '',
    address: '',
    provinceId: '',
    countryId: '',
    sectionId: '',
    sectionalName: '',

    fechaInicio: '',
    direccion: '',
    concilio: '',
  };

  const CombinedSchema = step === 1 ? ChurchSchema : DestSchema;
  const methods = useForm({
    mode: 'onSubmit',
    resolver: zodResolver(CombinedSchema),
    defaultValues,
    shouldUnregister: false,
  });

  useEffect(() => {
    let isMounted = true;

    if (!currentDest) return undefined;
    if (churches.length === 0) return undefined;

    if (isMounted) {
      methods.reset({
        ...mapDestToForm(currentDest, sectionals, regionals, churches, allMembers),
        // El coordinador es la fuente de verdad de la base de datos (Firestore).
        // Cuando ya se resolvio, sobreescribe el valor del cache local.
        ...(coordinatorFromDb !== undefined ? { coordinatorId: coordinatorFromDb } : {}),
      });
    }

    return () => {
      isMounted = false;
    };
  }, [currentDest, churches, sectionals, regionals, allMembers, coordinatorFromDb]);

  useEffect(() => {
    const loadData = async () => {
      // Las fotos viven en Firebase, no en la lista que devuelve la API: sin
      // pedirlas aparte, toda persona salia con el avatar generico.
      const [membersData, fotos] = await Promise.all([
        getMembers(),
        obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'miembro' }).catch(() => ({})),
      ]);
      const normalizedMembers = (Array.isArray(membersData) ? membersData : []).map((member) => ({
        ...member,
        avatarUrl: fotos[String(member?.id)]?.urlFoto || member?.avatarUrl || '',
      }));
      setAllMembers(normalizedMembers);

      // Coordinador de destacamento desde la base de datos (Firestore). Se mapea
      // el idMiembros numerico guardado al `memberId` (codigo) que usa el form.
      if (currentDest?.id) {
        try {
          const asignaciones = await obtenerAsignacionesDirectiva({
            nivel: 'destacamento',
            idEntidad: Number(currentDest.id),
          });
          const coordinador = asignaciones.find(
            (asignacion) => asignacion.idPosicionDirectiva === POSICION_COORDINADOR_DEST?.idCargo
          );
          const coordinatorMember = coordinador
            ? normalizedMembers.find(
              (member) => String(member.id) === String(coordinador.idMiembro)
            )
            : null;

          setCoordinatorFromDb(coordinatorMember?.memberId ?? null);
        } catch (coordError) {
          console.warn('[dest form] no se pudo cargar el coordinador del destacamento', coordError);
        }
      }

      const res = await fetch('/api/dest');
      const data = await res.json();
      // La API responde { data: [...] } (minúscula). Antes se leía data.Data y
      // el listado quedaba vacío, rompiendo la resolución de la sección del
      // coordinador (dest → iglesia → sección).
      const destArray = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.Data)
          ? data.Data
          : [];
      setDests(destArray.map(mapApiDestToUI));

      const sectionalsData = await getSectionals();
      setSectionals(Array.isArray(sectionalsData) ? sectionalsData : []);

      const regionalsData = await getRegionals();
      setRegionals(Array.isArray(regionalsData) ? regionalsData : []);

      const churchesData = await getChurches();
      setChurches(Array.isArray(churchesData) ? churchesData : []);
    };

    loadData();
  }, []);

  const {
    reset,
    watch,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const values = watch();
  const destName = watch('name');
  const destNumber = watch('destNumber');

  const selectedSectionId = watch('sectionId');

  const sectional = Array.isArray(sectionals)
    ? sectionals.find((s) => String(s.id) === String(selectedSectionId))
    : null;

  const regional = sectional
    ? regionals.find((r) => String(r.id) === String(sectional.regionalId))
    : null;
  const currentDestResource = {
    ...currentDest,
    id: currentDest?.id,
    idDestacamento: currentDest?.id || currentDest?.idDestacamento,
    destacamentoId: currentDest?.id || currentDest?.idDestacamento,
    seccionId: selectedSectionId || currentDest?.sectionId || currentDest?.idSeccion,
    idSeccion: selectedSectionId || currentDest?.sectionId || currentDest?.idSeccion,
    regionId: regional?.id || currentDest?.regionId || currentDest?.idRegion,
    idRegion: regional?.id || currentDest?.regionId || currentDest?.idRegion,
  };
  // En creación, habilitar el formulario para cualquier rol con el permiso
  // `destacamentos.crear` del catálogo (coordinador/sub-coordinador seccional),
  // de forma coherente con el botón "Crear nuevo" de la lista. El acotado por
  // sección (canCreateDestInSection) sigue vigente para las sesiones que ya
  // traen su alcance; el catálogo cubre las que aún no lo tienen resuelto.
  const canCreateDestByRole = puedeModificar(user, PERMISOS.DESTACAMENTOS_CREAR);
  // MODIFICAR un destacamento ya creado es cosa del Administrador Global. Antes
  // bastaba con `destacamentos.editar`, asi que un Coordinador Seccional podia
  // reescribir el nombre, el numero o la iglesia de cualquier destacamento de su
  // seccion. CREARLO sigue como estaba: es la via por la que la seccion da de
  // alta los suyos.
  const canEditDest = isCreateView
    ? !isDestacamentoAdmin &&
      (isLegacyAdmin || canCreateDestInSection(user) || canCreateDestByRole)
    : isAdminGlobal(user);
  // Lo que el Coordinador de Destacamento y su Asistente SI llevan de su propio
  // destacamento: cuando se reunen, a que hora, quien coordina, y el telefono y
  // el correo de contacto. El Pastor queda fuera: su rol es de solo lectura.
  const canEditCoordinatorFields =
    !isCreateView &&
    isCoordinadorDestacamentoRole(user) &&
    estaDentroDelAlcance(user, currentDestResource);
  // Alcance sobre ESTE destacamento para la foto de perfil. Ademas del alcance del
  // token (`estaDentroDelAlcance`), se acepta `canEditDest`, que resuelve la
  // seccion del Coordinador Seccional y de su Sub-Coordinador aunque la sesion no
  // exponga el alcance completo. Sigue acotado: solo los destacamentos de su
  // seccion, nunca los ajenos.
  // La foto la CAMBIA el Administrador Global; el Coordinador de Destacamento y
  // su Asistente la SUGIEREN. Los dos usan el mismo control —dejarlo en gris no
  // decia que se puede proponer una— y lo que cambia es a donde va: aplicada o a
  // la bandeja de la Oficina Nacional.
  const canUploadDestPhoto = isCreateView
    ? !isDestacamentoAdmin &&
      (isLegacyAdmin ||
        canCreateDestInSection(user) ||
        canCreateDestByRole ||
        (puedeModificar(user, PERMISOS.DESTACAMENTOS_SUBIR_FOTO) &&
          (estaDentroDelAlcance(user, currentDestResource) ||
            canGestionarDestPorAlcance(user, currentDestResource))))
    : isAdminGlobal(user) || canEditCoordinatorFields;
  // Solo sugerir: la foto oficial no cambia hasta que la aprueben.
  const soloSugiereFoto = !isCreateView && !isAdminGlobal(user) && canEditCoordinatorFields;
  const canSaveDest = canEditDest || canEditCoordinatorFields;
  // El admin de destacamento solo puede descargar la informacion de miembros de
  // su propio destacamento; en otros destacamentos esa opcion no se ofrece.
  const canDownloadMembersInfo =
    !isDestacamentoAdmin || estaDentroDelAlcance(user, currentDestResource);

  // El mismo criterio que aplica la pantalla de creacion de miembros. Se repite
  // aqui para no ofrecer un atajo que termine en un "no tienes permisos".
  const canCreateMembers =
    user?.role === 'member'
      ? canMemberManageMembers(user)
      : isFullOrgManager(user) || can(user, PERMISOS.MIEMBROS_CREAR);

  // Sección con la que está registrado el usuario que crea el destacamento
  // (coordinador/sub-coordinador seccional). Se resuelve, en orden: sección
  // directa en la sesión/miembro, por director de la sección, por alcance de la
  // sesión, y por su membresía (destacamento → iglesia → sección). Con ella se
  // bloquea el campo "Sección".
  const ownSectionalForCreation = (() => {
    if (!isCreateView || !isSectionScopedManager(user) || !sectionals.length) return null;

    const userKeys = [user?.idMiembros, user?.id, user?.memberId, user?.codigoMiembro]
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map((value) => String(value));

    // Registro completo del propio usuario en el directorio (trae destId, etc.,
    // que la sesión puede no exponer).
    const selfMember = allMembers.find((m) =>
      [m?.id, m?.memberId, m?.idMiembros, m?.codigoMiembro].some((value) =>
        userKeys.includes(String(value))
      )
    );

    const findSectional = (sectionId) =>
      sectionId !== null && sectionId !== undefined && sectionId !== ''
        ? sectionals.find(
          (s) => String(s.idSeccion) === String(sectionId) || String(s.id) === String(sectionId)
        )
        : null;

    // a) Sección directa en la sesión o en el registro del miembro.
    const byDirect = findSectional(
      user?.sectionalId ??
      user?.idSeccion ??
      user?.seccionId ??
      selfMember?.sectionalId ??
      selfMember?.idSeccion ??
      selfMember?.seccionId
    );
    if (byDirect) return byDirect;

    // b) La sección cuyo director es este usuario.
    const byDirector = sectionals.find(
      (s) => s.directorId && userKeys.includes(String(s.directorId))
    );
    if (byDirector) return byDirector;

    // c) Por alcance de la sesión.
    const scopeIds = getSectionScopeIds(user);
    const byScope = sectionals.find(
      (s) => scopeIds.has(String(s.id)) || scopeIds.has(String(s.idSeccion))
    );
    if (byScope) return byScope;

    // d) Por membresía: destacamento → iglesia → sección.
    const userDestId =
      user?.destId ?? user?.idDestacamento ?? selfMember?.destId ?? selfMember?.idDestacamento;
    const userDest = userDestId
      ? dests.find((d) =>
        [d?.id, d?.idDestacamento].some((value) => String(value) === String(userDestId))
      )
      : null;
    const userChurchId = userDest?.idIglesia ?? userDest?.churchId;
    const userChurch =
      userChurchId != null
        ? churches.find((c) =>
          [c?.idIglesia, c?.id].some((value) => String(value) === String(userChurchId))
        )
        : null;

    return findSectional(userChurch?.idSeccion ?? userChurch?.sectionId);
  })();

  // Coordinador Regional y Sub-Director Regional: crean destacamentos en
  // CUALQUIER sección de su región (no en una sola, como el cargo seccional), así
  // que en vez de fijar la sección se acota el desplegable a las de su región.
  const ownRegionIdsForCreation = (() => {
    if (!isCreateView || !isRegionScopedCreator(user)) return null;

    const ids = new Set(
      [...getOwnRegionIdsForUser(user, { dests, churches, sectionals })].map(String)
    );

    // Fallback: la región cuyo director es este usuario (cuando la sesión no trae
    // el alcance resuelto), igual que hace el formulario de secciones.
    const userKeys = [user?.idMiembros, user?.id, user?.memberId, user?.codigoMiembro]
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map((value) => String(value));

    regionals.forEach((item) => {
      if (item?.directorId && userKeys.includes(String(item.directorId))) {
        [item?.regionId, item?.id]
          .filter((value) => value !== null && value !== undefined && value !== '')
          .forEach((value) => ids.add(String(value)));
      }
    });

    return ids.size ? ids : null;
  })();

  // Id del destacamento RECIEN creado. La API no lo devuelve, asi que hay que
  // reconocerlo en el listado — y ahi esta la trampa: buscar por nombre y numero
  // y quedarse con el PRIMERO devolvia otro destacamento cuando ya habia alguno
  // con el mismo nombre. Paso de verdad: el pastor de "Tribu de Judá 18" acabo
  // asignado a un homonimo creado en pruebas anteriores.
  //
  // Se acota con la iglesia, que es lo que de verdad lo distingue, y entre los
  // que queden gana el de id mas alto: el ultimo en crearse.
  const resolveDestId = async (destNameValue, destNumberValue, churchIdValue) => {
    if (currentDest?.id) return currentDest.id;

    const destsData = await getDestsApi();
    const candidatos = destsData.filter(
      (dest) =>
        String(dest?.name || '').trim().toLowerCase() ===
          String(destNameValue || '').trim().toLowerCase() &&
        String(dest?.destNumber || '').trim() === String(destNumberValue || '').trim()
    );

    const porIglesia = churchIdValue
      ? candidatos.filter(
          (dest) => String(dest?.churchId ?? dest?.idIglesia ?? '') === String(churchIdValue)
        )
      : [];

    const elegibles = porIglesia.length ? porIglesia : candidatos;

    return (
      elegibles.sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))[0]?.id || null
    );
  };

  const handleUploadDestPhoto = async (acceptedFiles) => {
    const file = acceptedFiles?.[0];
    const destId = currentDest?.id;

    if (!currentDest || !destId) {
      toast.error('Primero guarda el destacamento antes de subir una foto.');
      return null;
    }

    if (!canUploadDestPhoto) {
      toast.error('No tienes permiso para subir fotos de este destacamento.');
      return null;
    }

    try {
      setUploadingPhoto(true);

      // Sugerencia: la imagen se sube a una carpeta aparte y la foto oficial se
      // queda como esta. Devolver la url nueva pintaria en pantalla un cambio
      // que todavia no existe, asi que se conserva la de antes.
      if (soloSugiereFoto) {
        const propuesta = await subirFotoEntidadPropuesta({
          file,
          tipoEntidad: 'destacamento',
          idEntidad: destId,
          subidoPor: AUTH.currentUser?.uid || '',
        });

        await proponerFotoDestacamento({
          destacamento: { id: destId, nombre: currentDest?.name || currentDest?.nombre || '' },
          foto: propuesta,
          urlAntes: values.avatarUrl || currentDest?.avatarUrl || '',
          usuario: user,
        });

        toast.info('Foto enviada a la Oficina Nacional. Se aplicará cuando la aprueben.');

        return values.avatarUrl || currentDest?.avatarUrl || null;
      }

      const photo = await subirFotoEntidad({
        file,
        tipoEntidad: 'destacamento',
        idEntidad: destId,
        tipoFoto: 'perfil',
        subidoPor: AUTH.currentUser?.uid || '',
      });

      toast.success(getImageOptimizationMessage(file.__optimizationInfo));

      return photo.urlFoto;
    } catch (error) {
      console.error('[dest form] photo upload failed', error);
      toast.error(error.message || 'No se pudo subir la foto.');
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (currentDest && !canSaveDest) {
        toast.error('No tienes permiso para editar este destacamento.');
        return;
      }

      // Espera de cortesia, en paralelo con el guardado. Arranca DESPUES de las
      // validaciones para que un error salga al instante. Ver `ui-delays`.
      const espera = esperar(RETARDO_GUARDADO_MS);

      const destPayloadData = {
        ...data,
        idDestacamento: currentDest?.id,
        idIglesia: Number(data.churchId) || 0,
        correo: data.correo ?? '',
        telefono: data.telefono ?? '',
        destMeetingDays: data.destMeetingDays ?? '',
        destMeetingTimes: data.destMeetingTimes ?? '',
        destNumber: data.destNumber ?? '',
        direccion: data.direccion ?? data.address ?? '',
        concilio: data.concilio ?? '',
        fechaInicio: data.fechaInicio || new Date().toISOString(),
      };

      let churchUpdateFailed = false;
      // Lo que devuelve la puerta de cambios: si el cambio quedo pendiente de la
      // Oficina Nacional, el mensaje final no puede ser el de guardado.
      let resultadoDest = null;

      if (currentDest) {
        // LA IGLESIA SOLO SE ESCRIBE SI CAMBIO ALGO SUYO.
        //
        // Antes se llamaba a `UpdateIglesia` en CADA guardado del destacamento,
        // aunque no se hubiera tocado un solo dato de la iglesia: una escritura
        // inutil que, con el endpoint caido, sacaba el aviso de fallo sin que
        // hubiera nada que actualizar.
        //
        // El correo y el telefono se toman del REGISTRO DE LA IGLESIA y no del
        // formulario: esos dos campos se ven bajo el titulo "Iglesia" pero
        // pertenecen al destacamento (de ahi se cargan y ahi se guardan), asi que
        // enviarlos aqui pisaba los de la iglesia con datos ajenos.
        const iglesiaActual = churches.find(
          (church) => String(church.id) === String(data.churchId)
        );
        const datosIglesia = {
          ...data,
          id: data.churchId,
          churchId: data.churchId,
          sectionId: data.sectionId,
          correo: iglesiaActual?.correo ?? '',
          telefono: iglesiaActual?.telefono ?? '',
        };

        if (hayCambiosDeIglesia(datosIglesia, iglesiaActual)) {
          try {
            await updateChurchApi(datosIglesia);
          } catch (churchUpdateError) {
            // El backend de Iglesias puede fallar (p. ej. 500 de Somee). No creamos
            // una iglesia de reemplazo —generaría duplicados—: avisamos y seguimos
            // guardando el resto del destacamento, conservando la iglesia actual.
            churchUpdateFailed = true;
            console.warn('[dest form] no se pudo actualizar la iglesia:', churchUpdateError);
          }
        }
        resultadoDest = await updateDestApi(destPayloadData, { usuario: user, antes: currentDest });
      } else {
        await createDestApi(destPayloadData, { usuario: user });
      }

      const resolvedDestId = await resolveDestId(data.name, data.destNumber, data.churchId);

      // Persistir el coordinador de destacamento en la base de datos (Firestore),
      // en la coleccion de directiva del destacamento. El form guarda el codigo
      // de miembro (`memberId`); Firestore requiere el `idMiembros` numerico.
      const destIdForCoordinator = Number(resolvedDestId || currentDest?.id) || null;

      // EL PASTOR ES UNA PERSONA. Del formulario solo se conoce su nombre, asi
      // que se le da de alta como miembro (o se reutiliza el que ya este en este
      // destacamento con ese nombre) y se le asigna la casilla "Pastor" del
      // organigrama. El resto de su ficha queda por completar, y de eso avisa el
      // propio organigrama con un icono.
      //
      // Va aparte del guardado del destacamento: si falla, el destacamento ya
      // quedo guardado y no tiene sentido perderlo por esto.
      if (destIdForCoordinator && data.pastor) {
        try {
          await asegurarPastorDelDestacamento({
            nombrePastor: data.pastor,
            idDestacamento: destIdForCoordinator,
            nombreDestacamento: data.name || '',
            usuario: user,
          });
        } catch (pastorError) {
          console.warn('[dest form] no se pudo registrar al pastor', pastorError);
          toast.warning(
            'El destacamento se guardó, pero no se pudo registrar al pastor en la Directiva.'
          );
        }
      }

      if (destIdForCoordinator) {
        try {
          const asignacionesActuales = await obtenerAsignacionesDirectiva({
            nivel: 'destacamento',
            idEntidad: destIdForCoordinator,
          });
          const coordinadorActual = asignacionesActuales.find(
            (asignacion) =>
              asignacion.idPosicionDirectiva === POSICION_COORDINADOR_DEST?.idCargo
          );
          const miembroSeleccionado = data.coordinatorId
            ? allMembers.find((member) => member.memberId === data.coordinatorId)
            : null;

          // El coordinador se guarda en `asignacionesDirectiva`, que es de donde
          // lo leen el organigrama del destacamento, la ficha del miembro y la
          // lista. Escribir solo en la coleccion del organigrama dejaba al
          // coordinador invisible para las otras dos pantallas.
          const datosAsignacion = {
            nivel: 'destacamento',
            idEntidad: destIdForCoordinator,
            nombreEntidad: data.name || '',
            idCargo: Number(POSICION_COORDINADOR_DEST?.idCargoApi) || null,
            idPosicionDirectiva: POSICION_COORDINADOR_DEST?.idCargo || '',
            division: null,
            orden: POSICION_COORDINADOR_DEST?.orden || 1,
            origen: 'form-destacamento',
          };

          if (miembroSeleccionado?.id) {
            await guardarAsignacionDirectiva({
              ...datosAsignacion,
              idMiembro: Number(miembroSeleccionado.id),
              activo: true,
              ...construirResumenMiembro(miembroSeleccionado),
            });
            setCoordinatorFromDb(miembroSeleccionado.memberId);
          } else if (coordinadorActual?.idMiembro) {
            // Se limpio el coordinador: dar de baja la asignacion existente.
            await guardarAsignacionDirectiva({
              ...datosAsignacion,
              idMiembro: coordinadorActual.idMiembro,
              activo: false,
            });
            setCoordinatorFromDb(null);
          }
        } catch (coordError) {
          console.warn('[dest form] no se pudo guardar el coordinador del destacamento', coordError);
          toast.warning('El destacamento se guardó, pero no se pudo guardar el coordinador.');
        }
      }

      if (resolvedDestId) {
        saveDest({
          ...(currentDest || {}),
          ...destPayloadData,
          id: String(resolvedDestId),
          coordinatorId: data.coordinatorId ?? null,
          churchId: data.churchId ? String(data.churchId) : null,
          sectionId: data.sectionId ? String(data.sectionId) : '',
          idSeccion: data.sectionId ? String(data.sectionId) : '',
          avatarUrl: data.avatarUrl ?? currentDest?.avatarUrl ?? null,
        });
      }

      await espera;

      if (churchUpdateFailed) {
        toast.warning(
          'Destacamento guardado, pero no se pudo actualizar la información de la iglesia. Intenta de nuevo más tarde.'
        );
      } else if (resultadoDest?.pendienteDeAprobacion) {
        // No se guardo nada todavia: el cambio espera a la Oficina Nacional.
        // Decirlo tal cual, porque un "Actualizacion exitosa" aqui seria mentira.
        toast.info('Cambios enviados a la Oficina Nacional. Se aplicarán cuando los apruebe.');
      } else {
        toast.success(
          currentDest ? 'Actualización exitosa!' : 'Destacamento creado'
        );
      }

      if (currentDest) {
        router.refresh();
        return;
      }

      reset();
      router.push(paths.dashboard.level.dest.root);
      router.refresh();
    } catch (error) {
      console.error(error);
      // El bloqueo por alcance ("solo puedes crear en tu sección o región") llega
      // como Error con mensaje propio: se muestra tal cual en vez del genérico.
      toast.error(error?.message || 'Error creando destacamento');
    }
  });

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3} sx={disabledReadableFieldSx}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ pt: 10, pb: 5, px: 3 }}>
            {/* {currentDest && (
              <Label
                color={
                  (values.status === 'active' && 'success') ||
                  (values.status === 'banned' && 'error') ||
                  'warning'
                }
                sx={{ position: 'absolute', top: 24, right: 24 }}
              >
                {values.status}
              </Label>
            )} */}

            <Box sx={{ mb: 5 }}>
              <Field.UploadAvatar
                name="avatarUrl"
                loading={uploadingPhoto}
                disabled={uploadingPhoto || !canUploadDestPhoto}
                onDrop={handleUploadDestPhoto}
                optimizationToast={false}
                helperText={
                  <Typography
                    variant="caption"
                    sx={{
                      mt: 3,
                      mx: 'auto',
                      display: 'block',
                      textAlign: 'center',
                      color: 'text.disabled',
                    }}
                  >
                    {/* A quien solo puede sugerirla, decirle los formatos no le
                        aclara lo que de verdad necesita saber: que la foto no
                        cambia hasta que la aprueben. */}
                    {soloSugiereFoto ? (
                      'La foto que subas se enviará a la Oficina Nacional para su aprobación. La actual se mantiene hasta que la aprueben.'
                    ) : (
                      <>
                        Permitido *.jpeg, *.jpg, *.png, *.gif
                        <br /> la imagen se optimiza al cargar.
                      </>
                    )}
                  </Typography>
                }
              />

              {/* BADGE REGISTRADO en oficina*/}
              <Box
                sx={{
                  position: 'absolute',
                  top: 24,
                  right: 24,
                  display: 'flex',
                  gap: 1,
                }}
              >
                <StatusLabel
                  value={watch('registradoOfnc')}
                  activeText="Registrado"
                  inactiveText="sin registro oficial"
                  sx={{ position: 'static' }} // IMPORTANTE para dejar horizontalmente
                />

                <StatusLabel
                  value={watch('rritrackActivo')}
                  activeText="RRITrack activo"
                  inactiveText="RRITrack inactivo"
                  warningText="RRITrack vencido"
                  sx={{ position: 'static' }}
                />
              </Box>

            </Box>

            <Stack spacing={1} sx={{ mb: 3 }}>
              <FormControlLabel
                labelPlacement="start"
                control={
                  <Switch
                    checked={watch('registradoOfnc') ?? true}
                    disabled={!canEditDest}
                    onChange={(event) =>
                      canEditDest &&
                      methods.setValue('registradoOfnc', event.target.checked, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  />
                }
                label={
                  <>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      Registrado en Oficina Nacional
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Registrado oficialmente con número de Destacamento
                    </Typography>
                  </>
                }
                sx={{
                  mx: 0,
                  mb: 2,
                  width: 1,
                  justifyContent: 'space-between',
                }}
              />

              <FormControlLabel
                labelPlacement="start"
                control={
                  <Switch
                    checked={watch('rritrackActivo') ?? false}
                    disabled={!canEditDest}
                    onChange={(event) =>
                      canEditDest &&
                      methods.setValue('rritrackActivo', event.target.checked, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  />
                }
                label={
                  <>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      RRITrack activo
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Destacamento cuenta con licencia anual de RRITrack
                    </Typography>
                  </>
                }
                sx={{
                  mx: 0,
                  mb: 2,
                  width: 1,
                  justifyContent: 'space-between',
                }}
              />
            </Stack>

            <ContextInfo
              items={[
                {
                  show: !currentDest && !!destName,
                  text: `Destacamento ${destName ?? ''} ${destNumber ?? ''}`.trim(),
                  variant: 'subtitle1',
                  bold: true,
                  mt: 1,
                  color: 'text.primary',
                },
                {
                  show: !currentDest && !!sectional?.sectionalName,
                  text: `Pertenecerá a la Sección ${sectional?.sectionalName}`,
                },
                {
                  show: !currentDest && !!regional?.name,
                  text: `${regional?.name}`,
                },
              ]}
            />

            {/* {currentDest && (
              <FormControlLabel
                labelPlacement="start"
                control={
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        {...field}
                        checked={field.value !== 'active'}
                        onChange={(event) =>
                          field.onChange(event.target.checked ? 'banned' : 'active')
                        }
                      />
                    )}
                  />
                }
                label={
                  <>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      Banned
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Apply disable account
                    </Typography>
                  </>
                }
                sx={{
                  mx: 0,
                  mb: 3,
                  width: 1,
                  justifyContent: 'space-between',
                }}
              />
            )} */}


            {currentDest && (
              // `stretch` con un ancho comun: los dos botones miden lo mismo sin
              // fijarle un tamaño a ninguno, que se romperia con textos mas largos.
              <Stack
                spacing={1.5}
                sx={{ mt: 3, width: 1, maxWidth: 260, mx: 'auto', alignItems: 'stretch' }}
              >
                {/* Atajo para dar de alta a alguien en ESTE destacamento: lleva
                    a la pantalla de creacion de siempre, pero con el
                    destacamento —y con el, su seccion y su region— ya puesto. */}
                {canCreateMembers && (
                  <Button
                    component={RouterLink}
                    href={`${paths.dashboard.level.member.new}?destId=${currentDest?.id || currentDest?.idDestacamento || ''}`}
                    variant="outlined"
                    color="inherit"
                    startIcon={<Iconify icon="mingcute:add-line" />}
                  >
                    Agregar nuevo miembro
                  </Button>
                )}

                <EntityInfoPdfMenu
                  title={`${values.name || currentDest?.name || 'Destacamento'} ${values.destNumber || ''}`.trim()}
                  subtitle={`Destacamento ${currentDest?.id || currentDest?.idDestacamento || ''}`}
                  avatarUrl={values.avatarUrl}
                  fileName={`destacamento-${currentDest?.id || currentDest?.idDestacamento || 'info'}.pdf`}
                  sections={[
                    {
                      value: 'general',
                      label: 'General',
                      required: true,
                      rows: [
                        { label: 'Nombre', value: values.name },
                        { label: 'Número', value: values.destNumber },
                        { label: 'ID', value: currentDest?.id || currentDest?.idDestacamento },
                        { label: 'Sección', value: values.sectionName || values.sectionId },
                        { label: 'Iglesia', value: values.churchName || values.churchId },
                        { label: 'Miembros', value: values.memberCount },
                      ],
                    },
                    {
                      value: 'iglesia',
                      label: 'Iglesia',
                      rows: [{ label: 'Iglesia', value: values.churchName || values.churchId }],
                    },
                    ...(canDownloadMembersInfo
                      ? [
                        {
                          value: 'miembros',
                          label: 'Miembros',
                          rows: [{ label: 'Cantidad', value: values.memberCount }],
                        },
                      ]
                      : []),
                  ]}
                />
              </Stack>
            )}

          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ p: 3 }}>
            <Box
              sx={{
                rowGap: 3,
                columnGap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
              }}
            >
              {isCreateView ? (
                <>
                  {step === 1 && (
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <ChurchDestSection
                        isCreateView
                        disabled={!canEditDest}
                        lockedSectional={ownSectionalForCreation}
                        allowedRegionIds={ownRegionIdsForCreation}
                      />
                    </Box>
                  )}

                  {step === 2 && (
                    <DestGeneralSection
                      isCreateView
                      members={allMembers}
                      churches={churches}
                      methods={methods}
                      watch={watch}
                      disabled={!canEditDest}
                      scheduleDisabled={!canSaveDest}
                      coordinatorDisabled={!canSaveDest}
                    />
                  )}
                </>
              ) : (
                <>
                  <DestGeneralSection
                    members={allMembers}
                    churches={churches}
                    methods={methods}
                    watch={watch}
                    disabled={!canEditDest}
                    scheduleDisabled={!canSaveDest}
                    coordinatorDisabled={!canSaveDest}
                  />

                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <DashedAccordion title="Información de la iglesia">
                      <ChurchDestSection
                        disabled={!canEditDest}
                        contactDisabled={!canSaveDest}
                      />
                    </DashedAccordion>
                  </Box>
                </>
              )}
            </Box>

            <Stack direction="row" spacing={2} sx={{ mt: 3, justifyContent: 'flex-end' }}>
              {isCreateView ? (
                <>
                  {step > 1 && (
                    <Button variant="outlined" onClick={() => setStep(step - 1)}>
                      Atrás
                    </Button>
                  )}

                  {step === 1 && (
                    <LoadingButton
                      variant="contained"
                      loading={isSubmitting}
                      onClick={handleSubmit(async (data) => {
                        try {

                          // La MISMA iglesia en la MISMA seccion se reutiliza en
                          // vez de crear otra: repetir el alta dejaba duplicados
                          // indistinguibles (hay varios "Aposento Alto" en la
                          // seccion 1 de esa forma).
                          const mismaIglesia = (iglesia) =>
                            normalizeText(iglesia?.name ?? iglesia?.nombre) ===
                              normalizeText(data.churchName) &&
                            String(iglesia?.idSeccion ?? iglesia?.sectionId ?? '') ===
                              String(data.sectionId);

                          const iglesiasPrevias = await getChurches();
                          const yaExiste = (Array.isArray(iglesiasPrevias) ? iglesiasPrevias : [])
                            .find(mismaIglesia);

                          const churchRes = yaExiste
                            ? null
                            : await createChurchApi({
                                churchName: data.churchName,
                                pastor: data.pastor,
                                street: data.street,
                                provinceId: data.provinceId,
                                municipioId: data.municipioId,
                                sectorId: data.sectorId,
                                correo: methods.getValues('correo'),
                                sectionId: data.sectionId,
                              });

                          const churchesData = await getChurches();
                          setChurches(Array.isArray(churchesData) ? churchesData : []);

                          // El id se busca en `data` ADEMAS de en `Data`: la API lo
                          // devuelve en minuscula y solo se miraba la mayuscula, asi
                          // que el alta funcionaba pero se abortaba justo despues con
                          // "No se pudo obtener idIglesia" — la iglesia quedaba
                          // creada y el formulario atascado en el paso 1.
                          //
                          // Y si aun asi no viene, se resuelve contra el listado
                          // recien recargado, que es donde con seguridad esta.
                          const churchId =
                            yaExiste?.id ??
                            churchRes?.data?.idIglesia ??
                            churchRes?.Data?.idIglesia ??
                            churchRes?.Data?.IdIglesia ??
                            churchRes?.idIglesia ??
                            churchRes?.IdIglesia ??
                            (Array.isArray(churchesData) ? churchesData : []).find(mismaIglesia)?.id;

                          if (!churchId) {
                            throw new Error('No se pudo obtener idIglesia');
                          }

                          // 🔥 guardar en el form
                          methods.setValue('churchId', String(churchId), {
                            shouldValidate: true,
                            shouldDirty: true,
                          });

                          // 🔥 pasar al step 2
                          setStep(2);
                        } catch (error) {
                          console.error(error);
                          toast.error('Error creando iglesia');
                        }
                      })}
                    >
                      Crear Iglesia
                    </LoadingButton>
                  )}

                  {step === 2 && (
                    <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                      Crear Destacamento
                    </LoadingButton>
                  )}
                </>
              ) : (
                <LoadingButton
                  type="submit"
                  variant="contained"
                  loading={isSubmitting}
                  disabled={!canSaveDest}
                >
                  Guardar cambios
                </LoadingButton>
              )}
            </Stack>

            {isCreateView && step === 1 && (
              <Typography
                variant="caption"
                sx={{ mt: 1.5, display: 'block', textAlign: 'right', color: 'text.secondary' }}
              >
                Primero se registra la iglesia; al completar este paso continuarás con la creación
                del destacamento.
              </Typography>
            )}
          </Card>
        </Grid>
      </Grid>
    </Form>
  );
}
