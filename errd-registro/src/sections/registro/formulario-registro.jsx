"use client";

import dayjs from "dayjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState, useEffect, useCallback } from "react";
import {
  useForm,
  useWatch,
  useController,
  useFormContext,
} from "react-hook-form";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Autocomplete from "@mui/material/Autocomplete";
import ToggleButton from "@mui/material/ToggleButton";
import ListSubheader from "@mui/material/ListSubheader";
import useMediaQuery from "@mui/material/useMediaQuery";
import LinearProgress from "@mui/material/LinearProgress";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

import {
  destacamentoQueQueda,
  destacamentosSinDuplicados,
} from "src/utils/destacamentos-sin-duplicados.mjs";

import { toast } from "src/components/snackbar";
import { Iconify } from "src/components/iconify";
import { Form, Field } from "src/components/hook-form";

import { FotoMovil } from "./foto-movil";
import { MapaDestacamentos } from "./portada";
import { BuscarPersona } from "./buscar-persona";
import { BotonNoAparece } from "./boton-no-aparece";
import { DatosMiembro, etiquetaCargo } from "./datos-miembro";
import { PasosLaterales, PanelPorQueRegistrar } from "./paneles";
import { fechaDeCierre, useCuentaRegresiva } from "./use-cuenta-regresiva";
import { PASOS, Esquema, CAMPOS_DEL_PASO, valoresIniciales } from "./esquema";
import { useBorradorDelRegistro, borrarBorradorDelRegistro } from "./borrador-local";
import {
  DIAS,
  PROVINCIAS,
  sectoresDe,
  mismoNombre,
  municipiosDe,
} from "./catalogo";

// ----------------------------------------------------------------------
// EL FORMULARIO DE REGISTRO / ACTUALIZACIÓN.
//
// 1. Quién lo llena (para saber quién corrige cada destacamento).
// 2. Su destacamento: al elegirlo se carga lo que ya está registrado.
// 3-6. Completa o corrige.  7. Revisa y envía.
// Lo enviado queda "pendiente" en Firebase; la app no cambia hasta que se revise.
// ----------------------------------------------------------------------

// "Destacamento 118" o, si tiene nombre, "Destacamento 18 · Tribu de Judá".
const nombreDeDestacamento = (d) => {
  const nombre = d.nombre && !/^desconocid/i.test(d.nombre) ? d.nombre : "";
  const base = d.numero
    ? `Destacamento ${d.numero}`
    : "Destacamento sin número";
  return nombre ? `${base} · ${nombre}` : base;
};

const horaATexto = (valor) =>
  valor && dayjs(valor).isValid() ? dayjs(valor).format("HH:mm") : "";
const textoAHora = (texto) => {
  const [h, m] = String(texto || "").split(":");
  return h && m ? dayjs().hour(Number(h)).minute(Number(m)).second(0) : null;
};

