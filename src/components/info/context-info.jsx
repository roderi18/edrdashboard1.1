import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';
import { BotonCopiar } from 'src/components/common/boton-copiar';

/**
 * ContextInfo
 * Muestra una lista de textos centrados debajo de un bloque (ej: avatar).
 * Se puede usar en miembros, destacamentos, regiones, etc.
 *
 * `aviso` pinta un triangulo de advertencia a la derecha del texto, con su
 * explicacion al pasar por encima. Es el mismo que usa la Directiva para señalar
 * una ficha a medio completar.
 *
 * `copiar` pinta un boton de copiar a la derecha. Copia EXACTAMENTE lo que se le
 * pase —no el texto de la linea—, para poder mostrar "Miembro EDR-10002" y
 * copiar solo "EDR-10002".
 */

export function ContextInfo({ items = [] }) {
    if (!items?.length) return null;

    return (
        <>
            {items
                .filter((item) => item?.show === true && item?.text)
                .map((item, index) => (
                    <Typography
                        key={index}
                        variant={item.variant || 'body2'}
                        sx={{
                            mt: item.mt ?? 0,
                            mx: 'auto',
                            gap: 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            color: item.color || 'text.secondary',
                            fontWeight: item.bold ? 700 : 'normal',
                        }}
                    >
                        {item.text}

                        {item.aviso && (
                            <Tooltip title={item.aviso} placement="top" arrow>
                                <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0 }}>
                                    <Iconify
                                        width={16}
                                        icon="solar:danger-triangle-bold"
                                        sx={{ color: 'warning.main' }}
                                    />
                                </Box>
                            </Tooltip>
                        )}

                        {!!item.copiar && <BotonCopiar valor={item.copiar} titulo="Copiar código" />}
                    </Typography>
                ))}
        </>
    );
}
