'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import {
  claveDeTexto,
  idIntegrante,
  nombreCompleto,
  claveDePersona,
  nombreDelCargo,
  cargosDelNivel,
  posicionDelCargo,
  GRUPOS_CUATRIENIO,
  NIVELES_CUATRIENIO,
} from 'src/utils/directiva-cuatrienios.mjs';

import { getMembers } from 'src/services/member-service';
import { getRegionals } from 'src/services/regional-service';
import { getSectionals } from 'src/services/sectional-service';
import {
  quitarIntegrante,
  guardarIntegrantes,
  congelarFotoDePerfil,
  subirFotoDeIntegrante,
} from 'src/services/directiva-cuatrienios-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// Agregar o corregir a alguien en la Directiva de un cuatrienio.
//
// La persona se elige del padron (queda enlazada y su foto de perfil se puede
// COPIAR) o se escribe a mano si ya no esta. La foto nunca se enlaza: se copia o
// se sube, para que no cambie cuando cambie la de perfil.
// ----------------------------------------------------------------------

const NIVELES = [
  { value: NIVELES_CUATRIENIO.nacional, label: 'Directiva Nacional' },
  { value: NIVELES_CUATRIENIO.regional, label: 'Directiva Regional' },
  { value: NIVELES_CUATRIENIO.seccional, label: 'Directiva Seccional' },
];

// En la nacional, oficiales y ex comandantes son grupos, no casillas.
const CARGOS_DE_GRUPO = [
  { id: 'oficial', grupo: GRUPOS_CUATRIENIO.oficiales },
  { id: 'ex_comandante', grupo: GRUPOS_CUATRIENIO.exComandantes },
];

const grupoDelCargo = (cargo) =>
  CARGOS_DE_GRUPO.find((item) => item.id === cargo)?.grupo || GRUPOS_CUATRIENIO.directiva;

const opcionesDeCargo = (nivel) => [
  ...cargosDelNivel(nivel).map((cargo) => cargo.id),
  ...(nivel === NIVELES_CUATRIENIO.nacional ? CARGOS_DE_GRUPO.map((item) => item.id) : []),
];

const etiquetaMiembro = (miembro) =>
  [`${miembro?.firstName ?? ''} ${miembro?.lastName ?? ''}`.trim(), miembro?.memberId]
    .filter(Boolean)
    .join(' · ');

