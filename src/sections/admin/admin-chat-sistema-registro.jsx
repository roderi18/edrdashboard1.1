'use client';

import { useState, useEffect } from 'react';
import { query, limit, orderBy, collection, onSnapshot } from 'firebase/firestore';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { fDateTime } from 'src/utils/format-time';
import { COLECCION_REGISTRO_CHAT_SISTEMA } from 'src/utils/chat-sistema.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { Label } from 'src/components/label';
import { EmptyContent } from 'src/components/empty-content';

// ----------------------------------------------------------------------
// EL REGISTRO DEL CHAT DE SISTEMA.
//
// Cada envio del Sistema por el chat deja aqui su entrada: dia y hora, cuantos
// mensajes salieron, a que destacamento, a quienes y por que. Lo escribe solo el
// servidor (`chat-sistema-envio.mjs`) y solo lo lee el Administrador Global: las
// reglas no dejan a nadie mas, porque lleva los nombres de todo el destacamento.
// ----------------------------------------------------------------------

const MAXIMO_REGISTROS = 100;

const ETIQUETA_TIPO = { cumpleanos: 'Cumpleaños' };

function useRegistroDelChatDeSistema() {
  const [estado, setEstado] = useState({ cargando: true, registros: [], error: '' });

  useEffect(() => {
    if (!isFirebaseConfigured || !FIRESTORE) {
      setEstado({ cargando: false, registros: [], error: 'Firebase no está configurado.' });
      return undefined;
    }

    // En vivo: si la tarea de la mañana escribe mientras se mira, aparece sola.
    return onSnapshot(
      query(
        collection(FIRESTORE, COLECCION_REGISTRO_CHAT_SISTEMA),
        orderBy('fecha', 'desc'),
        limit(MAXIMO_REGISTROS)
      ),
      (instantanea) =>
        setEstado({
          cargando: false,
          registros: instantanea.docs.map((documento) => ({
            id: documento.id,
            ...documento.data(),
          })),
          error: '',
        }),
      (error) => {
        console.error('[chat-sistema] no se pudo leer el registro', error);
        setEstado({ cargando: false, registros: [], error: 'No se pudo leer el registro.' });
      }
    );
  }, []);

  return estado;
}

function FilaDelRegistro({ registro }) {
  const [abierta, setAbierta] = useState(false);
  const destinatarios = Array.isArray(registro.destinatarios) ? registro.destinatarios : [];

  return (
    <Box sx={{ py: 2 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 1, md: 2 }}
        alignItems={{ md: 'center' }}
      >
        <Box sx={{ minWidth: 170 }}>
          <Typography variant="subtitle2">{fDateTime(registro.fecha, 'DD/MM/YYYY')}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {fDateTime(registro.fecha, 'hh:mm A')}
          </Typography>
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Label color="primary">{ETIQUETA_TIPO[registro.tipo] ?? registro.tipo}</Label>
            {registro.origen && registro.origen !== 'programado' && (
              <Label color="warning">
                {registro.origen === 'prueba' ? 'Prueba' : registro.origen}
              </Label>
            )}
            <Typography variant="subtitle2" noWrap>
              {registro.nombreDestacamento || `Destacamento ${registro.idDestacamento}`}
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {registro.motivo}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap' }}>
            {registro.cantidadMensajes} {registro.cantidadMensajes === 1 ? 'mensaje' : 'mensajes'}
          </Typography>
          <Button size="small" color="inherit" onClick={() => setAbierta((valor) => !valor)}>
            {abierta ? 'Ocultar' : 'A quiénes'}
          </Button>
        </Stack>
      </Stack>

      <Collapse in={abierta} unmountOnExit>
        <Box sx={{ mt: 1.5, gap: 0.75, display: 'flex', flexWrap: 'wrap' }}>
          {destinatarios.map((destinatario) => (
            <Label
              key={`${destinatario.idMiembros}-${destinatario.felicitacion ? 'f' : 'l'}`}
              variant="outlined"
              color={destinatario.felicitacion ? 'success' : 'default'}
            >
              {destinatario.nombre}
              {destinatario.felicitacion ? ' · felicitación' : ''}
            </Label>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

export function AdminChatSistemaRegistro() {
  const { cargando, registros, error } = useRegistroDelChatDeSistema();

  if (cargando) {
    return (
      <Stack spacing={2} sx={{ p: 3 }}>
        {Array.from({ length: 4 }, (_, indice) => (
          <Skeleton key={indice} variant="rounded" height={64} />
        ))}
      </Stack>
    );
  }

  if (error || !registros.length) {
    return (
      <EmptyContent
        sx={{ py: 8 }}
        title={error || 'Todavía no hay envíos'}
        description="Aquí aparece cada mensaje que el Sistema manda por el chat: cuándo, a qué destacamento, a quiénes y por qué."
      />
    );
  }

  return (
    <Box sx={{ px: 3, pb: 1 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary', pt: 2.5 }}>
        Últimos {Math.min(registros.length, MAXIMO_REGISTROS)} envíos del chat de Sistema.
      </Typography>
      <Stack divider={<Divider sx={{ borderStyle: 'dashed' }} />}>
        {registros.map((registro) => (
          <FilaDelRegistro key={registro.id} registro={registro} />
        ))}
      </Stack>
    </Box>
  );
}
