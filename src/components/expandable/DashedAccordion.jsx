import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';

export default function DashedAccordion({
    title,
    children,
    defaultExpanded = false,
}) {
    return (
        <Accordion
            defaultExpanded={defaultExpanded}
            sx={{
                gridColumn: '1 / -1',
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 1.5,
                boxShadow: 'none',
                '&:before': { display: 'none' },
            }}
        >
            <AccordionSummary
                expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}
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

            <AccordionDetails>{children}</AccordionDetails>
        </Accordion>
    );
}