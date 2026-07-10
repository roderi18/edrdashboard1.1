import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';

import { Field } from 'src/components/hook-form';
import DashedAccordion from 'src/components/expandable/DashedAccordion';

export default function MemberInstructorCISection({
    instructorCI,
    diasRestantesCI,
    isEdit = false,
    disabled = false,
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
                disabled={disabled}
                sx={disabled ? { '& .MuiSelect-icon': { display: 'none' } } : undefined}
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
                        disabled={disabled}
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
        <DashedAccordion title="Instructor CI">
            {Content}
        </DashedAccordion>
    );
}