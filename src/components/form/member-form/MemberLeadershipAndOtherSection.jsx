import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';

import { NIVELES_DIRECTIVA } from 'src/services/directivas-organizacionales-service';
import {
    MEMBER_GENDERS,
    MEMBER_SHIRT_SIZES,
    MEMBER_OCUPATIONS_SORTED,
} from 'src/catalogs/member-catalogs';

import { Field } from 'src/components/hook-form';
import DashedAccordion from 'src/components/expandable/DashedAccordion';
import { EmptyReadOnlyField } from 'src/components/empty-readonly-field';
import CargoSelectApi from 'src/components/api/cargo-institucional-select-api';

const getRowsFromApi = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.Data)) return payload.Data;
    if (Array.isArray(payload?.items)) return payload.items;

    return [];
};

const normalizeDest = (dest) => {
    const id = dest?.idDestacamento ?? dest?.id ?? dest?.value;
    const name = dest?.nombre ?? dest?.name ?? dest?.label ?? '';
    const destNumber = dest?.numero ?? dest?.destNumber ?? '';

    return {
        id: String(id ?? ''),
        name: name || `Destacamento ${id}`,
        destNumber,
    };
};

export default function MemberLeadershipAndOtherSection({
    watch,
    methods,
    isCreateView,
    isEdit,
    dests: initialDests = [],
    // Bloquea destacamento, posicion en el destacamento y sexo (p. ej. para
    // Lider de Grupo / Lider Asistente de Grupo).
    lockCoreFields = false,
    // Solo lectura (p. ej. Director Nacional): deshabilita todos los selects.
    readOnly = false,
}) {
    const disabledCore = lockCoreFields || readOnly;
    // En solo lectura, un campo sin valor se muestra como "Sin informacion registrada".
    const emptyInReadOnly = (value) => readOnly && !value;

    const [dests, setDests] = useState(Array.isArray(initialDests) ? initialDests : []);

    useEffect(() => {
        if (Array.isArray(initialDests) && initialDests.length) {
            setDests(initialDests.map(normalizeDest).filter((dest) => dest.id));
            return undefined;
        }

        const load = async () => {
            const res = await fetch('/api/dest/');
            const data = await res.json();
            setDests(getRowsFromApi(data).map(normalizeDest).filter((dest) => dest.id));
        };

        load();
        return undefined;
    }, [initialDests]);

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
            {/* Ocupación */}
            {emptyInReadOnly(watch('ocupation')) ? (
                <EmptyReadOnlyField label="Ocupación" />
            ) : (
                <Field.Autocomplete
                    name="ocupation"
                    label="Ocupación"
                    disabled={readOnly}
                    options={MEMBER_OCUPATIONS_SORTED}
                    getOptionLabel={(option) =>
                        typeof option === 'string' ? option : option?.label || ''
                    }
                    isOptionEqualToValue={(option, value) => option.value === value?.value}
                    ListboxProps={{ sx: { maxHeight: 260 } }}
                />
            )}

            {/* Liderazgo Nacional */}
            <CargoSelectApi
                name="nationalLeadershipRole"
                label="Cargo Nacional"
                niveles={[
                    NIVELES_DIRECTIVA.nacional,
                    NIVELES_DIRECTIVA.regional,
                    NIVELES_DIRECTIVA.seccional,
                ]}
                groupByLevel
                includeNone
                noneLabel="Ninguno"
                disabled={disabledCore}
            />

            {/* Destacamento */}
            {emptyInReadOnly(watch('destId')) ? (
                <EmptyReadOnlyField label="Tu Destacamento" />
            ) : (
                <Field.Autocomplete
                    name="destId"
                    label="Tu Destacamento"
                    disabled={disabledCore}
                    options={dests}
                    freeSolo={false}
                    value={dests.find((d) => String(d.id) === String(watch('destId'))) || null}
                    getOptionLabel={(option) =>
                        typeof option === 'string'
                            ? option
                            : `${option?.name || ''} ${option?.destNumber || ''}`.trim()
                    }
                    isOptionEqualToValue={(option, value) => String(option.id) === String(value?.id)}
                    onChange={(event, option) => {
                        methods.setValue('destId', option?.id || '', { shouldDirty: true });
                    }}
                />
            )}

            {/* Posición en destacamento */}
            <CargoSelectApi
                name="memberPosition"
                label="Nivel posición en tu Destacamento"
                niveles={[NIVELES_DIRECTIVA.destacamento]}
                groupByDivision
                includeNone
                disabled={disabledCore}
            />

            {/* Sexo */}
            {emptyInReadOnly(watch('gender')) ? (
                <EmptyReadOnlyField label="Sexo" />
            ) : (
                <Field.Autocomplete
                    name="gender"
                    label="Sexo"
                    disabled={disabledCore}
                    options={MEMBER_GENDERS}
                    getOptionLabel={(option) =>
                        typeof option === 'string' ? option : option?.label || ''
                    }
                    isOptionEqualToValue={(option, value) =>
                        option.value === value?.value
                    }
                />
            )}

            {/* T-shirt */}
            {emptyInReadOnly(watch('shirtSize')) ? (
                <EmptyReadOnlyField label="Size T-Shirt" />
            ) : (
                <Field.Select name="shirtSize" label="Size T-Shirt" disabled={readOnly}>
                    {MEMBER_SHIRT_SIZES.map((size) => (
                        <MenuItem key={size.value} value={size.value}>
                            {size.label}
                        </MenuItem>
                    ))}
                </Field.Select>
            )}
        </Box>
    );

    if (!isEdit) {
        return Content;
    }

    return (
        <DashedAccordion title="Destacamento, posición, otros..">
            {Content}
        </DashedAccordion>
    );
}
