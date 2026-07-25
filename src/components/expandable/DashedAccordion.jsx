import Accordion from '@mui/material/Accordion';
import Typography from '@mui/material/Typography';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';

import { Iconify } from 'src/components/iconify';

export default function DashedAccordion({
    title,
    children,
    defaultExpanded = false,
    disabled = false,
}) {
    return (
        <Accordion
            defaultExpanded={disabled ? false : defaultExpanded}
            disabled={disabled}
            expanded={disabled ? false : undefined}
            sx={{
                gridColumn: '1 / -1',
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 1.5,
                boxShadow: 'none',
                '&:before': { display: 'none' },
                // Mantener legible el título aunque el acordeón esté deshabilitado.
                '&.Mui-disabled': { bgcolor: 'transparent', opacity: 1 },
            }}
        >
            <AccordionSummary
                // Sin flechita cuando está deshabilitado (no se puede expandir).
                expandIcon={disabled ? null : <Iconify icon="eva:arrow-ios-downward-fill" />}
                sx={{ cursor: disabled ? 'default' : undefined }}
            >
                <Typography
                    sx={{
                        typography: 'subtitle2',
                        color: 'text.secondary',
                    }}
                >
                    {title}
                </Typography>
            </AccordionSummary>

            {!disabled && <AccordionDetails>{children}</AccordionDetails>}
        </Accordion>
    );
}
