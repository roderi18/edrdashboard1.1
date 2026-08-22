import { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';

import { Field } from 'src/components/hook-form';
import NameInput from 'src/components/common/name-input';
import { MaskedField } from 'src/components/masked-field';
import { EmptyReadOnlyField } from 'src/components/empty-readonly-field';

// 🔥 BUILDER
const buildSectores = (distritos, secciones, barrios) => {
    const sectores = [];

    const getMunicipioIdFromSeccion = (seccionId) => {
        const seccion = secciones.find(s => s.id === seccionId);
        return seccion?.municipioId;
    };

    barrios.forEach(b => {
        const municipio_id = getMunicipioIdFromSeccion(b.seccionId);
        if (municipio_id) {
            sectores.push({
                id: b.id,
                nombre: b.nombre,
                municipio_id
            });
        }
    });

    return sectores;
};

export default function LocationSelect({ disabled = false, masked = false }) {
    const { watch, setValue } = useFormContext();
    const provinceId = watch('provinceId');
    const municipioId = watch('municipioId');
    const hasRegisteredValue = (value) =>
        value !== null && value !== undefined && String(value).trim() !== '';

    const [provinces, setProvinces] = useState([]);
    const [municipios, setMunicipios] = useState([]);
    const [sectores, setSectores] = useState([]);
    const selectedMunicipio = municipios.find(
        m => String(m.id) === String(municipioId)
    );
    useEffect(() => {
        Promise.all([
            import('src/data/provincias.json'),
            import('src/data/municipios.json'),
            import('src/data/distritos.json'),
            import('src/data/secciones.json'),
            import('src/data/barrios.json'),
            import('src/data/sub_barrios.json'),
        ]).then(([prov, mun, dis, sec, bar, sub]) => {
            setProvinces(prov.default);

            setMunicipios(
                mun.default.map((m, index) => ({
                    ...m,
                    id: index + 1,
                    municipioId: index + 1,
                }))
            );

            setSectores(buildSectores(dis.default, sec.default, bar.default));
        });
    }, []);

    return (
        <>
            {/* PROVINCIA */}
            {masked && !hasRegisteredValue(provinceId) ? (
                <EmptyReadOnlyField label="Provincia" />
            ) : (
                <Field.Autocomplete
                    name="provinceId"
                    label="Provincia"
                    disabled={disabled}
                    options={provinces}
                    getOptionLabel={(option) => option?.nombre || ''}
                    isOptionEqualToValue={(option, value) => String(option.id) === String(value?.id)}
                    value={provinces.find(p => String(p.id) === String(provinceId)) || null}
                    onChange={(e, option) => {
                        if (disabled) return;

                        setValue('provinceId', option?.id ? String(option.id) : '', { shouldDirty: true });
                        setValue('municipioId', '', { shouldDirty: true });
                        setValue('sectorId', '', { shouldDirty: true });
                    }}
                />
            )}

            {/* MUNICIPIO. Enmascarado SIEMPRE para quien no ve la direccion: junto
                con el sector ubica a la persona, y decir "sin informacion" cuando
                no hay nada tambien dice algo de ella. */}
            {masked ? (
                <MaskedField label="Municipio" preset="text" />
            ) : (
                <Field.Autocomplete
                    name="municipioId"
                    label="Municipio"
                    disabled={disabled}
                    options={municipios.filter(m => String(m.provinciaId) === String(provinceId))}
                    getOptionLabel={(option) => option?.nombre || ''}
                    isOptionEqualToValue={(option, value) => String(option.id) === String(value?.id)}
                    value={
                        municipios.find(m => String(m.id) === String(municipioId)) || null
                    }
                    noOptionsText={
                        provinceId
                            ? 'Sin opciones'
                            : 'Primero elegir Provincia'
                    }
                    onChange={(e, option) => {
                        if (disabled) return;

                        setValue('municipioId', option?.id ? String(option.id) : '', { shouldDirty: true });
                        setValue('sectorId', '', { shouldDirty: true });
                    }}
                />
            )}

            {/* SECTOR */}
            {masked ? (
                <MaskedField label="Sector" preset="text" />
            ) : (
                <Field.Autocomplete
                    name="sectorId"
                    label="Sector"
                    disabled={disabled}
                    options={sectores.filter(
                        s => String(s.municipio_id) === String(selectedMunicipio?.municipioId)
                    )}
                    getOptionLabel={(option) => option?.nombre || ''}
                    getOptionKey={(option) => option.id}
                    isOptionEqualToValue={(option, value) => option.id === value?.id}
                    value={sectores.find(s => String(s.id) === watch('sectorId')) || null}
                    noOptionsText={
                        watch('municipioId')
                            ? 'Sin opciones'
                            : 'Primero elegir Municipio'
                    }
                    onChange={(e, option) => {
                        if (disabled) return;

                        setValue('sectorId', option?.id ? String(option.id) : '', { shouldDirty: true });
                    }}
                />
            )}

            {masked ? (
                <MaskedField label="Calle / Número" preset="text" />
            ) : (
                <NameInput
                    name="street"
                    label="Calle / Número"
                    allowNumbers
                    allowSpecialChars
                    maxLength={50}
                    disabled={disabled}
                />
            )}
        </>
    );
}
