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
        await deleteItem(id);

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
      await Promise.all(table.selected.map((id) => deleteItem(id)));

      const deleteRows = tableData.filter((row) => !table.selected.includes(getRowId(row)));

      toast.success(multipleSuccessMessage);
      setTableData(deleteRows);
      table.onUpdatePageDeleteRows(dataInPageLength, dataFilteredLength);
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
