"use client";

import { useMemo, useState } from "react";
import { varAlpha } from "minimal-shared/utils";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import Tooltip from "@mui/material/Tooltip";
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
const REGIONES = [
  {
    nombre: "Región Norte",
    color: "info",
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
    color: "success",
    provincias: [
      "Distrito Nacional",
      "Santo Domingo",
      "Monte Plata",
      "Monseñor Nouel",
    ],
  },
  {
    nombre: "Región Sur",
    color: "warning",
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
    color: "error",
    provincias: [
      "El Seibo",
      "Hato Mayor",
      "La Altagracia",
      "La Romana",
      "San Pedro de Macorís",
    ],
  },
];
const regionDe = (provincia) =>
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

const provinciaEnMapa = (p) => {
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
                fill: t.vars.palette.warning.main,
                stroke: "#fff",
                strokeWidth: 3,
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

/** El mapa con la leyenda de regiones y el total: el de la portada, y el de la
 *  ventana "Ver mapa de Destacamentos" en el móvil (donde la portada lo oculta). */
export function MapaDestacamentos({ destacamentos, secciones = [] }) {
  const iconoDeRegion = new Map(
    secciones.filter((s) => s.fotoRegion).map((s) => [s.region, s.fotoRegion]),
  );
  return (
    // En pantallas pequeñas (la ventana del móvil) el total, el mapa y las
    // regiones van uno debajo del otro: encima del mapa lo tapaban. Desde md,
    // el total y las regiones flotan sobre el mar, como siempre.
    <Box
      sx={{
        position: "relative",
        display: { xs: "flex", md: "block" },
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Box sx={{ order: { xs: 2, md: 0 } }}>
        <MapaRD destacamentos={destacamentos} />
      </Box>
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
                {destacamentos.filter((d) => d.region === r.nombre).length}{" "}
                dest.
              </Typography>
            </Stack>
          </ListaFlotante>
        ))}
      </Stack>
      <Card
        sx={(t) => ({
          order: 1,
          p: { xs: 1, md: 2 },
          px: { xs: 2 },
          top: { md: 0 },
          right: { md: 0 },
          position: { md: "absolute" },
          alignSelf: { xs: "center", md: "auto" },
          display: "flex",
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
        <Typography variant="caption" sx={{ opacity: 0.8, fontSize: { xs: 13, md: 12 } }}>
          Destacamentos actualizados
        </Typography>
      </Card>
    </Box>
  );
}

// `destacamentos`: los que ya enviaron su información (uno por destacamento).
// Solo en pantallas pequeñas, donde la portada no enseña el mapa: un botón que
// lo abre en una ventana (la misma que la de "¡Gracias!" del formulario).
function BotonMapaDeInscritos({ destacamentos, secciones }) {
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
            destacamentos={destacamentos}
            secciones={secciones}
          />
        </Box>
      </Dialog>
    </Box>
  );
}

export function Portada({ destacamentos, secciones = [] }) {
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
              destacamentos={destacamentos}
              secciones={secciones}
            />
          </Stack>

          <Box
            sx={{
              position: "relative",
              display: { xs: "none", md: "block" },
              maxWidth: 620,
              justifySelf: "end",
              width: 1,
            }}
          >
            <MapaDestacamentos
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
        py: 5,
        mt: { xs: 4, md: 6 },
      })}
    >
      <Container maxWidth="xl">
        {/* La marca y el aviso de derechos, centrados. */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={4}
          sx={{ justifyContent: "center", alignItems: "center" }}
        >
          <Marca claro />
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
        <Typography
          variant="caption"
          sx={{ display: "block", mt: 1, opacity: 0.6, textAlign: "center" }}
        >
          © {new Date().getFullYear()} Exploradores del Rey. Todos los derechos
          reservados.
        </Typography>
      </Container>
    </Box>
  );
}
