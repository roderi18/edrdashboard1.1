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
}) {

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
            <Field.Autocomplete
                name="ocupation"
                label="Ocupación"
                options={MEMBER_OCUPATIONS_SORTED}
                getOptionLabel={(option) =>
                    typeof option === 'string' ? option : option?.label || ''
                }
                isOptionEqualToValue={(option, value) => option.value === value?.value}
                ListboxProps={{ sx: { maxHeight: 260 } }}
            />

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
            />

            {/* Destacamento */}
            <Field.Autocomplete
                name="destId"
                label="Tu Destacamento"
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
                    methods.setValue('destId', option?.id || '');
                }}
            />

            {/* Posición en destacamento */}
            <CargoSelectApi
                name="memberPosition"
                label="Nivel posición en tu Destacamento"
                niveles={[NIVELES_DIRECTIVA.destacamento]}
                groupByDivision
                includeNone
            />

            {/* Sexo */}
            <Field.Autocomplete
                name="gender"
                label="Sexo"
                options={MEMBER_GENDERS}
                getOptionLabel={(option) =>
                    typeof option === 'string' ? option : option?.label || ''
                }
                isOptionEqualToValue={(option, value) =>
                    option.value === value?.value
                }
            />

            {/* T-shirt */}
            <Field.Select name="shirtSize" label="Size T-Shirt">
                {MEMBER_SHIRT_SIZES.map((size) => (
                    <MenuItem key={size.value} value={size.value}>
                        {size.label}
                    </MenuItem>
                ))}
            </Field.Select>
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
