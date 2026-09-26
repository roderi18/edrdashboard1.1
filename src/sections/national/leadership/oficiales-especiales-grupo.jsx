'use client';

import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Avatar from '@mui/material/Avatar';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import AvatarGroup from '@mui/material/AvatarGroup';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { tituloDe } from 'src/utils/titulos-oficiales-nacionales.mjs';

import { azulLegible } from 'src/theme/azul-legible';
import { useTitulosOficiales } from 'src/services/titulos-oficiales-service';

import { Iconify } from 'src/components/iconify';

import { MenuTituloOficial } from 'src/sections/national/leadership/titulo-oficial';
import {
  getMemberDisplayName,
  getLeadershipNodeIdentity,
} from 'src/sections/common/leadership-node-identity';

// ----------------------------------------------------------------------
// LA TARJETA "OFICIALES ESPECIALES": UN GRUPO, NO UNA CASILLA.
//
// Antes se llamaba "Comités Especiales" y se dibujaba como un cargo: "Vacante"
// y un circulo gris, aunque detras hubiera once Oficiales de la Nacional (2022-
// 2026) que no salian en ninguna parte del arbol. Ahora reune al grupo en el
// mismo tamaño de tarjeta: tres caras juntas, cuantos son y "Ver más", que
// despliega una franja horizontal con todos. Sin nadie, dice "Sin asignar" en
// vez de "Vacante": no es un puesto que ocupar.
// ----------------------------------------------------------------------

const CARAS_VISIBLES = 3;

const nombreDe = (persona) => persona?.name || getMemberDisplayName(persona) || 'Sin nombre';

const idDeFicha = (persona) =>
  String(persona?.idMiembros ?? persona?.idMiembro ?? persona?.id ?? '').trim();

