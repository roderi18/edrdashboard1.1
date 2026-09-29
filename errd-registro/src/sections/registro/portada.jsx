"use client";

import { useMemo, useState } from "react";
import { varAlpha } from "minimal-shared/utils";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Link from "@mui/material/Link";
import Menu from "@mui/material/Menu";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import Tooltip from "@mui/material/Tooltip";
import MenuItem from "@mui/material/MenuItem";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";

import { Iconify } from "src/components/iconify";

import { mismoNombre } from "./catalogo";
import { CuentaRegresiva } from "./cuenta-regresiva";
import {
  MAPA_ALTO,
  MAPA_ANCHO,
  PROVINCIAS as PROVINCIAS_MAPA,
} from "./mapa-provincias";

// ----------------------------------------------------------------------
// Cabecera, portada (16:9 en pantallas grandes) y pie de la landing.
// Sin inicio de sesión ni usuario: es una página pública.
// ----------------------------------------------------------------------

const Marca = ({ claro = false }) => (
  <Stack
    direction="row"
    spacing={1.5}
    sx={{
      alignItems: "center",
      color: claro ? "common.white" : "text.primary",
    }}
  >
    <Box
      component="img"
      alt="Exploradores del Rey"
      src="/logo/emblema-erd.png"
      sx={{ width: 44, height: 44 }}
    />
    <Box>
      <Typography
        variant="subtitle1"
        sx={{ lineHeight: 1.1, fontWeight: 800, letterSpacing: 0.5 }}
      >
        EXPLORADORES DEL REY
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.8, letterSpacing: 1 }}>
        EVANGELIZAR · EQUIPAR · EMPODERAR
      </Typography>
    </Box>
  </Stack>
);

