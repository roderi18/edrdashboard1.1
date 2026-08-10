import dayjs from 'dayjs';

import TableCell from '@mui/material/TableCell';
import ListItemText from '@mui/material/ListItemText';

import { getCompletedAwards } from '../../utils/get-awards-count';
import { getLastUpdatedFromStorage } from '../../utils/get-last-updated-from-storage';

export function DefaultRow({ memberId, row, allData = [], onClick }) {

    const hideTarget = row.parentId && row.parentId !== 'academia-ministerial';
    const updatedAt = getLastUpdatedFromStorage(memberId, row.id)

    {/* esto es parte de deepsubrow sistemaAscenso */ }
    return (
        <>
            {!hideTarget && (
                <TableCell onClick={onClick}>
                    {row.target ?? '—'}
                </TableCell>
            )}

            <TableCell onClick={onClick}>
                {row.total ?? 0}
            </TableCell>

            <TableCell onClick={onClick}>
                {getCompletedAwards(memberId, row.id)}
            </TableCell>

            <TableCell onClick={onClick} sx={{ whiteSpace: 'nowrap' }}>
                {updatedAt ? (
                    <ListItemText
                        primary={dayjs(updatedAt).format('DD/MM/YYYY')}
                        secondary={dayjs(updatedAt).format('hh:mm A')}
                        slotProps={{
                            primary: { sx: { typography: 'body2' } },
                            secondary: {
                                sx: {
                                    typography: 'caption',
                                    color: 'text.disabled',
                                },
                            },
                        }}
                    />
                ) : (
                    '—'
                )}
            </TableCell>

        </>
    );
}
