import TableBody from '@mui/material/TableBody';

import { TableNoData, TableSkeleton, TableEmptyRows } from 'src/components/table';

// ----------------------------------------------------------------------

export function CompactEntityListView({
  loading,
  rows,
  renderRow,
  notFound,
  emptyRowsCount,
  emptyRowsHeight,
  skeletonRows,
  skeletonCellCount,
}) {
  return (
    <TableBody>
      {loading ? (
        <TableSkeleton rowCount={skeletonRows} cellCount={skeletonCellCount} />
      ) : (
        <>
          {rows.map(renderRow)}

          <TableEmptyRows height={emptyRowsHeight} emptyRows={emptyRowsCount} />

          <TableNoData notFound={notFound} />
        </>
      )}
    </TableBody>
  );
}