// `puedeAsignarTitulo`: los tres puntos de cada oficial ("Asignar título"), para
// Administrador Global y Oficina Nacional; `puedeAgregarTitulo`, el "Nuevo" de la
// lista, solo para el primero.
export function OficialesEspecialesGrupo({
  personas = [],
  puedeAsignarTitulo = false,
  puedeAgregarTitulo = false,
  // Apagado en una directiva pasada: su tarjeta es memoria y un título de hoy
  // no se pinta sobre quien fue oficial entonces.
  mostrarTitulos = true,
  // Quitar a la persona de los Oficiales Especiales (solo si se puede gestionar).
  onQuitarOficial,
}) {
  const franja = usePopover();
  const total = personas.length;
  const { asignaciones } = useTitulosOficiales();
  const tituloDePersona = (persona) =>
    mostrarTitulos ? tituloDe(asignaciones, idDeFicha(persona)) : '';

  // Los botones viven dentro de una tarjeta que se arrastra (editor de diseño y
  // paneo del organigrama): sin esto, pulsar "Ver más" empezaba un arrastre.
  const noArrastrar = (event) => event.stopPropagation();

  return (
    <>
      {/* MISMA ALTURA QUE CUALQUIER CASILLA, con gente o sin ella: foto de 48 px
          con el mismo hueco debajo (mb 2), una línea de nombre y una de cargo.
          Sin oficiales la tarjeta perdía la segunda línea y quedaba más baja
          que sus vecinas de fila. */}
      <Box sx={{ mb: 2, height: 48, display: 'flex', alignItems: 'center' }}>
        {total ? (
          <AvatarGroup
            max={CARAS_VISIBLES}
            // El "+N" lo dice el texto de abajo; en el grupo solo van las caras.
            renderSurplus={() => null}
            sx={{ '& .MuiAvatar-root': { width: 44, height: 44, fontSize: 16 } }}
          >
            {personas.slice(0, CARAS_VISIBLES).map((persona) => {
              const identidad = getLeadershipNodeIdentity(persona);

              return (
                <Avatar
                  key={persona.id || nombreDe(persona)}
                  alt={nombreDe(persona)}
                  src={identidad.avatarUrl}
                >
                  {nombreDe(persona).charAt(0)}
                </Avatar>
              );
            })}
          </AvatarGroup>
        ) : (
          <Avatar
            sx={{ width: 44, height: 44, color: 'text.disabled', bgcolor: 'action.selected' }}
          >
            <Iconify icon="solar:users-group-rounded-bold" width={24} />
          </Avatar>
        )}
      </Box>

      {/* Línea de nombre. Con gente: "+11 Oficiales Especiales". Sin nadie: "Sin
          asignar", con la letra de "Vacante" de las demás casillas. */}
      <Box sx={{ mb: 0.5, gap: 0.75, minWidth: 0, display: 'flex', alignItems: 'baseline' }}>
        {total ? (
          <>
            <Typography variant="subtitle2" noWrap sx={{ flexShrink: 0 }}>
              {`+${total}`}
            </Typography>

            <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
              Oficiales Especiales
            </Typography>
          </>
        ) : (
          <Typography
            variant="subtitle2"
            noWrap
            sx={{ color: 'text.secondary', fontStyle: 'italic', fontWeight: 400 }}
          >
            Sin asignar
          </Typography>
        )}
      </Box>

      {/* Línea de cargo: "Ver más" con gente, el nombre del grupo sin ella. */}
      {!total && (
        <Typography variant="caption" component="div" noWrap sx={{ color: 'text.secondary' }}>
          Oficiales Especiales
        </Typography>
      )}

      {total > 0 && (
        <Link
          component="button"
          type="button"
          variant="caption"
          underline="always"
          onPointerDown={noArrastrar}
          onClick={(event) => {
            noArrastrar(event);
            franja.onOpen(event);
          }}
          sx={(theme) => ({
            alignSelf: 'flex-start',
            fontWeight: 600,
            // La raya del mismo color que la letra: MUI la pinta más apagada.
            textDecorationColor: 'currentColor',
            // En oscuro el azul de siempre casi no se leia sobre la tarjeta.
            ...azulLegible(theme),
          })}
        >
          Ver más
        </Link>
      )}

      <Popover
        open={franja.open}
        anchorEl={franja.anchorEl}
        onClose={franja.onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{ paper: { sx: { p: 2, maxWidth: 'min(92vw, 960px)' } } }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Oficiales Especiales · {total}
        </Typography>

        {/* La franja es horizontal: con muchos, se desplaza hacia el lado. */}
        <Box sx={{ gap: 1.5, display: 'flex', overflowX: 'auto', pb: 1 }}>
          {personas.map((persona) => {
            const identidad = getLeadershipNodeIdentity(persona);

            return (
              <Box
                key={persona.id || nombreDe(persona)}
                sx={{
                  p: 1.5,
                  width: 150,
                  flexShrink: 0,
                  borderRadius: 1.5,
                  position: 'relative',
                  textAlign: 'center',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {puedeAsignarTitulo && idDeFicha(persona) && (
                  <MenuTituloOficial
                    persona={persona}
                    puedeAgregar={puedeAgregarTitulo}
                    onQuitar={
                      onQuitarOficial
                        ? () => {
                            franja.onClose();
                            onQuitarOficial(persona);
                          }
                        : undefined
                    }
                  />
                )}

                <Avatar
                  alt={nombreDe(persona)}
                  src={identidad.avatarUrl}
                  sx={{ mx: 'auto', mb: 1, width: 48, height: 48 }}
                >
                  {nombreDe(persona).charAt(0)}
                </Avatar>
                <Typography variant="subtitle2" noWrap title={nombreDe(persona)}>
                  {/* Al perfil, igual que el nombre de cualquier casilla del árbol
                      (`LeadershipMemberNameLink`). Sin ficha, solo el nombre. */}
                  {idDeFicha(persona) ? (
                    <Link
                      component={RouterLink}
                      href={paths.dashboard.level.member.edit(idDeFicha(persona))}
                      underline="hover"
                      color="inherit"
                      onClick={franja.onClose}
                    >
                      {nombreDe(persona)}
                    </Link>
                  ) : (
                    nombreDe(persona)
                  )}
                </Typography>
                {/* Con título, el título EN LUGAR de "Oficial de la Nacional": que lo
                    es ya lo dice la tarjeta; lo que distingue a cada uno es el título. */}
                <Typography
                  variant="caption"
                  component="div"
                  noWrap
                  title={tituloDePersona(persona) || undefined}
                  sx={(theme) => ({
                    color: 'text.secondary',
                    ...(tituloDePersona(persona) && { ...azulLegible(theme), fontWeight: 600 }),
                  })}
                >
                  {tituloDePersona(persona) || persona.cargo || 'Oficial de la Nacional'}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Popover>
    </>
  );
}
