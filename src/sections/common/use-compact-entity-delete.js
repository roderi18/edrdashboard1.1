import { useCallback } from 'react';

import { toast } from 'src/components/snackbar';

// ----------------------------------------------------------------------

export function useCompactEntityDelete({
  table,
  tableData,
  setTableData,
  dataInPageLength,
  dataFilteredLength,
  deleteItem,
  getRowId = (row) => row.id,
  singleSuccessMessage,
  singleErrorMessage,
  multipleSuccessMessage,
  multipleErrorMessage,
}) {
  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        const resultado = await deleteItem(id);

        // No se borro, pero tampoco fallo nada: falta un paso previo (p. ej.
        // mover los miembros). Se avisa y se deja la fila donde estaba, sin
        // registrar un error que no existe.
        if (resultado?.noSePudo) {
          toast.warning(resultado.motivo || singleErrorMessage);
          return;
        }

        const deleteRow = tableData.filter((row) => getRowId(row) !== id);

        toast.success(singleSuccessMessage);
        setTableData(deleteRow);
        table.onUpdatePageDeleteRow(dataInPageLength);
      } catch (error) {
        console.error(error);
        toast.error(error?.message || singleErrorMessage);
      }
    },
    [
      dataInPageLength,
      deleteItem,
      getRowId,
      setTableData,
      singleErrorMessage,
      singleSuccessMessage,
      table,
      tableData,
    ]
  );

  const handleDeleteRows = useCallback(async () => {
    try {
      const resultados = await Promise.all(
        table.selected.map(async (id) => ({ id, resultado: await deleteItem(id) }))
      );

      // Se quitan de la tabla SOLO los que se borraron de verdad. Antes se
      // quitaban todos los seleccionados, asi que uno que no se pudo borrar
      // desaparecia de la vista y reaparecia al recargar.
      const noBorrados = resultados.filter(({ resultado }) => resultado?.noSePudo);
      const borrados = resultados
        .filter(({ resultado }) => !resultado?.noSePudo)
        .map(({ id }) => id);

      const deleteRows = tableData.filter((row) => !borrados.includes(getRowId(row)));

      if (borrados.length) {
        toast.success(multipleSuccessMessage);
        setTableData(deleteRows);
        table.onUpdatePageDeleteRows(dataInPageLength, dataFilteredLength);
      }

      noBorrados.forEach(({ resultado }) => {
        toast.warning(resultado.motivo || multipleErrorMessage);
      });
    } catch (error) {
      console.error(error);
      toast.error(error?.message || multipleErrorMessage);
    }
  }, [
    dataFilteredLength,
    dataInPageLength,
    deleteItem,
    getRowId,
    multipleErrorMessage,
    multipleSuccessMessage,
    setTableData,
    table,
    tableData,
  ]);

  return { handleDeleteRow, handleDeleteRows };
}
