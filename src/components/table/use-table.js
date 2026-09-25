'use client';

import { useState , useEffect, useCallback } from 'react';

import { useTheme, useMediaQuery } from '@mui/material';
// ----------------------------------------------------------------------

export function useTable(props) {
  const defaultDense = !!props?.defaultDense;

  const [dense, setDense] = useState(defaultDense);

  const [page, setPage] = useState(props?.defaultCurrentPage ?? 0);

  const [orderBy, setOrderBy] = useState(props?.defaultOrderBy ?? 'name');

  const [rowsPerPage, setRowsPerPage] = useState(props?.defaultRowsPerPage ?? 5);

  const [order, setOrder] = useState(props?.defaultOrder ?? 'asc');

  const [selected, setSelected] = useState(props?.defaultSelected ?? []);

  // ¿El usuario ya ordenó la tabla a mano? Mientras sea `false`, la vista puede
  // aplicar su orden por defecto (p. ej. mostrar primero las entidades del
  // alcance del usuario). En cuanto pulsa una cabecera, manda su criterio.
  const [hasUserSorted, setHasUserSorted] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const onSort = useCallback(
    (id) => {
      const isAsc = orderBy === id && order === 'asc';
      if (id !== '') {
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(id);
        setHasUserSorted(true);
      }
    },
    [order, orderBy]
  );

  // Actualización funcional y sin depender de `selected`: así la función es
  // siempre la misma y las tarjetas memorizadas no se repintan todas por cada
  // clic de selección (y dos clics seguidos nunca parten de una lista vieja).
  const onSelectRow = useCallback((inputValue) => {
    setSelected((previos) =>
      previos.includes(inputValue)
        ? previos.filter((value) => value !== inputValue)
        : [...previos, inputValue]
    );
  }, []);

  const onChangeRowsPerPage = useCallback((event) => {
    setPage(0);
    setRowsPerPage(parseInt(event.target.value, 10));
  }, []);

  const onChangeDense = useCallback((event) => {
    setDense(event.target.checked);
  }, []);

  const onSelectAllRows = useCallback((checked, inputValue) => {
    if (checked) {
      setSelected(inputValue);
      return;
    }
    setSelected([]);
  }, []);

  const onChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const onResetPage = useCallback(() => {
    setPage(0);
  }, []);

  const onUpdatePageDeleteRow = useCallback(
    (totalRowsInPage) => {
      setSelected([]);
      if (page) {
        if (totalRowsInPage < 2) {
          setPage(page - 1);
        }
      }
    },
    [page]
  );

  // En movil la tabla va compacta siempre. Este efecto solo esta para eso, pero
  // al correr tambien en escritorio apagaba la vista compacta de las tablas que
  // arrancan con ella (`defaultDense`), asi que ahi se queda quieto: el
  // interruptor sigue mandando.
  useEffect(() => {
    if (defaultDense) return;

    setDense(isMobile);
  }, [isMobile, defaultDense]);

  const onUpdatePageDeleteRows = useCallback(
    (totalRowsInPage, totalRowsFiltered) => {
      const totalSelected = selected.length;

      setSelected([]);

      if (page) {
        if (totalSelected === totalRowsInPage) {
          setPage(page - 1);
        } else if (totalSelected === totalRowsFiltered) {
          setPage(0);
        } else if (totalSelected > totalRowsInPage) {
          const newPage = Math.ceil((totalRowsFiltered - totalSelected) / rowsPerPage) - 1;

          setPage(newPage);
        }
      }
    },
    [page, rowsPerPage, selected.length]
  );

  return {
    dense,
    order,
    page,
    orderBy,
    hasUserSorted,
    rowsPerPage,
    /********/
    selected,
    onSelectRow,
    onSelectAllRows,
    /********/
    onSort,
    onChangePage,
    onChangeDense,
    onResetPage,
    onChangeRowsPerPage,
    onUpdatePageDeleteRow,
    onUpdatePageDeleteRows,
    /********/
    setPage,
    setDense,
    setOrder,
    setOrderBy,
    setSelected,
    setRowsPerPage,
    setHasUserSorted,
  };
}