export function IntegranteDialog({
  inicial,
  cuatrienio,
  integrantes = [],
  usuario,
  onClose,
  onGuardado,
}) {
  const esNuevo = Boolean(inicial?.nuevo);
  const [nivel, setNivel] = useState(inicial?.nivel || NIVELES_CUATRIENIO.seccional);
  const [cargo, setCargo] = useState(inicial?.cargo || 'director');
  const [regionId, setRegionId] = useState(inicial?.regionId || '');
  const [regionNombre, setRegionNombre] = useState(inicial?.regionNombre || '');
  const [seccionId, setSeccionId] = useState(inicial?.seccionId || '');
  const [seccionNombre, setSeccionNombre] = useState(inicial?.seccionNombre || '');
  const [nombres, setNombres] = useState(inicial?.nombres || '');
  const [apellidos, setApellidos] = useState(inicial?.apellidos || '');
  const [idMiembros, setIdMiembros] = useState(inicial?.idMiembros || '');
  const [codigoMiembro, setCodigoMiembro] = useState(inicial?.codigoMiembro || '');
  const [foto] = useState({
    fotoUrl: inicial?.fotoUrl || '',
    fotoRuta: inicial?.fotoRuta || '',
  });
  const [archivo, setArchivo] = useState(null);
  const [copiarPerfil, setCopiarPerfil] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [miembros, setMiembros] = useState([]);
  const [regiones, setRegiones] = useState([]);
  const [secciones, setSecciones] = useState([]);
  const [fotosPerfil, setFotosPerfil] = useState({});

  useEffect(() => {
    let cancelado = false;

    Promise.all([
      getMembers().catch(() => []),
      getRegionals({ includePhotos: false }).catch(() => []),
      getSectionals({ includePhotos: false }).catch(() => []),
      obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'miembro' }).catch(() => ({})),
    ]).then(([filasMiembros, filasRegiones, filasSecciones, fotos]) => {
      if (cancelado) return;

      setMiembros(filasMiembros);
      setRegiones(filasRegiones);
      setSecciones(filasSecciones);
      setFotosPerfil(fotos);
    });

    return () => {
      cancelado = true;
    };
  }, []);

  const miembroElegido = useMemo(
    () => miembros.find((miembro) => String(miembro.id) === String(idMiembros)) || null,
    [miembros, idMiembros]
  );
  const fotoDePerfil = idMiembros ? fotosPerfil[String(idMiembros)]?.urlFoto || '' : '';
  const seccionesDeLaRegion = secciones.filter(
    (seccion) => !regionId || String(seccion.regionalId) === String(regionId)
  );
  const grupo = grupoDelCargo(cargo);
  const vistaPrevia = archivo
    ? URL.createObjectURL(archivo)
    : copiarPerfil
      ? fotoDePerfil
      : foto.fotoUrl;

  // Una persona, un cargo por cuatrienio. Ex comandante no cuenta: es una
  // condicion, no una posicion.
  const otraPosicion = useMemo(() => {
    if (grupo === GRUPOS_CUATRIENIO.exComandantes) return null;

    const clave = claveDePersona(nombres, apellidos);

    return (
      integrantes.find(
        (fila) =>
          fila.id !== inicial?.id &&
          fila.grupo !== GRUPOS_CUATRIENIO.exComandantes &&
          ((idMiembros && String(fila.idMiembros) === String(idMiembros)) ||
            (clave && claveDePersona(fila.nombres, fila.apellidos) === clave))
      ) || null
    );
  }, [grupo, nombres, apellidos, idMiembros, integrantes, inicial?.id]);

  const elegirMiembro = (miembro) => {
    setIdMiembros(miembro ? String(miembro.id) : '');
    setCodigoMiembro(miembro?.memberId || '');
    setCopiarPerfil(false);

    if (miembro) {
      setNombres(miembro.firstName || '');
      setApellidos(miembro.lastName || '');
    }
  };

  const guardar = async () => {
    const entidad = nivel === NIVELES_CUATRIENIO.seccional ? seccionNombre : regionNombre;

    if (!String(nombres).trim()) {
      toast.error('Escribe el nombre de la persona.');
      return;
    }

    if (nivel !== NIVELES_CUATRIENIO.nacional && !regionNombre) {
      toast.error('Elige la región.');
      return;
    }

    if (nivel === NIVELES_CUATRIENIO.seccional && !seccionNombre) {
      toast.error('Elige la sección.');
      return;
    }

    if (otraPosicion) {
      toast.error(
        `${nombreCompleto(otraPosicion)} ya es ${otraPosicion.cargoNombre} en este cuatrienio.`
      );
      return;
    }

    setGuardando(true);

    try {
      const id = idIntegrante({
        cuatrienio,
        nivel,
        entidad: nivel === NIVELES_CUATRIENIO.nacional ? '' : entidad,
        grupo,
        cargo,
        persona: claveDePersona(nombres, apellidos),
      });
      // Si cambio la casilla (otro cargo, otra seccion), la fila vieja sale: la
      // historia no puede tener a la misma persona en dos sitios por un cambio.
      const anterior = !esNuevo && inicial?.id && inicial.id !== id ? inicial : null;
      const ocupante = integrantes.find((fila) => fila.id === id) || null;
      let nuevaFoto = foto;

      if (archivo) {
        nuevaFoto = await subirFotoDeIntegrante({ file: archivo, cuatrienio, idIntegrante: id });
      } else if (copiarPerfil && fotoDePerfil) {
        nuevaFoto = await congelarFotoDePerfil({
          urlOrigen: fotoDePerfil,
          cuatrienio,
          idIntegrante: id,
        });
      }

      await guardarIntegrantes({
        cuatrienio,
        usuario,
        anteriores: [ocupante, !esNuevo ? inicial : null].filter(Boolean),
        integrantes: [
          {
            ...(esNuevo ? {} : inicial),
            id,
            nivel,
            grupo,
            cargo,
            cargoNombre: nombreDelCargo(nivel, cargo),
            idPosicionDirectiva: posicionDelCargo(nivel, cargo),
            orden: undefined,
            regionId: nivel === NIVELES_CUATRIENIO.nacional ? '' : regionId,
            regionNombre: nivel === NIVELES_CUATRIENIO.nacional ? '' : regionNombre,
            seccionId: nivel === NIVELES_CUATRIENIO.seccional ? seccionId : '',
            seccionNombre: nivel === NIVELES_CUATRIENIO.seccional ? seccionNombre : '',
            idMiembros,
            codigoMiembro,
            nombres,
            apellidos,
            ...nuevaFoto,
          },
        ],
      });

      if (anterior) await quitarIntegrante({ integrante: anterior, usuario });

      toast.success('Guardado en la directiva del cuatrienio.');
      onGuardado();
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={guardando ? undefined : onClose}>
      <DialogTitle>
        {esNuevo ? 'Agregar a la directiva' : 'Corregir integrante'} · {cuatrienio}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            select
            label="Directiva"
            value={nivel}
            disabled={!esNuevo}
            onChange={(event) => {
              setNivel(event.target.value);
              setCargo('director');
            }}
          >
            {NIVELES.map((opcion) => (
              <MenuItem key={opcion.value} value={opcion.value}>
                {opcion.label}
              </MenuItem>
            ))}
          </TextField>

          {nivel !== NIVELES_CUATRIENIO.nacional && (
            <TextField
              select
              label="Región"
              value={regionId || (regionNombre ? `nombre:${regionNombre}` : '')}
              onChange={(event) => {
                const region = regiones.find((fila) => String(fila.id) === event.target.value);

                setRegionId(region ? String(region.id) : '');
                setRegionNombre(region?.name || region?.regionalName || '');
                setSeccionId('');
                setSeccionNombre('');
              }}
            >
              {regionNombre && !regionId && (
                <MenuItem value={`nombre:${regionNombre}`}>{regionNombre}</MenuItem>
              )}
              {regiones.map((region) => (
                <MenuItem key={region.id} value={String(region.id)}>
                  {region.name || region.regionalName}
                </MenuItem>
              ))}
            </TextField>
          )}

          {nivel === NIVELES_CUATRIENIO.seccional && (
            <TextField
              select
              label="Sección"
              value={seccionId || (seccionNombre ? `nombre:${seccionNombre}` : '')}
              onChange={(event) => {
                const seccion = secciones.find((fila) => String(fila.id) === event.target.value);

                setSeccionId(seccion ? String(seccion.id) : '');
                setSeccionNombre(seccion?.sectionalName || '');
              }}
            >
              {seccionNombre && !seccionId && (
                <MenuItem value={`nombre:${seccionNombre}`}>{seccionNombre}</MenuItem>
              )}
              {seccionesDeLaRegion.map((seccion) => (
                <MenuItem key={seccion.id} value={String(seccion.id)}>
                  {seccion.sectionalName}
                </MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            select
            label="Cargo"
            value={cargo}
            onChange={(event) => setCargo(event.target.value)}
          >
            {opcionesDeCargo(nivel).map((opcion) => (
              <MenuItem key={opcion} value={opcion}>
                {nombreDelCargo(nivel, opcion)}
              </MenuItem>
            ))}
          </TextField>

          <Autocomplete
            options={miembros}
            value={miembroElegido}
            onChange={(event, miembro) => elegirMiembro(miembro)}
            getOptionLabel={etiquetaMiembro}
            isOptionEqualToValue={(opcion, valor) => String(opcion.id) === String(valor.id)}
            filterOptions={(opciones, { inputValue }) => {
              const buscada = claveDeTexto(inputValue);

              return opciones
                .filter((opcion) => claveDeTexto(etiquetaMiembro(opcion)).includes(buscada))
                .slice(0, 50);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Persona del padrón"
                helperText="Si ya no está en el padrón, deja esto vacío y escribe el nombre abajo."
              />
            )}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Nombres"
              value={nombres}
              onChange={(event) => setNombres(event.target.value)}
            />
            <TextField
              fullWidth
              label="Apellidos"
              value={apellidos}
              onChange={(event) => setApellidos(event.target.value)}
            />
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar src={vistaPrevia || ''} sx={{ width: 64, height: 64 }}>
              {String(nombres || '?').charAt(0)}
            </Avatar>

            <Stack spacing={1}>
              <Button
                component="label"
                size="small"
                variant="outlined"
                startIcon={<Iconify icon="solar:gallery-add-bold" />}
              >
                Subir foto
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    setArchivo(event.target.files?.[0] || null);
                    setCopiarPerfil(false);
                  }}
                />
              </Button>

              {fotoDePerfil && (
                <Button
                  size="small"
                  startIcon={<Iconify icon="solar:user-id-bold" />}
                  onClick={() => {
                    setCopiarPerfil(true);
                    setArchivo(null);
                  }}
                >
                  Usar su foto de perfil de hoy
                </Button>
              )}
            </Stack>
          </Stack>

          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            La foto se guarda como copia: aunque la persona cambie la de su perfil, en esta
            directiva queda la de ahora.
          </Typography>

          {otraPosicion && (
            <Alert severity="warning">
              {nombreCompleto(otraPosicion)} ya es {otraPosicion.cargoNombre} en este cuatrienio.
              Una persona ocupa un solo cargo por cuatrienio.
            </Alert>
          )}

          {grupo === GRUPOS_CUATRIENIO.exComandantes && (
            <Alert severity="info">
              Un ex comandante nacional sigue siempre en el Consejo Ejecutivo y conserva los
              permisos de Director Nacional.
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Box sx={{ flex: 1 }} />
        <Button color="inherit" onClick={onClose} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" color="primary" onClick={guardar} loading={guardando}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
