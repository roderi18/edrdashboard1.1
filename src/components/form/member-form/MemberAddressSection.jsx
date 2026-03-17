import Box from '@mui/material/Box';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';
import { Field } from 'src/components/hook-form';

export default function MemberAddressSection({ isEdit = false }) {

    const Content = (
        <Box
            sx={{
                gridColumn: '1 / -1',
                rowGap: 3,
                columnGap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
            }}
        >
            <Field.CountrySelect
                fullWidth
                name="country"
                label="País"
                placeholder="Elige un país"
            />

            <Field.Text name="state" label="Provincia" />

            <Field.Text name="city" label="Ciudad" />

            <Field.Text name="address" label="Dirección" />
        </Box>
    );

    // NEW → sin accordion
    if (!isEdit) {
        return Content;
    }

    // EDIT → con accordion dashed
    return (
        <Accordion
            sx={{
                gridColumn: '1 / -1',
                boxShadow: 'none',
                border: (theme) => `1px dashed ${theme.palette.divider}`,
                '&:before': { display: 'none' },
            }}
        >
            <AccordionSummary
                expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" width={20} />}
            >
                <Typography
                    sx={{
                        typography: 'subtitle2',
                        color: 'text.secondary',
                    }}
                >
                    Dirección
                </Typography>
            </AccordionSummary>

            <AccordionDetails>
                {Content}
            </AccordionDetails>
        </Accordion>
    );
}