import Typography from '@mui/material/Typography';

/**
 * ContextInfo
 * Muestra una lista de textos centrados debajo de un bloque (ej: avatar).
 * Se puede usar en miembros, destacamentos, regiones, etc.
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
                            display: 'block',
                            textAlign: 'center',
                            color: item.color || 'text.secondary',
                            fontWeight: item.bold ? 700 : 'normal',
                        }}
                    >
                        {item.text}
                    </Typography>
                ))}
        </>
    );
}