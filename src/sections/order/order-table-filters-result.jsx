import { useCallback } from 'react';

import Chip from '@mui/material/Chip';

import { fDateRangeShortLabel } from 'src/utils/format-time';

import { chipProps, FiltersBlock, FiltersResult } from 'src/components/filters-result';

import { ESTADOS_DE_ORDEN } from './order-status-nav';
import { METODOS_DE_PAGO_FILTRO } from './order-list-filters';

// ----------------------------------------------------------------------

export function OrderTableFiltersResult({ filters, totalResults, onResetPage, sx }) {
  const { state: currentFilters, setState: updateFilters, resetState: resetFilters } = filters;

  const handleRemoveKeyword = useCallback(() => {
    onResetPage();
    updateFilters({ name: '' });
  }, [onResetPage, updateFilters]);

  const handleRemoveStatus = useCallback(() => {
    onResetPage();
    updateFilters({ status: 'all' });
  }, [onResetPage, updateFilters]);

  const handleRemovePayment = useCallback(() => {
    onResetPage();
    updateFilters({ payment: 'all' });
  }, [onResetPage, updateFilters]);

  const handleRemoveDate = useCallback(() => {
    onResetPage();
    updateFilters({ startDate: null, endDate: null });
  }, [onResetPage, updateFilters]);

  const handleReset = useCallback(() => {
    onResetPage();
    resetFilters();
  }, [onResetPage, resetFilters]);

  return (
    <FiltersResult totalResults={totalResults} onReset={handleReset} resetLabel="Limpiar" sx={sx}>
      {/* EL ESTADO, CON EL NOMBRE QUE SE LEE EN LA COLUMNA. Se pintaba el valor
          tal cual y salia "Pending" en una pantalla en español, al lado de una
          lista que dice "Pendiente". */}
      <FiltersBlock label="Estado:" isShow={currentFilters.status !== 'all'}>
        <Chip
          {...chipProps}
          label={
            ESTADOS_DE_ORDEN.find((estado) => estado.value === currentFilters.status)?.label ||
            currentFilters.status
          }
          onDelete={handleRemoveStatus}
        />
      </FiltersBlock>

      <FiltersBlock label="Método de pago:" isShow={currentFilters.payment !== 'all'}>
        <Chip
          {...chipProps}
          label={
            METODOS_DE_PAGO_FILTRO.find((metodo) => metodo.value === currentFilters.payment)
              ?.label || currentFilters.payment
          }
          onDelete={handleRemovePayment}
        />
      </FiltersBlock>

      <FiltersBlock
        label="Fecha:"
        isShow={Boolean(currentFilters.startDate && currentFilters.endDate)}
      >
        <Chip
          {...chipProps}
          label={fDateRangeShortLabel(currentFilters.startDate, currentFilters.endDate)}
          onDelete={handleRemoveDate}
        />
      </FiltersBlock>

      <FiltersBlock label="Palabra clave:" isShow={!!currentFilters.name}>
        <Chip {...chipProps} label={currentFilters.name} onDelete={handleRemoveKeyword} />
      </FiltersBlock>
    </FiltersResult>
  );
}
