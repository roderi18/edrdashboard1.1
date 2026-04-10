import Box from '@mui/material/Box';
import { Field } from 'src/components/hook-form';
import { useEffect, useState } from 'react';
import { getSectionals } from 'src/services/sectional-service';
import { useFormContext } from 'react-hook-form';
import NameInput from 'src/components/common/name-input';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

export default function ChurchDestSection({
    isCreateView,
    methods,
}) {
    const [sectionals, setSectionals] = useState([]);
    const { watch, setValue } = useFormContext();

    useEffect(() => {
        const loadSectionals = async () => {
            const data = await getSectionals();
            setSectionals(Array.isArray(data) ? data : []);
        };

        loadSectionals();
    }, []);

    return (
        <Box>
            {/* HEADER */}
            <Box
                sx={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    mb: 2,
                }}
            >
                <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />

                <Typography
                    sx={{
                        mx: 2,
                        typography: 'subtitle2',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                    }}
                >
                    Información de la Iglesia
                </Typography>

                <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />
            </Box>

            {/* CAMPOS */}
            <Box
                sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                }}
            >
                <NameInput
                    name="churchName"
                    label="Nombre de la Iglesia"
                    maxLength={100}
                    allowNumbers
                    InputProps={{
                        startAdornment: 'Iglesia ',
                    }}
                />

                <NameInput
                    name="pastor"
                    label="Pastor"
                    maxLength={100}
                />

                <Field.Text
                    name="correo"
                    label="Correo"
                    type="email"
                />

                <NameInput
                    name="address"
                    label="Dirección"
                    maxLength={100}
                    allowNumbers
                />

                <Field.Autocomplete
                    name="sectionId"
                    label="Sección"
                    options={sectionals}
                    getOptionLabel={(option) =>
                        typeof option === 'string'
                            ? option
                            : option?.sectionalName || ''
                    }
                    isOptionEqualToValue={(option, value) =>
                        option.id === value?.id
                    }
                    value={
                        sectionals.find(
                            (s) => String(s.id) === watch('sectionId')
                        ) || null
                    }
                    onChange={(event, option) => {
                        setValue(
                            'sectionId',
                            option?.id ? String(option.id) : '',
                            {
                                shouldValidate: true,
                                shouldDirty: true,
                            }
                        );
                    }}
                />
            </Box>
        </Box>
    );
}