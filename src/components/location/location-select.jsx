import { useEffect, useState } from 'react';
import { Field } from 'src/components/hook-form';
import { useFormContext } from 'react-hook-form';

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

export default function LocationSelect() {
    const { watch, setValue } = useFormContext();

    const [provinces, setProvinces] = useState([]);
    const [municipios, setMunicipios] = useState([]);
    const [sectores, setSectores] = useState([]);
    const selectedMunicipio = municipios.find(
        m => String(m.id) === String(watch('municipioId'))
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
            <Field.Autocomplete
                name="provinceId"
                label="Provincia"
                options={provinces}
                getOptionLabel={(option) => option?.nombre || ''}
                isOptionEqualToValue={(option, value) => String(option.id) === String(value?.id)}
                value={provinces.find(p => String(p.id) === watch('provinceId')) || null}
                onChange={(e, option) => {
                    setValue('provinceId', option?.id ? String(option.id) : '');
                    setValue('municipioId', '');
                    setValue('sectorId', '');
                }}
            />

            {/* MUNICIPIO */}
            <Field.Autocomplete
                name="municipioId"
                label="Municipio"
                options={municipios.filter(m => String(m.provinciaId) === watch('provinceId'))}
                getOptionLabel={(option) => option?.nombre || ''}
                isOptionEqualToValue={(option, value) => String(option.id) === String(value?.id)}
                value={
                    municipios.find(m => String(m.id) === String(watch('municipioId'))) || null
                }
                onChange={(e, option) => {
                    setValue('municipioId', option?.id ? String(option.id) : '');
                    setValue('sectorId', '');
                }}
            />

            {/* SECTOR */}
            <Field.Autocomplete
                name="sectorId"
                label="Sector"
                options={sectores.filter(
                    s => String(s.municipio_id) === String(selectedMunicipio?.municipioId)
                )}
                getOptionLabel={(option) => option?.nombre || ''}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                value={sectores.find(s => String(s.id) === watch('sectorId')) || null}
                onChange={(e, option) => {
                    setValue('sectorId', option?.id ? String(option.id) : '');
                }}
            />
        </>
    );
}