export function FormularioRegistro({
  destacamentos,
  secciones,
  cargando,
  errorCarga,
  enviados = [],
  onEnviado,
}) {
  const [paso, setPaso] = useState(0);
  const [enviado, setEnviado] = useState(null);
  const [enviando, setEnviando] = useState(false);
  // Plazo cerrado desde el dashboard: no se envía (el servidor también lo rechaza).
  const { config: cuenta, desfase } = useCuentaRegresiva();
  const [ahora, setAhora] = useState(null);
  useEffect(() => {
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const plazoCerrado =
    ahora !== null && cuenta.cerrarAlTerminar && Date.parse(cuenta.cierre) <= ahora + desfase;

  const methods = useForm({
    mode: "onTouched",
    resolver: zodResolver(Esquema),
    defaultValues: valoresIniciales,
  });
  const { handleSubmit, trigger, reset, getValues } = methods;
  const { restaurado, empezarDeNuevo } = useBorradorDelRegistro({
    methods,
    iniciales: valoresIniciales,
    paso,
    setPaso,
  });

  const siguiente = async () => {
    const valido = await trigger(CAMPOS_DEL_PASO[PASOS[paso].id]);
    if (!valido) {
      toast.error("Revisa los campos marcados en rojo.");
      return;
    }
    setPaso((p) => Math.min(p + 1, PASOS.length - 1));
    document
      .getElementById("registrar")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const anterior = () => setPaso((p) => Math.max(p - 1, 0));

  const onSubmit = handleSubmit(
    async (v) => {
      setEnviando(true);
      try {
        const persona = (p) =>
          p.modo === "existente"
            ? { idMiembro: p.miembro.id, ...partirNombre(p.miembro.nombre) }
            : { idMiembro: null, nombres: p.nombres, apellidos: p.apellidos };
        const envio = {
          trampa: v.trampa || "",
          remitente: {
            ...persona(v.remitente),
            // Con nombre y apellidos separados en su ficha, esos (partir el
            // nombre completo equivocaba los compuestos).
            ...(v.remitente.modo === "existente" && v.miembro.nombres
              ? { nombres: v.miembro.nombres, apellidos: v.miembro.apellidos }
              : {}),
            telefono: v.remitente.telefono,
            posicion: etiquetaCargo(v.miembro.posicionDestacamento) || "Ninguna",
          },
          destacamento: {
            id:
              v.destacamento.modo === "existente"
                ? v.destacamento.elegido?.id
                : null,
            idSeccion:
              // Si corrigió la sección del destacamento (selector de Sección),
              // viaja esa; si no, la del padrón.
              v.destacamento.modo === "existente"
                ? (v.destacamento.idSeccion ?? v.destacamento.elegido?.idSeccion)
                : v.destacamento.idSeccion,
          },
          datos: {
            ...v.datos,
            cantidadMiembros:
              v.datos.cantidadMiembros === ""
                ? null
                : Number(v.datos.cantidadMiembros),
            coordinador: {
              ...persona(v.datos.coordinador),
              telefono: v.datos.coordinador.telefono || "",
            },
            horaReunion: horaATexto(v.datos.horaReunion),
            horaReunionFin: horaATexto(v.datos.horaReunionFin),
          },
        };
        const m = v.miembro;
        envio.miembro = {
          nombres: v.remitente.modo === "existente" ? m.nombres : v.remitente.nombres,
          apellidos: v.remitente.modo === "existente" ? m.apellidos : v.remitente.apellidos,
          posicionDestacamento: m.posicionDestacamento,
        };
        const form = new FormData();
        form.append("envio", JSON.stringify(envio));
        if (v.logo instanceof File) form.append("logo", v.logo);
        // Con la barra final: sin ella el servidor responde con una redirección
        // y el navegador volvía a subir el envío entero (logo incluido).
        // La landing no tiene sesión ni Historial: su envío queda "pendiente" y
        // lo aplica el dashboard, que sí pasa por proponerCambio().
        // eslint-disable-next-line no-restricted-syntax
        const res = await fetch("/api/envios/", { method: "POST", body: form });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "No se pudo enviar.");
        setEnviado({ nombre: v.datos.nombre, numero: v.datos.numero });
        // Ya está en el servidor: el borrador de este dispositivo sobra.
        borrarBorradorDelRegistro();
        // El mapa suma al que acaba de enviar sin recargar la página.
        onEnviado?.();
      } catch (error) {
        toast.error(error.message || "No se pudo enviar. Inténtalo de nuevo.");
      } finally {
        setEnviando(false);
      }
    },
    () => toast.error("Faltan datos. Revisa los pasos anteriores."),
  );

  const otroDestacamento = () => {
    // La misma persona registra otro: se conservan sus datos y se vuelve al
    // paso 1, donde ahora se elige el destacamento.
    const remitente = getValues("remitente");
    const miembro = getValues("miembro");
    reset({ ...valoresIniciales, remitente, miembro });
    setEnviado(null);
    setPaso(0);
  };

  return (
    <Box
      id="registrar"
      sx={{
        gap: 3,
        display: "grid",
        alignItems: "start",
        gridTemplateColumns: { xs: "1fr", lg: "260px minmax(0, 1fr) 280px" },
      }}
    >
      <PasosLaterales paso={enviado ? PASOS.length : paso} />

      <Card sx={{ p: { xs: 2.5, md: 4 }, minWidth: 0 }}>
        {enviado ? (
          <Enviado
            enviado={enviado}
            onOtro={otroDestacamento}
            destacamentos={enviados}
            padron={destacamentos}
            secciones={secciones}
          />
        ) : (
          <Form
            methods={methods}
            onSubmit={(e) => e?.preventDefault?.()}
            protegerSalida={false}
          >
            {/* El formulario nunca se envía solo: ni con Enter ni al cambiar "Siguiente"
              por "Enviar" en el mismo clic (React reusaba el botón y, al volverse
              type="submit", el clic del último paso lo enviaba sin confirmar). */}
            {/* Campo trampa: invisible para personas, lo rellenan los bots. */}
            <Box
              component="input"
              {...methods.register("trampa")}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              sx={{ display: "none" }}
            />

            <Cabecera paso={paso} />

            {restaurado && (
              <Alert
                severity="success"
                sx={{ mb: 3 }}
                action={
                  <Button color="inherit" size="small" onClick={empezarDeNuevo}>
                    Empezar de nuevo
                  </Button>
                }
              >
                Recuperamos lo que habías escrito en este dispositivo.
              </Alert>
            )}

            {plazoCerrado && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                El plazo de actualización terminó el {fechaDeCierre(cuenta.cierre)}. Ya no se
                reciben envíos. Si necesitas actualizar tu destacamento, escribe a
                tecnologia@errd.org.do.
              </Alert>
            )}

            {errorCarga && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                {errorCarga}
              </Alert>
            )}

            {PASOS[paso].id === "quien" && (
              <PasoQuien
                destacamentos={destacamentos}
                secciones={secciones}
                cargando={cargando}
              />
            )}
            {PASOS[paso].id === "general" && <PasoGeneral padron={destacamentos} />}
            {PASOS[paso].id === "ubicacion" && <PasoUbicacion />}
            {PASOS[paso].id === "lideres" && <PasoLideres />}
            {PASOS[paso].id === "reuniones" && <PasoReuniones />}
            {PASOS[paso].id === "confirmacion" && (
              <PasoConfirmacion secciones={secciones} />
            )}

            <Divider sx={{ my: 4, borderStyle: "dashed" }} />

            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Button
                variant="outlined"
                color="inherit"
                onClick={anterior}
                disabled={paso === 0 || enviando}
                startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
              >
                Anterior
              </Button>

              {paso < PASOS.length - 1 ? (
                <Button
                  key="siguiente"
                  variant="contained"
                  onClick={siguiente}
                  endIcon={<Iconify icon="eva:arrow-forward-fill" />}
                >
                  Siguiente ({paso + 1} / {PASOS.length})
                </Button>
              ) : (
                <Button
                  key="enviar"
                  variant="contained"
                  onClick={onSubmit}
                  color="primary"
                  loading={enviando}
                  disabled={plazoCerrado}
                  startIcon={<Iconify icon="custom:send-fill" />}
                >
                  Enviar a Oficina Nacional
                </Button>
              )}
            </Stack>
          </Form>
        )}
      </Card>

      <PanelPorQueRegistrar />
    </Box>
  );
}