export function Encabezado() {
  const [anclaDescarga, setAnclaDescarga] = useState(null);
  const cerrarDescarga = () => setAnclaDescarga(null);

  return (
    <Box
      component="header"
      sx={(t) => ({
        bgcolor: t.vars.palette.primary.darker,
        color: "common.white",
        py: 1.5,
      })}
    >
      <Container maxWidth="xl">
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Marca claro />
          <Stack
            direction="row"
            spacing={3}
            sx={{ display: { xs: "none", md: "flex" } }}
          >
            {[
              ["Inicio", "#inicio"],
              ["Registrar destacamento", "#registrar"],
              ["Contacto", "#contacto-correo"],
            ].map(([t, href]) => (
              <Link
                key={href}
                href={href}
                color="inherit"
                underline="hover"
                variant="subtitle2"
              >
                {t}
              </Link>
            ))}
            <Link
              component="button"
              type="button"
              color="inherit"
              underline="hover"
              variant="subtitle2"
              aria-haspopup="menu"
              aria-expanded={Boolean(anclaDescarga)}
              onClick={(event) => setAnclaDescarga(event.currentTarget)}
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
            >
              Estado
              <Iconify icon="eva:arrow-ios-downward-fill" width={16} />
            </Link>
            <Menu
              anchorEl={anclaDescarga}
              open={Boolean(anclaDescarga)}
              onClose={cerrarDescarga}
              slotProps={{ paper: { sx: { mt: 1, minWidth: 180 } } }}
            >
              <MenuItem component="a" href="/estado-actualizacion/" onClick={cerrarDescarga}>Ver</MenuItem>
              <MenuItem component="a" href="/estado-actualizacion/?descargar=pdf" target="descarga-estado-destacamentos" onClick={cerrarDescarga}>Descargar PDF</MenuItem>
              <MenuItem component="a" href="/estado-actualizacion/?descargar=png" target="descarga-estado-destacamentos" onClick={cerrarDescarga}>Descargar PNG</MenuItem>
            </Menu>
            <Box
              component="iframe"
              name="descarga-estado-destacamentos"
              title="Preparación de la descarga del estado"
              sx={{ display: 'none' }}
            />
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

// Provincia del catálogo -> nombre en el mapa (dos se escriben distinto).
const EN_MAPA = { baoruco: "Bahoruco", "sanchez ramirez": "Sánchez Ramírez" };

// Región de cada provincia (nombres del mapa), según dónde están hoy sus
// destacamentos; las que aún no tienen ninguno, por cercanía.
export const REGIONES = [
  {
    nombre: "Región Norte",
    // Colores de cada región: Norte amarillo, Central azul, Sur rojo, Este verde.
    color: "warning",
    provincias: [
      "Monte Cristi",
      "Dajabón",
      "Santiago Rodríguez",
      "Valverde",
      "Santiago",
      "Puerto Plata",
      "Espaillat",
      "La Vega",
      "Duarte",
      "Hermanas Mirabal",
      "María Trinidad Sánchez",
      "Samaná",
      "Sánchez Ramírez",
    ],
  },
  {
    nombre: "Región Central",
    color: "primary",
    provincias: [
      "Distrito Nacional",
      "Santo Domingo",
      "Monte Plata",
      "Monseñor Nouel",
    ],
  },
  {
    nombre: "Región Sur",
    color: "error",
    provincias: [
      "Azua",
      "Bahoruco",
      "Barahona",
      "Elías Piña",
      "Independencia",
      "Pedernales",
      "Peravia",
      "San Cristóbal",
      "San Juan",
      "San José de Ocoa",
    ],
  },
  {
    nombre: "Región Este",
    color: "success",
    provincias: [
      "El Seibo",
      "Hato Mayor",
      "La Altagracia",
      "La Romana",
      "San Pedro de Macorís",
    ],
  },
];
export const regionDe = (provincia) =>
  REGIONES.find((r) => r.provincias.some((x) => mismoNombre(x, provincia)));

// Lista flotante de destacamentos al pasar por un número, una provincia o una
// región. En el móvil sale al tocar (enterTouchDelay 0).
// Solo el número ("Dest. 18"); un destacamento nuevo aún sin número, por su nombre.
const nombreCorto = (d) =>
  d.numero ? `Dest. ${d.numero}` : d.nombre || "Sin número";

function ListaFlotante({ titulo, lista, children }) {
  if (!lista.length) return children;
  const orden = [...lista].sort((a, b) =>
    nombreCorto(a).localeCompare(nombreCorto(b), "es", { numeric: true }),
  );
  return (
    <Tooltip
      arrow
      // Empieza donde empieza lo señalado (la región o el número), no centrada.
      placement="bottom-start"
      enterTouchDelay={0}
      leaveTouchDelay={4000}
      title={
        <Box sx={{ py: 0.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            {titulo} · {lista.length}
          </Typography>
          <Box
            component="ul"
            sx={{ m: 0, pl: 2, maxHeight: 240, overflowY: "auto" }}
          >
            {orden.map((d) => (
              <Typography
                component="li"
                variant="caption"
                key={d.id}
                sx={{ display: "list-item" }}
              >
                {nombreCorto(d)}
              </Typography>
            ))}
          </Box>
        </Box>
      }
    >
      {children}
    </Tooltip>
  );
}

export const provinciaEnMapa = (p) => {
  if (!p) return null;
  const clave =
    EN_MAPA[p.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")] || p;
  return (
    PROVINCIAS_MAPA.find((x) => mismoNombre(x.nombre, clave))?.nombre || null
  );
};

function MapaRD({ destacamentos }) {
  // Provincia del mapa -> sus destacamentos.
  const porProvincia = useMemo(() => {
    const lista = new Map();
    destacamentos.forEach((d) => {
      const prov = provinciaEnMapa(d.direccion?.provincia);
      if (prov) lista.set(prov, [...(lista.get(prov) || []), d]);
    });
    return lista;
  }, [destacamentos]);
  const cuantos = (nombre) => porProvincia.get(nombre)?.length || 0;

  return (
    <Box
      component="svg"
      viewBox={`-10 -10 ${MAPA_ANCHO + 20} ${MAPA_ALTO + 20}`}
      role="img"
      aria-label="Mapa de destacamentos por provincia"
      sx={{
        width: 1,
        height: "auto",
        filter: "drop-shadow(0 12px 24px rgba(0,0,0,.45))",
      }}
    >
      {PROVINCIAS_MAPA.map((p) => (
        <ListaFlotante
          key={p.nombre}
          titulo={p.nombre}
          lista={porProvincia.get(p.nombre) || []}
        >
          <Box
            component="path"
            d={p.d}
            sx={(t) => ({
              fill:
                t.vars.palette[regionDe(p.nombre)?.color || "grey"]?.main ??
                t.vars.palette.grey[500],
              fillOpacity: cuantos(p.nombre) ? 0.9 : 0.5,
              cursor: cuantos(p.nombre) ? "pointer" : "default",
              stroke: t.vars.palette.common.white,
              strokeOpacity: 0.6,
              strokeWidth: 1.2,
            })}
          />
        </ListaFlotante>
      ))}
      {PROVINCIAS_MAPA.filter((p) => cuantos(p.nombre)).map((p) => (
        <ListaFlotante
          key={`pin-${p.nombre}`}
          titulo={p.nombre}
          lista={porProvincia.get(p.nombre)}
        >
          <Box
            component="g"
            transform={`translate(${p.centro[0]} ${p.centro[1]})`}
            sx={{ cursor: "pointer" }}
          >
            <Box
              component="circle"
              r={14}
              sx={(t) => ({
                // Blanco: amarillo, como antes, no se veía sobre el Norte (ahora amarillo).
                fill: t.vars.palette.common.white,
                stroke: t.vars.palette.primary.darker,
                strokeWidth: 2,
              })}
            />
            <text
              textAnchor="middle"
              dy="5"
              fontSize="14"
              fontWeight="700"
              fill="#1C252E"
            >
              {cuantos(p.nombre)}
            </text>
          </Box>
        </ListaFlotante>
      ))}
    </Box>
  );
}

// ---------------------------------------------------------------- vistas del carrusel
//
// El recuadro del mapa es un carrusel: Mapa, Avance por región, Ritmo diario y
// Top secciones. Todas salen de lo que la página ya tiene (los que enviaron y el
// padrón): no piden nada al servidor. Solo se pinta la vista abierta.
// Colores: cada región con el suyo (el del mapa), para que "Central" sea verde en
// todas; lo que mide una sola cosa (ritmo, secciones), en un solo azul.

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const textoClaro = { color: "common.white" };
const textoSuave = { color: "common.white", opacity: 0.75 };

function Barra({ valor, total, color, etiqueta, detalle }) {
  const ancho = total ? Math.min(100, (valor / total) * 100) : 0;
  return (
    <Box>
      <Stack
        direction="row"
        sx={{ mb: 0.5, justifyContent: "space-between", gap: 1 }}
      >
        <Typography variant="subtitle2" noWrap sx={textoClaro}>
          {etiqueta}
        </Typography>
        <Typography variant="caption" sx={{ ...textoSuave, flexShrink: 0 }}>
          {detalle}
        </Typography>
      </Stack>
      <Box
        sx={(t) => ({
          height: 10,
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: varAlpha(t.vars.palette.common.whiteChannel, 0.12),
        })}
      >
        <Box
          sx={(t) => ({
            height: 1,
            width: `${ancho}%`,
            minWidth: valor ? 6 : 0,
            borderRadius: 1,
            bgcolor: color(t),
            transition: "width .6s ease",
          })}
        />
      </Box>
    </Box>
  );
}

function VistaAvanceRegion({ destacamentos, padron }) {
  return (
    <Stack spacing={2.5} sx={{ px: { xs: 1, md: 2 } }}>
      {REGIONES.map((r) => {
        const total = padron.filter((d) => d.region === r.nombre).length;
        const lista = destacamentos.filter((d) => d.region === r.nombre);
        return (
          <ListaFlotante key={r.nombre} titulo={r.nombre} lista={lista}>
            <Box sx={{ display: 'flex', justifyContent: { xs: 'center', md: 'flex-start' } }}>
              <Barra
                etiqueta={r.nombre.replace("Región ", "")}
                detalle={`${lista.length} / ${total || "—"} · ${pct(lista.length, total)}%`}
                valor={lista.length}
                total={total}
                color={(t) => t.vars.palette[r.color].main}
              />
            </Box>
          </ListaFlotante>
        );
      })}
    </Stack>
  );
}

const VISTAS = [
  { id: "mapa", titulo: "Mapa" },
  { id: "region", titulo: "Avance por región" },
];

// Los destacamentos que ya enviaron, uno por línea: "Región Central - Dest. 18".
// Con scroll: pueden ser cientos.
const LLEGA_FUERA = "@media (min-width: 1760px)";
function ListaInscritos({ destacamentos, sx }) {
  const filas = destacamentos
    .map((d) => ({
      region: d.region || "Sin región",
      texto: d.numero ? `Dest. ${d.numero}` : d.nombre || "Sin número",
      orden: Number(d.numero) || 99999,
    }))
    .sort(
      (a, b) => a.region.localeCompare(b.region, "es") || a.orden - b.orden,
    );
  return (
    <Box
      sx={[
        (t) => ({
          p: 1.5,
          display: "flex",
          flexDirection: "column",
          borderRadius: 2,
          bgcolor: varAlpha(t.vars.palette.primary.darkerChannel, 0.72),
          border: `solid 1px ${varAlpha(t.vars.palette.primary.lightChannel, 0.25)}`,
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Typography
        variant="subtitle2"
        sx={{
          ...textoClaro,
          pb: 1,
          mb: 0.5,
          borderBottom: "solid 1px rgba(255,255,255,0.25)",
        }}
      >
        Destacamentos actualizados
      </Typography>
      {/* Solo la lista se desplaza; el título queda fijo arriba. */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5 }}>
        {filas.length ? (
          filas.map((f, i) => (
            <Typography
              key={i}
              variant="caption"
              component="div"
              noWrap
              sx={{
                ...textoClaro,
                py: 0.5,
                fontSize: 11.5,
                borderBottom: "dashed 1px rgba(255,255,255,0.12)",
              }}
            >
              {f.region} - {f.texto}
            </Typography>
          ))
        ) : (
          <Typography variant="caption" sx={textoSuave}>
            Aún no hay destacamentos actualizados.
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function LeyendaRegiones({ destacamentos, secciones }) {
  const iconoDeRegion = new Map(
    secciones.filter((s) => s.fotoRegion).map((s) => [s.region, s.fotoRegion]),
  );
  return (
    <Stack
      direction="row"
      sx={{
        order: 3,
        gap: 1.5,
        justifyContent: "center",
        py: { xs: 1, md: 0 },
        position: { md: "absolute" },
        left: { md: "30%" },
        right: { md: 0 },
        bottom: { md: "2%" },
      }}
    >
      {REGIONES.map((r) => (
        <ListaFlotante
          key={r.nombre}
          titulo={r.nombre}
          lista={destacamentos.filter((d) => d.region === r.nombre)}
        >
          <Stack
            spacing={0.25}
            sx={{ alignItems: "center", minWidth: 56, cursor: "default" }}
          >
            {iconoDeRegion.get(r.nombre) ? (
              <Box
                component="img"
                src={iconoDeRegion.get(r.nombre)}
                alt={r.nombre}
                sx={(t) => ({
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: `2px solid ${t.vars.palette[r.color].main}`,
                })}
              />
            ) : (
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  bgcolor: `${r.color}.main`,
                }}
              />
            )}
            <Typography
              variant="caption"
              sx={{ color: "common.white", fontWeight: 600, lineHeight: 1.2 }}
            >
              {r.nombre.replace("Región ", "")}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "common.white", opacity: 0.8, lineHeight: 1.2 }}
            >
              {destacamentos.filter((d) => d.region === r.nombre).length} dest.
            </Typography>
          </Stack>
        </ListaFlotante>
      ))}
    </Stack>
  );
}

/** El recuadro del mapa (portada y ventana del móvil): el total fijo arriba y,
 *  debajo, un carrusel con el mapa y tres gráficos. `destacamentos`: los que ya
 *  enviaron; `padron`: todos, para el "de su total". */
export function MapaDestacamentos({
  destacamentos,
  secciones = [],
  padron = [],
}) {
  const [vista, setVista] = useState(0);
  const [toqueX, setToqueX] = useState(null);
  const mover = (paso) =>
    setVista((v) => (v + paso + VISTAS.length) % VISTAS.length);
  const actual = VISTAS[vista].id;

  const flecha = (paso, icono, lado) => (
    <IconButton
      aria-label={paso > 0 ? "Siguiente gráfico" : "Gráfico anterior"}
      onClick={() => mover(paso)}
      size="small"
      sx={(t) => ({
        top: "50%",
        zIndex: 2,
        [lado]: { xs: -4, md: -8 },
        position: "absolute",
        transform: "translateY(-50%)",
        color: "common.white",
        bgcolor: varAlpha(t.vars.palette.primary.darkerChannel, 0.7),
        border: `solid 1px ${varAlpha(t.vars.palette.primary.lightChannel, 0.4)}`,
        "&:hover": {
          bgcolor: varAlpha(t.vars.palette.primary.darkerChannel, 0.9),
        },
      })}
    >
      <Iconify icon={icono} />
    </IconButton>
  );

  return (
    // En pantallas pequeñas el total, la vista y los puntos van uno debajo del
    // otro: encima del mapa lo tapaban. Desde md, el total y la leyenda flotan
    // sobre el mar, como siempre.
    <Box
      sx={{
        position: "relative",
        display: { xs: "flex", md: "block" },
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Box
        onTouchStart={(e) => setToqueX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (toqueX === null) return;
          const dx = e.changedTouches[0].clientX - toqueX;
          if (Math.abs(dx) > 40) mover(dx < 0 ? 1 : -1);
          setToqueX(null);
        }}
        sx={{ order: 2, position: "relative", px: { xs: 4.5, md: 0 } }}
      >
        {actual === "mapa" ? (
          <MapaRD destacamentos={destacamentos} />
        ) : (
          // Mismo alto que el mapa en pantallas grandes: la portada no salta al
          // cambiar de vista.
          <Box
            sx={(t) => ({
              // Fondo oscuro detrás del gráfico: sobre la foto se leía poco.
              borderRadius: 2,
              bgcolor: {
                md: varAlpha(t.vars.palette.primary.darkerChannel, 0.72),
              },
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minHeight: { xs: 280, md: 0 },
              aspectRatio: { md: `${MAPA_ANCHO + 20} / ${MAPA_ALTO + 20}` },
              py: { md: 3.5 },
              px: { md: 5 },
            })}
          >
            {/* En esta vista el total va como un solo texto centrado, sin tarjeta. */}
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h5" sx={textoClaro}>
                {destacamentos.length} Destacamentos actualizados
              </Typography>
              <Typography variant="overline" sx={textoSuave}>
                {VISTAS[vista].titulo}
              </Typography>
            </Box>
            <Box
              sx={{
                flex: 1,
                gap: 3,
                minHeight: 0,
                display: "grid",
                // Una sola fila del alto que queda: la lista no puede crecer más
                // que el recuadro (con 40 se salía y tapaba las barras).
                gridTemplateRows: { md: "minmax(0, 1fr)" },
                gridTemplateColumns: { xs: "1fr", md: "1fr 190px" },
                [LLEGA_FUERA]: { gridTemplateColumns: "1fr" },
              }}
            >
              <Box sx={{ alignSelf: "center" }}>
                <VistaAvanceRegion
                  destacamentos={destacamentos}
                  padron={padron}
                />
              </Box>
              {/* Sin sitio a la derecha del recuadro, la lista va dentro. */}
              <ListaInscritos
                destacamentos={destacamentos}
                sx={{
                  maxHeight: { xs: 200, md: 1 },
                  height: { md: 1 },
                  [LLEGA_FUERA]: { display: "none" },
                }}
              />
            </Box>
          </Box>
        )}
        {/* Con sitio a la derecha (pantallas anchas), la lista va fuera, del
            mismo alto que el recuadro, sin mover nada de la portada. */}
        {actual === "region" && (
          <ListaInscritos
            destacamentos={destacamentos}
            sx={{
              display: "none",
              top: 0,
              bottom: 0,
              width: 200,
              position: "absolute",
              left: "calc(100% + 16px)",
              [LLEGA_FUERA]: { display: "flex" },
            }}
          />
        )}
        {flecha(-1, "eva:arrow-ios-back-fill", "left")}
        {flecha(1, "eva:arrow-ios-forward-fill", "right")}
      </Box>

      {actual === "mapa" && (
        <LeyendaRegiones destacamentos={destacamentos} secciones={secciones} />
      )}

      {/* Puntos: qué vista está abierta; también sirven para saltar a una. */}
      <Stack
        direction="row"
        sx={{
          order: 4,
          gap: 1,
          justifyContent: "center",
          position: { md: "absolute" },
          left: { md: 0 },
          right: { md: 0 },
          bottom: { md: -18 },
        }}
      >
        {VISTAS.map((v, i) => (
          <Box
            key={v.id}
            component="button"
            type="button"
            aria-label={v.titulo}
            onClick={() => setVista(i)}
            sx={(t) => ({
              p: 0,
              border: 0,
              height: 8,
              cursor: "pointer",
              borderRadius: 4,
              width: i === vista ? 22 : 8,
              transition: "width .2s",
              bgcolor:
                i === vista
                  ? "common.white"
                  : varAlpha(t.vars.palette.common.whiteChannel, 0.4),
            })}
          />
        ))}
      </Stack>

      <Card
        sx={(t) => ({
          order: 1,
          // En "Avance por región" el total va dentro, como texto centrado.
          p: { xs: 1, md: 2 },
          px: { xs: 2 },
          top: { md: 0 },
          right: { md: 0 },
          zIndex: 3,
          position: { md: "absolute" },
          alignSelf: { xs: "center", md: "auto" },
          display: actual === "region" ? "none" : "flex",
          flexDirection: { xs: "row", md: "column" },
          alignItems: { xs: "baseline", md: "flex-start" },
          gap: { xs: 1, md: 0 },
          color: "common.white",
          bgcolor: `${varAlpha(t.vars.palette.primary.darkerChannel, 0.8)}`,
          border: `solid 1px ${varAlpha(t.vars.palette.primary.lightChannel, 0.4)}`,
        })}
      >
        <Typography variant="h3" sx={{ typography: { xs: "h5", md: "h3" } }}>
          {destacamentos.length || "—"}
        </Typography>
        <Typography
          variant="caption"
          sx={{ opacity: 0.8, fontSize: { xs: 13, md: 12 } }}
        >
          Dests. actualizados
        </Typography>
      </Card>
    </Box>
  );
}

// `destacamentos`: los que ya enviaron su información (uno por destacamento).
// Solo en pantallas pequeñas, donde la portada no enseña el mapa: un botón que
// lo abre en una ventana (la misma que la de "¡Gracias!" del formulario).
function BotonMapaDeInscritos({ destacamentos, secciones, padron }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Box sx={{ display: { xs: "flex", md: "none" }, justifyContent: "center" }}>
      <Button
        // El azul de la casa (el de "en cada rincón…"), relleno para que destaque.
        variant="contained"
        color="primary"
        size="large"
        startIcon={<Iconify icon="solar:map-bold" />}
        onClick={() => setAbierto(true)}
        sx={(t) => ({
          px: 3,
          fontWeight: 700,
          position: "relative",
          boxShadow: t.vars.customShadows?.primary,
        })}
      >
        {/* La ola de dentro: un brillo que cruza el botón de lado a lado. Va en
            su propia capa recortada. */}
        <Box
          component="span"
          aria-hidden
          sx={{
            inset: 0,
            position: "absolute",
            overflow: "hidden",
            borderRadius: "inherit",
            pointerEvents: "none",
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0,
              bottom: 0,
              width: "45%",
              left: "-60%",
              background:
                "linear-gradient(100deg, transparent, rgba(255,255,255,0.35), transparent)",
              animation: "olaDentroDelBoton 2.4s ease-in-out infinite",
            },
            "@keyframes olaDentroDelBoton": {
              "0%": { left: "-60%" },
              "60%, 100%": { left: "120%" },
            },
            "@media (prefers-reduced-motion: reduce)": {
              "&::before": { animation: "none", display: "none" },
            },
          }}
        />
        Ver mapa de inscritos
      </Button>
      <Dialog
        fullWidth
        maxWidth="sm"
        open={abierto}
        onClose={() => setAbierto(false)}
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
            onClick={() => setAbierto(false)}
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
    </Box>
  );
}

export function Portada({ destacamentos, secciones = [], padron = [] }) {
  return (
    <Box
      id="inicio"
      sx={(t) => ({
        position: "relative",
        color: "common.white",
        overflow: "hidden",
        // Una franja baja (38% del ancho, hasta 540 px) para que el formulario se
        // vea sin bajar tanto. Con aspect-ratio + max-height el navegador
        // estrechaba la portada, por eso va con height.
        height: { lg: "min(38vw, 540px)" },
        display: "flex",
        alignItems: "center",
        py: { xs: 3, lg: 0 },
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundImage: {
          xs: `linear-gradient(180deg, ${varAlpha(t.vars.palette.primary.darkerChannel, 0.93)}, ${varAlpha(t.vars.palette.primary.darkerChannel, 0.67)}), url(/fotos/campamento-movil.webp)`,
          md: `linear-gradient(90deg, ${varAlpha(t.vars.palette.primary.darkerChannel, 0.95)} 0%, ${varAlpha(t.vars.palette.primary.darkerChannel, 0.7)} 45%, ${varAlpha(t.vars.palette.primary.darkerChannel, 0.25)} 100%), url(/fotos/campamento-monitor-1920.webp)`,
        },
      })}
    >
      <Container maxWidth="xl">
        <Box
          sx={{
            gap: 4,
            display: "grid",
            alignItems: "center",
            gridTemplateColumns: { xs: "1fr", md: "1.1fr 1fr" },
          }}
        >
          <Stack spacing={3}>
            <Typography
              variant="h2"
              sx={{ fontSize: { xs: 32, md: 44, lg: 58 }, lineHeight: 1.1 }}
            >
              Cada Destacamento cuenta{" "}
              <Box component="span" sx={{ color: "primary.light" }}>
                en cada rincón de la República Dominicana
              </Box>
            </Typography>
            <Typography sx={{ opacity: 0.85, maxWidth: 600 }}>
              Registra o actualiza la información de tu destacamento y ayúdanos
              a tener un registro nacional completo y al día.
            </Typography>
            <CuentaRegresiva />
            <BotonMapaDeInscritos
              padron={padron}
              destacamentos={destacamentos}
              secciones={secciones}
            />
          </Stack>

          <Box
            sx={{
              position: "relative",
              display: { xs: "none", md: "block" },
              // Un poco más grande que antes (620).
              maxWidth: 660,
              justifySelf: "end",
              width: 1,
              // Con la lista fuera (pantallas anchas), el bloque se corre un poco a
              // la izquierda para que la lista no quede pegada al borde. Correrlo
              // todo lo que mide la lista pisaba el título.
              [LLEGA_FUERA]: { mr: "48px", width: "calc(100% - 48px)" },
            }}
          >
            <MapaDestacamentos
              padron={padron}
              destacamentos={destacamentos}
              secciones={secciones}
            />
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

export function Pie() {
  return (
    <Box
      id="contacto"
      component="footer"
      sx={(t) => ({
        bgcolor: t.vars.palette.primary.darker,
        color: "common.white",
        py: 2.5,
        mt: { xs: 4, md: 6 },
      })}
    >
      <Container maxWidth="xl">
        {/* La marca y, a su derecha, el contacto; debajo, los derechos. */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={4}
          sx={{ justifyContent: "center", alignItems: "center" }}
        >
          {/* Los derechos, justo bajo el lema de la marca. */}
          <Stack
            spacing={0.75}
            sx={{ alignItems: { xs: "center", md: "flex-start" } }}
          >
            <Marca claro />
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              © {new Date().getFullYear()} Exploradores del Rey. Todos los
              derechos reservados.
            </Typography>
          </Stack>
          {/* Separador vertical entre la marca y el contacto (solo en pantalla ancha). */}
          <Box
            sx={{
              display: { xs: "none", md: "block" },
              alignSelf: "stretch",
              borderLeft: "solid 1px rgba(255,255,255,0.2)",
            }}
          />
          {/* Contacto: a donde escribir si algo del registro no funciona. Destino
              del enlace "Contacto" de la cabecera. */}
          <Stack
            id="contacto-correo"
            spacing={0.25}
            sx={{
              alignItems: { xs: "center", md: "flex-start" },
              textAlign: { xs: "center", md: "left" },
              scrollMarginTop: 24,
            }}
          >
            <Typography
              variant="overline"
              sx={{ opacity: 0.7, letterSpacing: 1.5 }}
            >
              Contacto
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85, maxWidth: 420 }}>
              ¿Dudas o problemas con el registro de tu destacamento? Escríbenos.
            </Typography>
            <Link
              href="mailto:tecnologia@errd.org.do?subject=Registro%20de%20destacamentos"
              color="inherit"
              underline="hover"
              sx={{
                gap: 1,
                display: "inline-flex",
                alignItems: "center",
                fontWeight: 600,
              }}
            >
              <Iconify icon="solar:letter-bold" width={20} />
              tecnologia@errd.org.do
            </Link>
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              Comité de Tecnología · Exploradores del Rey, Rep. Dom.
            </Typography>
          </Stack>
          {/* Logo de ERRD República Dominicana, a la derecha del contacto. Es una
              copia recortada y reducida (13 KB) del PNG original de 3300 px. */}
          <Box
            sx={{
              display: { xs: "none", md: "block" },
              alignSelf: "stretch",
              borderLeft: "solid 1px rgba(255,255,255,0.2)",
            }}
          />
          <Box
            component="img"
            src="/logo/errd-logo-blanco.webp"
            alt="Exploradores del Rey, República Dominicana"
            loading="lazy"
            // Solo en pantalla ancha y a la altura de la marca del pie (44 px).
            sx={{
              display: { xs: "none", md: "block" },
              height: 44,
              width: 199,
            }}
          />
          {/* En pantallas anchas la frase se parte en varias líneas a la derecha,
              en vez de estirarse en una sola. */}
          {/* <Typography
            sx={{
              fontStyle: 'italic',
              typography: 'h6',
              fontWeight: 400,
              opacity: 0.9,
              maxWidth: { md: 440 },
              textAlign: { md: 'right' },
            }}
          >
            Influir en la vida de más niños y jóvenes que nunca, de una manera más efectiva que nunca.
          </Typography> */}
        </Stack>
      </Container>
    </Box>
  );
}
