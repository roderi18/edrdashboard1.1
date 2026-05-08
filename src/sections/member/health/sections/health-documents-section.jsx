'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import TableBody from '@mui/material/TableBody';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import TableContainer from '@mui/material/TableContainer';

import { Iconify } from 'src/components/iconify';
import {
    TableHeadCustom,
    TableSelectedAction,
} from 'src/components/table';

import { FileManagerTableRow } from
    'src/sections/file-manager/file-manager-table-row';


export function HealthDocumentsSection({
    open,
    onToggle,
    renderCollapseButton,
    table,
    medicalDocuments,
    onDeleteOne,
    onDeleteSelected,
    onUpload,
    onRename,
}) {
    return (
        <Card>
            <CardHeader
                title="📁 Documentos"
                subheader="Certificados médicos, actas, seguros y autorizaciones disponibles"
                action={
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: 0.5,
                        }}
                    >
                        {renderCollapseButton(open, onToggle)}

                        {open && (
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={<Iconify icon="eva:cloud-upload-fill" />}
                                onClick={onUpload}
                            >
                                Subir
                            </Button>
                        )}
                    </Box>
                }
                sx={{ mb: 3 }}
            />

            <Collapse in={open}>
                <Divider />

                <Box
                    sx={(theme) => ({
                        position: 'relative',
                        m: { md: theme.spacing(-2, -3, 0, -3) },
                    })}
                >
                    <TableSelectedAction
                        dense
                        numSelected={table.selected.length}
                        rowCount={medicalDocuments.length}
                        onSelectAllRows={(checked) =>
                            table.onSelectAllRows(
                                checked,
                                medicalDocuments.map((row) => row.id)
                            )
                        }
                        action={
                            <>
                                <Tooltip title="Compartir">
                                    <IconButton color="primary">
                                        <Iconify icon="solar:share-bold" />
                                    </IconButton>
                                </Tooltip>

                                <Tooltip title="Eliminar">
                                    <IconButton color="primary" onClick={onDeleteSelected}>
                                        <Iconify icon="solar:trash-bin-trash-bold" />
                                    </IconButton>
                                </Tooltip>
                            </>
                        }
                        sx={{
                            pl: 1,
                            pr: 2,
                            top: 16,
                            left: 24,
                            right: 24,
                            width: 'auto',
                            borderRadius: 1.5,
                        }}
                    />

                    <TableContainer sx={{ px: { md: 3 } }}>
                        <Table
                            size="small"
                            sx={{
                                minWidth: 860,
                                borderCollapse: 'separate',
                                borderSpacing: '0 16px',
                            }}
                        >
                            {medicalDocuments.length > 0 && (
                                <TableHeadCustom
                                    headCells={[
                                        { id: 'name', label: 'Nombre' },
                                        { id: 'size', label: 'Peso', width: 180 },
                                        { id: 'modifiedAt', label: 'Fecha', width: 200 },
                                        { id: '', width: 100 },
                                    ]}
                                    rowCount={medicalDocuments.length}
                                    numSelected={table.selected.length}
                                    onSelectAllRows={(checked) =>
                                        table.onSelectAllRows(
                                            checked,
                                            medicalDocuments.map((row) => row.id)
                                        )
                                    }
                                />
                            )}

                            <TableBody>
                                {medicalDocuments.map((file) => (
                                    <FileManagerTableRow
                                        key={file.id}
                                        row={file}
                                        selected={table.selected.includes(file.id)}
                                        onSelectRow={() => table.onSelectRow(file.id)}
                                        onDeleteRow={() => onDeleteOne(file.id)}
                                        onRename={onRename}
                                        showType={false}
                                        showAvatar={false}
                                        showThumbnail
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>

                <Box sx={{ height: 8 }} />
            </Collapse>
        </Card>
    );
}