const partirNombre = (nombre = "") => {
  const t = nombre.trim().split(/\s+/);
  return t.length <= 2
    ? { nombres: t[0] || "", apellidos: t[1] || "" }
    : {
        nombres: t.slice(0, t.length - 2).join(" "),
        apellidos: t.slice(-2).join(" "),
      };
};

// ---------------------------------------------------------------- piezas

function Cabecera({ paso }) {
  return (
    <Box sx={{ mb: 4 }}>
      <LinearProgress
        variant="determinate"
        value={((paso + 1) / PASOS.length) * 100}
        sx={{ mb: 3, height: 6, borderRadius: 1 }}
      />
      <Typography variant="h4">{PASOS[paso].titulo}</Typography>
    </Box>
  );
}

const Rejilla = ({ children }) => (
  <Box
    sx={{
      gap: 3,
      display: "grid",
      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
    }}
  >
    {children}
  </Box>
);

function SiNo({ name, label }) {
  const { control, setValue, formState } = useFormContext();
  const valor = useWatch({ control, name });
  const error = name
    .split(".")
    .reduce((o, k) => o?.[k], formState.errors)?.message;
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{label} *</Typography>
      <ToggleButtonGroup
        exclusive
        color="primary"
        value={valor}
        onChange={(_, v) =>
          v !== null && setValue(name, v, { shouldValidate: true })
        }
      >
        <ToggleButton value sx={{ px: 4 }}>
          Sí
        </ToggleButton>
        <ToggleButton value={false} sx={{ px: 4 }}>
          No
        </ToggleButton>
      </ToggleButtonGroup>
      {error && (
        <Typography variant="caption" sx={{ color: "error.main" }}>
          {error}
        </Typography>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------- paso 1

function PasoQuien({ destacamentos, secciones, cargando }) {
  return (
    <Stack spacing={3}>
  
      <BuscarPersona
        ruta="remitente"
        etiqueta="Tu nombre *"
        textoNuevo="No estoy en la lista"
      />
      {/* Teléfono, posición y destacamento van dentro de "Tus datos de miembro". */}
      <DatosMiembro
        destacamento={
          <PasoDestacamento
            destacamentos={destacamentos}
            secciones={secciones}
            cargando={cargando}
          />
        }
      />
    </Stack>
  );
}

// ---------------------------------------------------------------- destacamento (va dentro del paso 1, debajo del nombre)

function PasoDestacamento({ destacamentos: padron, secciones, cargando }) {
  // Un destacamento por número: el padrón trae algunos repetidos y se queda el
  // actualizado (el que tiene nombre).
  const destacamentos = useMemo(() => destacamentosSinDuplicados(padron), [padron]);
  const { control, setValue, trigger, formState } = useFormContext();
  const modo = useWatch({ control, name: "destacamento.modo" });
  const {
    field: { value: elegido, onChange: fijarElegido },
  } = useController({ control, name: "destacamento.elegido" });
  const idSeccion = useWatch({ control, name: "destacamento.idSeccion" });
  const errores = formState.errors.destacamento || {};
  const seccion = secciones.find((s) => String(s.id) === String(idSeccion));

  // Al elegir un destacamento se carga en el formulario lo que ya está registrado.
  const elegir = useCallback(
    (d) => {
      fijarElegido(d);
      // La sección corregida era la del destacamento anterior.
      setValue("destacamento.idSeccion", null);
      // Con el valor controlado, el error de "Elige tu destacamento" no se borraba solo.
      trigger("destacamento.elegido");
      if (!d) return;
      const sinRelleno = (v) => (v && !/^desconocid/i.test(v) ? v : "");
      setValue("datos.nombre", sinRelleno(d.nombre));
      setValue("datos.numero", d.numero || "");
      setValue("datos.iglesia", sinRelleno(d.iglesia));
      setValue("datos.direccion", {
        provincia:
          PROVINCIAS.find((p) => mismoNombre(p.nombre, d.direccion?.provincia))
            ?.nombre || "",
        municipio: d.direccion.municipio || "",
        sector: d.direccion.sector || "",
        calle: d.direccion.calle || "",
        referencia: "",
      });
      setValue("datos.pastor", { nombre: sinRelleno(d.pastor), telefono: "" });
      setValue(
        "datos.coordinador",
        d.coordinador
          ? {
              modo: "existente",
              miembro: d.coordinador,
              nombres: "",
              apellidos: "",
              telefono: "",
            }
          : {
              modo: "existente",
              miembro: null,
              nombres: "",
              apellidos: "",
              telefono: "",
            },
      );
      setValue("datos.registradoOfnc", d.registradoOfnc ?? null);
      setValue("datos.rritrackActivo", d.rritrackActivo ?? null);
      setValue(
        "datos.diaReunion",
        DIAS.includes(d.diaReunion) ? d.diaReunion : "",
      );
      setValue("datos.horaReunion", textoAHora(d.horaReunion));
      // Lo que no viene del padrón se vacía: al cambiar de destacamento, el
      // logo, la cantidad y la hora de fin del anterior se enviaban con este.
      setValue("datos.horaReunionFin", null);
      setValue("datos.cantidadMiembros", "");
      setValue("logo", null);
    },
    [setValue, fijarElegido, trigger],
  );

  // Si quien llena el formulario está en la lista, se le pone su destacamento
  // (una sola vez y solo si aún no eligió uno). Sin coincidencia, queda vacío.
  const remitente = useWatch({ control, name: "remitente.miembro" });
  useEffect(() => {
    if (elegido || modo === "nuevo" || !remitente?.idDestacamento) return;
    // Si su ficha apunta al repetido que se quitó, se le pone el que queda.
    const suyo = destacamentoQueQueda(padron, remitente.idDestacamento);
    if (suyo) elegir(suyo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remitente?.idDestacamento, destacamentos.length]);

  // Región y sección, las del padrón de la app (/api/secciones). Filtran la
  // lista y, con un destacamento elegido, enseñan las suyas.
  const [filtroRegion, setFiltroRegion] = useState(null);
  const [filtroSeccion, setFiltroSeccion] = useState(null);
  const seccionDelElegido = elegido
    ? secciones.find((s) => String(s.id) === String(idSeccion ?? elegido.idSeccion)) || null
    : null;
  const seccionElegida = seccionDelElegido || filtroSeccion;
  const regionElegida = seccionDelElegido?.region || elegido?.region || filtroRegion;
  const destacamentosFiltrados = useMemo(
    () =>
      destacamentos.filter((d) =>
        filtroSeccion
          ? String(d.idSeccion) === String(filtroSeccion.id)
          : !filtroRegion || d.region === filtroRegion,
      ),
    [destacamentos, filtroRegion, filtroSeccion],
  );

  // En el celular, "Tu destacamento" es un desplegable sin buscador: el
  // buscador abría el teclado, que tapaba media lista. Región y Sección de
  // arriba ya acortan la lista.
  const esMovil = useMediaQuery((t) => t.breakpoints.down("md"));

  const cambiarModo = (nuevo) => {
    setValue("destacamento.modo", nuevo);
    fijarElegido(null);
    setValue("destacamento.idSeccion", null);
    setValue("datos", valoresIniciales.datos);
  };

  if (modo === "nuevo") {
    return (
      <Stack spacing={3}>
        <Alert severity="info">
          Vas a registrar un destacamento que <strong>todavía no existe</strong>
          . En el siguiente paso escribirás su nombre (el número es opcional) y
          su iglesia.
        </Alert>
        <Autocomplete
          options={secciones}
          value={seccion || null}
          groupBy={(s) => s.region}
          getOptionLabel={(s) => s?.nombre || ""}
          isOptionEqualToValue={(a, b) => String(a.id) === String(b.id)}
          onChange={(_, s) =>
            setValue("destacamento.idSeccion", s?.id ?? null, {
              shouldValidate: true,
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Sección a la que pertenece *"
              error={!!errores.idSeccion}
              helperText={
                errores.idSeccion?.message || (seccion ? seccion.region : "")
              }
            />
          )}
        />
        <Box>
          <Button
            color="inherit"
            startIcon={<Iconify icon="eva:search-fill" />}
            onClick={() => cambiarModo("existente")}
          >
            Buscar mi destacamento en la lista
          </Button>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <SelectoresRegionSeccion
        secciones={secciones}
        region={regionElegida}
        seccion={seccionElegida}
        alCambiarRegion={(r) => {
          setFiltroRegion(r);
          setFiltroSeccion(null);
          // Con un destacamento de otra región, se suelta: si no, la lista
          // filtrada y el elegido se contradecían.
          if (elegido && r && elegido.region !== r) elegir(null);
          setValue("destacamento.idSeccion", null);
        }}
        alCambiarSeccion={(s) => {
          setFiltroSeccion(s);
          if (s) setFiltroRegion(s.region);
          // Con un destacamento ya elegido, cambiar la sección es corregirla:
          // se envía con el registro (queda pendiente de revisión).
          setValue(
            "destacamento.idSeccion",
            elegido && s && String(s.id) !== String(elegido.idSeccion) ? s.id : null,
          );
        }}
      />
      {esMovil ? (
        <TextField
          select
          fullWidth
          label="Tu destacamento *"
          value={elegido ? String(elegido.id) : ""}
          onChange={(e) => {
            elegir(
              destacamentos.find((d) => String(d.id) === e.target.value) ||
                null,
            );
          }}
          error={!!errores.elegido}
          helperText={
            errores.elegido?.message ||
            (cargando ? "Cargando destacamentos…" : "")
          }
          slotProps={{
            select: {
              MenuProps: {
                slotProps: { paper: { sx: { maxHeight: 360 } } },
              },
            },
          }}
        >
          {destacamentosFiltrados.flatMap((d, i) => [
            ...((d.region || "Sin región") !==
            (i ? destacamentosFiltrados[i - 1].region || "Sin región" : null)
              ? [
                  <ListSubheader key={`r-${d.region}-${i}`}>
                    {d.region || "Sin región"}
                  </ListSubheader>,
                ]
              : []),
            <MenuItem key={d.id} value={String(d.id)}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {nombreDeDestacamento(d)}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary" }}
                >
                  {d.seccion}
                </Typography>
              </Box>
            </MenuItem>,
          ])}
        </TextField>
      ) : (
      <Autocomplete
        options={destacamentosFiltrados}
        value={elegido}
        loading={cargando}
        groupBy={(d) => d.region || "Sin región"}
        getOptionLabel={(d) => (d ? nombreDeDestacamento(d) : "")}
        isOptionEqualToValue={(a, b) => String(a.id) === String(b.id)}
        filterOptions={(opciones, { inputValue }) => {
          const q = inputValue.trim().toLowerCase();
          if (!q) return opciones;
          return opciones.filter((d) =>
            `${d.numero} ${d.nombre} ${d.seccion} ${d.region} ${d.iglesia}`
              .toLowerCase()
              .includes(q),
          );
        }}
        onChange={(_, d) => elegir(d)}
        renderOption={(props, d) => {
          const { key, ...resto } = props;
          return (
            <Box
              component="li"
              key={key}
              {...resto}
              sx={{ gap: 1.5, display: "flex" }}
            >
              <Box
                component="img"
                alt=""
                src={d.foto || "/logo/emblema-erd.png"}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1,
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2">
                  {nombreDeDestacamento(d)}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {d.seccion}
                </Typography>
              </Box>
            </Box>
          );
        }}
        noOptionsText='No aparece. Pulsa "Mi destacamento no está".'
        loadingText="Cargando destacamentos…"
        renderInput={(params) => (
          <TextField
            {...params}
            label="Tu destacamento *"
            placeholder="Busca por número, nombre, sección o iglesia"
            error={!!errores.elegido}
            helperText={errores.elegido?.message}
          />
        )}
      />
      )}

      {/* Fuera del desplegable, igual que "No estoy en la lista" de Tu nombre:
          dentro de la lista quedaba escondido hasta abrirla. */}
      <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1, mt: -2 }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          ¿Tu Destacamento no aparece?
        </Typography>
        <BotonNoAparece
          icono="solar:add-circle-linear"
          onClick={() => cambiarModo("nuevo")}
        >
          Mi destacamento no está
        </BotonNoAparece>
      </Stack>

      {/* Sin ficha del destacamento aquí: sus datos se revisan en los pasos siguientes. */}
    </Stack>
  );
}

// Los dos selectores del paso: Región y, debajo de ella, sus secciones. Son
// desplegables sin buscador: las listas son cortas y el buscador abría el
// teclado del celular solo para elegir.
function SelectoresRegionSeccion({ secciones, region, seccion, alCambiarRegion, alCambiarSeccion }) {
  const regiones = useMemo(
    () => [...new Set(secciones.map((s) => s.region).filter(Boolean))],
    [secciones],
  );
  const opcionesSeccion = region ? secciones.filter((s) => s.region === region) : secciones;
  // Sin región elegida, las secciones van agrupadas bajo el nombre de la suya.
  const itemsSeccion = opcionesSeccion.flatMap((s, i) => [
    ...(!region && s.region !== opcionesSeccion[i - 1]?.region
      ? [<ListSubheader key={`r-${s.region}`}>{s.region}</ListSubheader>]
      : []),
    <MenuItem key={s.id} value={String(s.id)}>
      {s.nombre}
    </MenuItem>,
  ]);
  const menu = { MenuProps: { slotProps: { paper: { sx: { maxHeight: 320 } } } } };
  return (
    <Rejilla>
      <TextField
        select
        fullWidth
        label="Región"
        value={region || ""}
        onChange={(e) => alCambiarRegion(e.target.value || null)}
        slotProps={{ select: menu }}
      >
        <MenuItem value="">
          <em>Todas</em>
        </MenuItem>
        {regiones.map((r) => (
          <MenuItem key={r} value={r}>
            {r}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        fullWidth
        label="Sección"
        value={seccion ? String(seccion.id) : ""}
        onChange={(e) =>
          alCambiarSeccion(secciones.find((s) => String(s.id) === e.target.value) || null)
        }
        slotProps={{ select: menu }}
      >
        <MenuItem value="">
          <em>Todas</em>
        </MenuItem>
        {itemsSeccion}
      </TextField>
    </Rejilla>
  );
}

// ---------------------------------------------------------------- paso 3

function PasoGeneral({ padron = [] }) {
  const { control } = useFormContext();
  const elegido = useWatch({ control, name: "destacamento.elegido" });
  const esMovil = useMediaQuery((t) => t.breakpoints.down("md"));
  const maximoDestacamento = Math.max(
    11,
    ...(Array.isArray(padron) ? padron : [])
      .map((d) => Number.parseInt(String(d?.numero ?? ""), 10))
      .filter((n) => Number.isInteger(n) && n >= 11),
  );
  return (
    <Stack spacing={3}>
      <Rejilla>
        <Field.Text
          name="datos.nombre"
          label="Nombre del destacamento *"
          placeholder="Ej: Halcones del Este"
        />
        <Field.Text
          name="datos.numero"
          label="Número del destacamento"
          placeholder="Ej: 123"
          helperText={`Permitido: 11–${maximoDestacamento}`}
          slotProps={{
            htmlInput: {
              inputMode: "numeric",
              maxLength: 3,
              onInput: (event) => {
                const limpio = event.currentTarget.value
                  .replace(/\D/g, "")
                  .replace(/^0+(?=\d)/, "")
                  .slice(0, 3);
                if (event.currentTarget.value !== limpio) event.currentTarget.value = limpio;
              },
            },
          }}
        />
        <Field.Text
          name="datos.iglesia"
          label="Iglesia *"
          placeholder="Ej: Iglesia Asambleas de Dios Fuente de Paz"
        />
        <Field.Text
          name="datos.cantidadMiembros"
          label="Cantidad de miembros en Destacamento"
          type="number"
          placeholder="Ej: 35"
          slotProps={{ htmlInput: { min: 0, max: 2000 } }}
        />
      </Rejilla>

      <Stack spacing={1}>
        <Typography variant="subtitle2">
          Logo o foto del destacamento
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          PNG, JPG o WEBP. Se optimiza al subirla.
          {elegido?.foto
            ? " Ya hay una foto registrada: sube otra solo si quieres cambiarla."
            : ""}
        </Typography>
        <Box
          sx={{
            gap: 3,
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: elegido?.foto ? "1fr 200px" : "1fr",
            },
          }}
        >
          {/* En el celular, un botón corto para elegir la foto; en pantalla grande, la caja de arrastrar. */}
          {esMovil ? (
            <FotoMovil name="logo" />
          ) : (
            <Field.Upload name="logo" optimizationPreset="avatar" />
          )}
          {elegido?.foto && (
            <Stack spacing={1} sx={{ alignItems: "center" }}>
              <Box
                component="img"
                alt="Foto actual"
                src={elegido.foto}
                sx={{
                  width: 180,
                  height: 180,
                  borderRadius: 2,
                  objectFit: "cover",
                }}
              />
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Foto actual
              </Typography>
            </Stack>
          )}
        </Box>
      </Stack>
    </Stack>
  );
}

// ---------------------------------------------------------------- paso 4

function PasoUbicacion() {
  const { control, setValue } = useFormContext();
  const provincia = useWatch({ control, name: "datos.direccion.provincia" });
  const municipio = useWatch({ control, name: "datos.direccion.municipio" });
  const municipios = useMemo(() => municipiosDe(provincia), [provincia]);
  const [sectores, setSectores] = useState([]);

  useEffect(() => {
    let vigente = true;
    sectoresDe(municipio, provincia).then(
      (lista) => vigente && setSectores(lista),
    );
    return () => {
      vigente = false;
    };
  }, [municipio, provincia]);

  return (
    <Stack spacing={3}>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        La dirección de la iglesia donde se reúne el destacamento.
      </Typography>
      <Rejilla>
        <Field.Autocomplete
          name="datos.direccion.provincia"
          label="Provincia *"
          options={PROVINCIAS.map((p) => p.nombre)}
          onChange={(_, v) => {
            setValue("datos.direccion.provincia", v || "", {
              shouldValidate: true,
            });
            setValue("datos.direccion.municipio", "");
            setValue("datos.direccion.sector", "");
          }}
        />
        <Field.Autocomplete
          name="datos.direccion.municipio"
          label="Municipio *"
          disabled={!provincia}
          options={municipios.map((m) => m.nombre)}
          onChange={(_, v) => {
            setValue("datos.direccion.municipio", v || "", {
              shouldValidate: true,
            });
            setValue("datos.direccion.sector", "");
          }}
        />
        <Field.Autocomplete
          name="datos.direccion.sector"
          label="Sector"
          freeSolo
          disabled={!municipio}
          options={sectores}
          onInputChange={(_, v) => setValue("datos.direccion.sector", v || "")}
          helperText="Elígelo de la lista; si no aparece, escríbelo."
        />
        <Field.Text
          name="datos.direccion.calle"
          label="Calle y número"
          placeholder="Ej: C/ Principal #123"
        />
      </Rejilla>
      <Field.Text
        name="datos.direccion.referencia"
        label="Referencia (opcional)"
        placeholder="Ej: Al lado del colmado, frente al parque"
      />
    </Stack>
  );
}

// ---------------------------------------------------------------- paso 5

function PasoLideres() {
  const { control, setValue, getValues } = useFormContext();
  const elegido = useWatch({ control, name: "destacamento.elegido" });
  const coordinador = useWatch({ control, name: "datos.coordinador.miembro" });
  const remitente = useWatch({ control, name: "remitente.miembro" });

  // Si el coordinador es quien llena el formulario, su teléfono es el que ya
  // escribió al inicio (solo si aquí aún no hay uno).
  useEffect(() => {
    if (!coordinador?.id || String(coordinador.id) !== String(remitente?.id)) return;
    if (getValues("datos.coordinador.telefono")) return;
    setValue("datos.coordinador.telefono", getValues("remitente.telefono") || "", {
      shouldValidate: true,
    });
  }, [coordinador?.id, remitente?.id, getValues, setValue]);
  return (
    <Stack spacing={4}>
      <Stack spacing={2}>
        <Typography variant="subtitle1">Pastor</Typography>
        <Rejilla>
          <Field.Text
            name="datos.pastor.nombre"
            label="Nombre del pastor *"
            placeholder="Nombre y apellido"
          />
          <Field.Phone
            name="datos.pastor.telefono"
            label="Teléfono del pastor"
            defaultCountry="DO"
            maxDigitos={10}
            helperText={
              elegido?.pastorTieneTelefono
                ? "Ya hay uno registrado: escríbelo solo si cambió."
                : ""
            }
          />
        </Rejilla>
      </Stack>

      <Stack spacing={2}>
        <Typography variant="subtitle1">Coordinador de Destacamento</Typography>
        <BuscarPersona
          ruta="datos.coordinador"
          etiqueta="Coordinador de Destacamento *"
        />
        <Field.Phone
          name="datos.coordinador.telefono"
          label="Teléfono del coordinador"
          defaultCountry="DO"
          maxDigitos={10}
        
        />
      </Stack>
    </Stack>
  );
}

// ---------------------------------------------------------------- paso 6

function PasoReuniones() {
  return (
    <Stack spacing={4}>
      <Rejilla>
        <SiNo
          name="datos.registradoOfnc"
          label="Registrado en la Oficina Nacional"
        />
        <SiNo name="datos.rritrackActivo" label="RRITrack activo" />
      </Rejilla>
      {/* Todo el ancho: en una columna de dos dejaba un hueco al lado. */}
      <Field.Select name="datos.diaReunion" label="Día de reunión *">
        {DIAS.map((d) => (
          <MenuItem key={d} value={d}>
            {d}
          </MenuItem>
        ))}
      </Field.Select>
      <Rejilla>
        <Field.TimePicker
          name="datos.horaReunion"
          label="Horario de reunión: desde *"
          ampm
          format="hh:mm A"
        />
        <Field.TimePicker
          name="datos.horaReunionFin"
          label="Hasta *"
          ampm
          format="hh:mm A"
        />
      </Rejilla>
    </Stack>
  );
}

// ---------------------------------------------------------------- paso 7

function PasoConfirmacion({ secciones }) {
  const { control } = useFormContext();
  const v = useWatch({ control });
  const d = v.destacamento.elegido;
  // La sección corregida (si la hay) manda sobre la del padrón.
  const seccion =
    secciones.find((s) => String(s.id) === String(v.destacamento.idSeccion)) ||
    (d ? { nombre: d.seccion, region: d.region } : {});
  const persona = (p) =>
    (p.modo === "existente"
      ? p.miembro?.nombre
      : `${p.nombres} ${p.apellidos}`.trim()) || "—";
  const dir = v.datos.direccion;
  const siNo = (x) => (x === true ? "Sí" : x === false ? "No" : "—");

  const filas = [
    [
      "Destacamento",
      `${v.datos.numero ? `#${v.datos.numero} · ` : ""}${v.datos.nombre}`,
      d ? nombreDeDestacamento(d) : "Nuevo",
    ],
    ["Región / sección", `${seccion.region || "—"} / ${seccion.nombre || "—"}`],
    ["Iglesia", v.datos.iglesia, d?.iglesia],
    ["Miembros (aprox.)", v.datos.cantidadMiembros || "—"],
    [
      "Dirección",
      [dir.provincia, dir.municipio, dir.sector, dir.calle]
        .filter(Boolean)
        .join(", ") + (dir.referencia ? ` (${dir.referencia})` : ""),
      d
        ? [
            d.direccion.provincia,
            d.direccion.municipio,
            d.direccion.sector,
            d.direccion.calle,
          ]
            .filter(Boolean)
            .join(", ")
        : undefined,
    ],
    [
      "Pastor",
      v.datos.pastor.nombre +
        (v.datos.pastor.telefono ? ` · ${v.datos.pastor.telefono}` : ""),
      d?.pastor,
    ],
    [
      "Coordinador",
      persona(v.datos.coordinador) +
        (v.datos.coordinador.telefono
          ? ` · ${v.datos.coordinador.telefono}`
          : ""),
      d?.coordinador?.nombre,
    ],
    [
      "Registrado en Oficina Nacional",
      siNo(v.datos.registradoOfnc),
      d ? siNo(d.registradoOfnc) : undefined,
    ],
    [
      "RRITrack activo",
      siNo(v.datos.rritrackActivo),
      d ? siNo(d.rritrackActivo) : undefined,
    ],
    [
      "Reunión",
      `${v.datos.diaReunion} · ${v.datos.horaReunion ? dayjs(v.datos.horaReunion).format("hh:mm A") : "—"} a ${v.datos.horaReunionFin ? dayjs(v.datos.horaReunionFin).format("hh:mm A") : "—"}`,
    ],
    [
      "Logo",
      v.logo
        ? "Nuevo logo adjunto"
        : d?.foto
          ? "Se mantiene el actual"
          : "Sin logo",
    ],
  ];

  return (
    <Stack spacing={3}>
      <Alert severity="info">
        Revisa los datos. Al enviarlos serán recibidos por la{" "}
        <strong>Oficina Nacional</strong>.
      </Alert>
      <Card variant="outlined">
        {filas.map(([etiqueta, valor, antes]) => {
          const cambia =
            antes !== undefined &&
            String(antes || "") !== String(valor || "") &&
            !(etiqueta === "Destacamento");
          return (
            <Stack
              key={etiqueta}
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 0.5, sm: 2 }}
              sx={{
                px: 2.5,
                py: 1.5,
                borderBottom: (t) => `dashed 1px ${t.vars.palette.divider}`,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  width: { sm: 220 },
                  flexShrink: 0,
                  color: "text.secondary",
                }}
              >
                {etiqueta}
              </Typography>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2">{valor || "—"}</Typography>
                {cambia && (
                  <Typography variant="caption" sx={{ color: "text.disabled" }}>
                    Antes: {antes || "sin registrar"}
                  </Typography>
                )}
              </Box>
            </Stack>
          );
        })}
        <Stack
          direction="row"
          spacing={1}
          sx={{ px: 2.5, py: 1.5, alignItems: "center" }}
        >
          <Iconify icon="solar:user-id-bold" sx={{ color: "text.secondary" }} />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Enviado por <strong>{persona(v.remitente)}</strong> ·{" "}
            {etiquetaCargo(v.miembro.posicionDestacamento) || "Sin posición"} · {v.remitente.telefono}
          </Typography>
        </Stack>
      </Card>
    </Stack>
  );
}

function Enviado({ enviado, onOtro, destacamentos, secciones, padron }) {
  const [verMapa, setVerMapa] = useState(false);
  return (
    <Stack
      spacing={3}
      sx={{ py: 6, alignItems: "center", textAlign: "center" }}
    >
      <Iconify
        icon="solar:verified-check-bold"
        width={72}
        sx={{ color: "success.main" }}
      />
      <Typography variant="h4">¡Gracias! Recibimos la información</Typography>
      <Typography sx={{ color: "text.secondary", maxWidth: 520 }}>
        {enviado.numero
          ? `El destacamento #${enviado.numero} · `
          : "El destacamento "}
        {enviado.nombre} fue recibido por la Oficina Nacional. Si
        hace falta, te contactaremos al teléfono que nos dejaste.
      </Typography>
      {/* Los dos botones juntos, con menos separación que el resto. */}
      <Stack spacing={1.5}>
        <Button
          variant="contained"
          startIcon={<Iconify icon="solar:add-circle-linear" />}
          onClick={onOtro}
        >
          Registrar otro destacamento
        </Button>
        {/* Solo en el móvil: ahí la portada no enseña el mapa. Mismo ancho que el de arriba. */}
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<Iconify icon="solar:map-bold" />}
          onClick={() => setVerMapa(true)}
          sx={{ display: { md: "none" } }}
        >
          Ver mapa de Destacamentos
        </Button>
      </Stack>
      <Dialog
        fullWidth
        maxWidth="sm"
        open={verMapa}
        onClose={() => setVerMapa(false)}
      >
        <Box
          sx={(t) => ({
            p: 2,
            pt: 7,
            position: "relative",
            bgcolor: t.vars.palette.primary.darker,
          })}
        >
          <IconButton
            aria-label="Cerrar"
            onClick={() => setVerMapa(false)}
            sx={{
              position: "absolute",
              top: 8,
              left: 8,
              color: "common.white",
            }}
          >
            <Iconify icon="mingcute:close-line" />
          </IconButton>
          <MapaDestacamentos
            padron={padron}
            destacamentos={destacamentos}
            secciones={secciones}
          />
        </Box>
      </Dialog>
    </Stack>
  );
}
