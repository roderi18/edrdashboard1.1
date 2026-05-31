'use client';

import { useFormContext } from 'react-hook-form';
import { useMemo, useState, useEffect } from 'react';

import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import ListSubheader from '@mui/material/ListSubheader';

import {
  NIVELES_DIRECTIVA,
  obtenerCargosDirectivaCached,
} from 'src/services/directivas-organizacionales-service';

import { Iconify } from 'src/components/iconify';

const NIVEL_LABELS = {
  [NIVELES_DIRECTIVA.nacional]: 'Consejo Nacional y Ejecutivo',
  [NIVELES_DIRECTIVA.regional]: 'Regiones',
  [NIVELES_DIRECTIVA.seccional]: 'Secciones',
  [NIVELES_DIRECTIVA.destacamento]: 'Destacamento',
};

const NIVEL_ORDER = [
  NIVELES_DIRECTIVA.nacional,
  NIVELES_DIRECTIVA.regional,
  NIVELES_DIRECTIVA.seccional,
  NIVELES_DIRECTIVA.destacamento,
];

const NONE_OPTION = {
  value: 'none',
  label: 'Ninguna',
  groupLabel: '',
  isNone: true,
};

const getCargoValue = (cargo) => cargo?.idPosicionDirectiva || cargo?.id || cargo?.idCargo || '';

const getCargoLabel = (cargo, { showDivision = true } = {}) => {
  const name = cargo?.nombreCargo || cargo?.nombre || cargo?.label || '';

  if (showDivision && cargo?.nombreDivision) {
    return `${name} (${cargo.nombreDivision})`;
  }

  return name;
};

const sortCargos = (cargos = []) =>
  [...cargos].sort((a, b) => {
    const levelA = NIVEL_ORDER.indexOf(a.nivel);
    const levelB = NIVEL_ORDER.indexOf(b.nivel);
    const levelCompare = (levelA === -1 ? 999 : levelA) - (levelB === -1 ? 999 : levelB);

    if (levelCompare !== 0) return levelCompare;

    const divisionCompare = String(a.division || '').localeCompare(String(b.division || ''));
    if (divisionCompare !== 0) return divisionCompare;

    return Number(a.orden || 0) - Number(b.orden || 0);
  });

export default function CargoSelectApi({
  name,
  label = 'Cargo Nacional',
  nivel = '',
  niveles = [],
  groupByLevel = false,
  groupByDivision = false,
  includeNone = false,
  helperText,
}) {
  const { setValue, watch } = useFormContext();

  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openGroups, setOpenGroups] = useState({});

  const selectedLevels = useMemo(() => {
    const values = Array.isArray(niveles) && niveles.length ? niveles : [nivel].filter(Boolean);

    return values.map(String);
  }, [nivel, niveles]);

  const selectedLevelsKey = selectedLevels.join('|');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);

      try {
        const data = await obtenerCargosDirectivaCached({ incluirNoAsignables: false });

        if (!isMounted) return;

        const levels = selectedLevelsKey ? selectedLevelsKey.split('|') : [];

        setCargos(
          sortCargos(data).filter((cargo) =>
            levels.length ? levels.includes(String(cargo.nivel)) : true
          )
        );
      } catch {
        if (isMounted) {
          setCargos([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [selectedLevelsKey]);

  const options = useMemo(() => {
    const cargoOptions = cargos.map((cargo) => ({
      ...cargo,
      value: getCargoValue(cargo),
      label: getCargoLabel(cargo),
      groupLabel: groupByDivision
        ? cargo.nombreDivision || 'General'
        : NIVEL_LABELS[cargo.nivel] || cargo.nivel || 'Otros',
    }));

    return includeNone ? [NONE_OPTION, ...cargoOptions] : cargoOptions;
  }, [cargos, includeNone, groupByDivision]);

  const currentValue = watch(name);
  const value =
    options.find((cargo) => String(cargo.value) === String(currentValue || '')) ||
    (includeNone && !currentValue ? NONE_OPTION : null);
  const hasCollapsibleGroups = groupByLevel || groupByDivision;
  const getGroupLabel = (option) => {
    if (groupByDivision) {
      return option?.groupLabel || 'General';
    }

    if (groupByLevel) {
      return option?.groupLabel || 'Otros';
    }

    return '';
  };
  const toggleGroup = (group) => (event) => {
    event.preventDefault();
    event.stopPropagation();

    setOpenGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  return (
    <Autocomplete
      options={options}
      value={value}
      loading={loading}
      onOpen={() => {
        if (hasCollapsibleGroups) {
          setOpenGroups({});
        }
      }}
      groupBy={hasCollapsibleGroups ? getGroupLabel : undefined}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option?.label || '')}
      isOptionEqualToValue={(option, selectedOption) =>
        String(option.value) === String(selectedOption?.value)
      }
      onChange={(_, newValue) => {
        setValue(name, newValue?.value || '', {
          shouldDirty: true,
          shouldValidate: true,
        });
      }}
      ListboxProps={{ sx: { maxHeight: 300 } }}
      renderGroup={
        hasCollapsibleGroups
          ? (params) => {
              const isOpen = !!openGroups[params.group];

              return (
                <li key={params.key}>
                  <ListSubheader
                    component="button"
                    type="button"
                    disableSticky
                    aria-expanded={isOpen}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={toggleGroup(params.group)}
                    sx={{
                      gap: 1,
                      width: 1,
                      border: 0,
                      py: 1,
                      px: 1.5,
                      display: 'flex',
                      cursor: 'pointer',
                      alignItems: 'center',
                      typography: 'body2',
                      textAlign: 'left',
                      color: 'text.secondary',
                      fontWeight: 700,
                      bgcolor: 'background.paper',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Iconify
                      width={16}
                      icon={isOpen ? 'eva:arrow-ios-downward-fill' : 'eva:arrow-ios-forward-fill'}
                    />
                    {params.group}
                  </ListSubheader>
                  {isOpen ? <ul style={{ padding: 0 }}>{params.children}</ul> : null}
                </li>
              );
            }
          : undefined
      }
      renderInput={(params) => <TextField {...params} label={label} helperText={helperText} />}
    />
  );
}
