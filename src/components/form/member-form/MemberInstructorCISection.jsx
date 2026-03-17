import Box from '@mui/material/Box';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';

import { Iconify } from 'src/components/iconify';
import { Field } from 'src/components/hook-form';

export default function MemberInstructorCISection({
    instructorCI,
    diasRestantesCI,
    isEdit = false,
}) {

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
            <Field.Select
                name="InstructorCertificadoCI"
                label="¿Instructor Certificado?"
            >
                <MenuItem value={1}>Sí</MenuItem>
                <MenuItem value={0}>No</MenuItem>
            </Field.Select>

            {instructorCI === 1 && (
                <>
                    <Field.Select
                        name="EstatusVigenciaCI"
                        label="Estatus vigencia CI"
                        disabled
                        sx={{
                            '& .MuiSelect-icon': {
                                display: 'none',
                            },
                        }}
                    >
                        <MenuItem value={1}>Activo</MenuItem>
                        <MenuItem value={0}>Inactivo</MenuItem>
                        <MenuItem value="na">N/A</MenuItem>
                    </Field.Select>

                    <Field.DatePicker
                        name="FechaInicioCI"
                        label="Fecha inicio CI"
                        format="DD/MM/YYYY"
                        views={['year', 'month', 'day']}
                    />

                    <Field.DatePicker
                        name="FechaVencimientoCI"
                        label={`Fecha vencimiento CI${diasRestantesCI !== null && diasRestantesCI <= 365
                                ? ` (${diasRestantesCI >= 0
                                    ? `${diasRestantesCI} días restantes`
                                    : `vencido hace ${Math.abs(diasRestantesCI)} días`
                                })`
                                : ''
                            }`}
                        format="DD/MM/YYYY"
                        views={['year', 'month', 'day']}
                        disabled
                        sx={{
                            '& .MuiInputAdornment-root': {
                                display: 'none',
                            },
                        }}
                    />
                </>
            )}
        </Box>
    );

    if (!isEdit) {
        return Content;
    }

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
                    Instructor CI
                </Typography>
            </AccordionSummary>

            <AccordionDetails>
                {Content}
            </AccordionDetails>
        </Accordion>
    );
}