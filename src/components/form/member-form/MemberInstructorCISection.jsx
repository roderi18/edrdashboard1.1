import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { NIVELES_SENDA_INSTRUCTOR } from 'src/utils/senda-instructor.mjs';

import { leerSendaInstructor, guardarSendaInstructor } from 'src/services/senda-instructor-service';

import { toast } from 'src/components/snackbar';
import { Field } from 'src/components/hook-form';
import DashedAccordion from 'src/components/expandable/DashedAccordion';

import { useAuthContext } from 'src/auth/hooks';

export default function MemberInstructorCISection({
    instructorCI,
    diasRestantesCI,
    isEdit = false,
    disabled = false,
    // Para la Senda del Instructor, que se guarda aparte (Firestore) y al momento.
    idMiembro = null,
}) {
    const { user: usuario } = useAuthContext();
    const [senda, setSenda] = useState([]);

    useEffect(() => {
        let vigente = true;
        leerSendaInstructor(idMiembro)
            .then((nivel) => vigente && setSenda(nivel))
            .catch(() => {});
        return () => {
            vigente = false;
        };
    }, [idMiembro]);

    const cambiarSenda = async (nivel, marcado) => {
        const anterior = senda;
        const niveles = marcado ? [...senda, nivel] : senda.filter((n) => n !== nivel);
        setSenda(niveles);
        try {
            await guardarSendaInstructor({ idMiembro, niveles, usuario });
            toast.success('Senda del Instructor guardada.');
        } catch (error) {
            console.error('[senda del instructor] no se pudo guardar', error);
            setSenda(anterior);
            toast.error('No se pudo guardar la Senda del Instructor.');
        }
    };

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

            {/* Senda del Instructor: en el mismo contenedor, debajo de Instructor CI,
                y solo si "¿Instructor Certificado?" es Sí. */}
            {idMiembro && instructorCI === 1 && (
                <>
                    <Typography variant="subtitle2" sx={{ gridColumn: '1 / -1', mt: 1 }}>
                        Senda del Instructor
                    </Typography>
                    <Box sx={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
                        {NIVELES_SENDA_INSTRUCTOR.map((n) => (
                            <FormControlLabel
                                key={n.value}
                                label={n.label}
                                // Calificado y Especializado aún no se otorgan.
                                disabled={disabled || n.deshabilitado}
                                control={
                                    <Checkbox
                                        checked={senda.includes(n.value)}
                                        onChange={(event) => cambiarSenda(n.value, event.target.checked)}
                                    />
                                }
                            />
                        ))}
                    </Box>
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