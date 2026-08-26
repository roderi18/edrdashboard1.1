import { useState, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { getSectionScopeIds, isSectionScopedManager } from 'src/utils/org-level-access';

import { getSectionals } from 'src/services/sectional-service';

import { Field } from 'src/components/hook-form';
import NameInput from 'src/components/common/name-input';
import LocationSelect from 'src/components/location/location-select';

import { useAuthContext } from 'src/auth/hooks';

export default function ChurchDestSection({
    isCreateView,
    methods,
    disabled = false,
    // El telefono y el correo de contacto los lleva tambien el Coordinador de
    // Destacamento, asi que no comparten candado con el resto de la ficha de la
    // iglesia.
    contactDisabled = disabled,
    lockedSectional = null,
    // Ids de region a los que se acota el desplegable de Sección (Coordinador
    // Regional y Sub-Director Regional: solo las secciones de su propia región).
    // `null` = sin acotar.
    allowedRegionIds = null,
}) {
    const [allSectionals, setAllSectionals] = useState([]);
    const { watch, setValue, control } = useFormContext();
    const { user } = useAuthContext();

    // Coordinador/Sub-Coordinador Seccional: solo puede crear en su propia
    // sección, así que en vez de un desplegable se muestra su sección como texto
    // deshabilitado y se fija `sectionId` a ella.
    const lockToOwnSection = isSectionScopedManager(user);
    const ownSectionId = lockToOwnSection ? [...getSectionScopeIds(user)][0] : null;

    // Secciones ofrecidas. Un cargo regional solo puede crear dentro de su región,
    // así que las de otras regiones ni siquiera aparecen como opción.
    const sectionals =
        allowedRegionIds instanceof Set && allowedRegionIds.size
            ? allSectionals.filter((sectional) =>
                allowedRegionIds.has(
                    String(sectional?.regionalId ?? sectional?.idRegion ?? sectional?.regionId ?? '')
                )
            )
            : allSectionals;

    // Identificadores del propio usuario, para resolver su sección cuando el
    // alcance de la sesión no la trae (se deriva de la sección cuyo director es
    // este coordinador).
    const userMemberKeys = [user?.idMiembros, user?.id, user?.memberId, user?.codigoMiembro]
        .filter((value) => value !== null && value !== undefined && value !== '')
        .map((value) => String(value));

    // 1) Por alcance (secciones/seccionId de la sesión).
    const sectionalByScope =
        ownSectionId != null
            ? sectionals.find(
                (s) =>
                    String(s.id) === String(ownSectionId) ||
                    String(s.idSeccion) === String(ownSectionId)
            )
            : null;

    // 2) Fallback: la sección cuyo director es este coordinador.
    const sectionalByDirector = lockToOwnSection
        ? sectionals.find((s) => s.directorId && userMemberKeys.includes(String(s.directorId)))
        : null;

    // Prioridad: sección resuelta por el formulario padre (deriva de la membresía
    // del usuario), luego por alcance, luego por director.
    const ownSectional = lockedSectional || sectionalByScope || sectionalByDirector || null;

    useEffect(() => {
        const loadSectionals = async () => {
            const data = await getSectionals();
            setAllSectionals(Array.isArray(data) ? data : []);
        };

        loadSectionals();
    }, []);

    // Fija la sección propia en el formulario cuando el rol está acotado.
    useEffect(() => {
        if (lockToOwnSection && ownSectional?.id) {
            setValue('sectionId', String(ownSectional.id), {
                shouldValidate: true,
                shouldDirty: true,
            });
        }
    }, [lockToOwnSection, ownSectional?.id, setValue]);

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
                    label="Nombre de Iglesia"
                    maxLength={100}
                    allowNumbers
                    allowPunctuation
                    disabled={disabled}
                />

                <NameInput
                    name="pastor"
                    label="Pastor"
                    maxLength={100}
                    disabled={disabled}
                />

                <Controller
                    name="telefono"
                    control={control}
                    render={({ field }) => (
                        <Field.Phone
                            {...field}
                            label="Teléfono"
                            defaultCountry="DO"
                            disabled={contactDisabled}
                            inputProps={{ maxLength: 14 }}
                        />
                    )}
                />

                <LocationSelect disabled={disabled} />

                <Field.Text
                    name="correo"
                    label="Correo"
                    type="email"
                    disabled={contactDisabled}
                />


                {lockToOwnSection ? (
                    <TextField
                        label="Sección"
                        value={ownSectional?.sectionalName || ''}
                        disabled
                        fullWidth
                    />
                ) : (
                    <Field.Autocomplete
                        name="sectionId"
                        label="Sección"
                        disabled={disabled}
                        options={sectionals}
                        getOptionLabel={(option) =>
                            typeof option === 'string'
                                ? option
                                : option?.sectionalName || ''
                        }
                        isOptionEqualToValue={(option, value) =>
                            String(option.id) === String(value?.id)
                        }
                        value={
                            sectionals.find(
                                (s) => String(s.id) === watch('sectionId')
                            ) || null
                        }
                        onChange={(event, option) => {
                            if (disabled) return;

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
                )}
            </Box>
        </Box>
    );
}
