'use client';

import { Fragment, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableBody from '@mui/material/TableBody';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { Iconify } from 'src/components/iconify';
import {
    TableHeadCustom,
    TableSelectedAction,
} from 'src/components/table';

import { FileManagerTableRow } from
    'src/sections/file-manager/file-manager-table-row';

const HEALTH_DOCUMENT_SECTIONS = [
    {
        id: 'acta_nacimiento',
        title: 'Acta de nacimiento',
    },
    {
        id: 'seguro_medico',
        title: 'Seguro Médico',
    },
    {
        id: 'cedula_identidad',
        title: 'Cédula de Identidad',
    },
    {
        id: 'otros_documentos',
        title: 'Otros documentos',
    },
];

const TABLE_HEAD = [
    { id: 'name', label: 'Nombre' },
    { id: 'size', label: 'Peso', width: 180 },
    { id: 'modifiedAt', label: 'Fecha', width: 200 },
    { id: '', width: 100 },
];

function HealthDocumentSectionRow({ section, onUpload, puedeGestionar = true }) {
    return (
        <TableRow
            sx={{
                '& td': {
                    borderBottom: 0,
                },
            }}
        >
            <TableCell padding="checkbox" />

            <TableCell>
                <Typography variant="subtitle2">
                    {section.title}
                </Typography>
            </TableCell>

            <TableCell />
            <TableCell />

            <TableCell align="right" sx={{ pr: 3, pl: 1 }}>
                {puedeGestionar && (
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<Iconify icon="eva:cloud-upload-fill" />}
                        onClick={() => onUpload(section.id)}
                    >
                        Subir
                    </Button>
                )}
            </TableCell>
        </TableRow>
    );
}

function EmptyDocumentDropZone({ section, onUpload, onDropUpload }) {
    const [dragging, setDragging] = useState(false);

    const handleDrop = (event) => {
        event.preventDefault();
        setDragging(false);
        onDropUpload(section.id, event.dataTransfer.files);
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onUpload(section.id);
        }
    };

    return (
        <TableRow>
            <TableCell colSpan={5} sx={{ py: 0.5 }}>
                <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => onUpload(section.id)}
                    onKeyDown={handleKeyDown}
                    onDrop={handleDrop}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    sx={{
                        gap: 1,
                        px: 2,
                        height: 40,
                        display: 'flex',
                        cursor: 'pointer',
                        borderRadius: 1,
                        alignItems: 'center',
                        typography: 'caption',
                        color: 'text.secondary',
                        justifyContent: 'center',
                        border: '1px dashed',
                        borderColor: dragging ? 'primary.main' : 'divider',
                        bgcolor: dragging ? 'action.hover' : 'transparent',
                    }}
                >
                    <Iconify icon="eva:cloud-upload-fill" width={18} />
                    Arrastra o haz clic para subir
                </Box>
            </TableCell>
        </TableRow>
    );
}

export function HealthDocumentsSection({
    open,
    onToggle,
    renderCollapseButton,
    table,
    medicalDocuments,
    onDeleteOne,
    onDeleteSelected,
    canDelete = false,
    onUpload,
    onDropUpload,
    onRename,
    readOnly = false,
}) {
    // El Líder de Grupo / Líder Asistente no gestiona documentos (subir/eliminar);
    // solo los ve. Las operaciones sobre archivos no entran en el flujo de
    // aprobación por ser irreversibles.
    const puedeGestionar = !readOnly;
    const canDeleteDocuments = canDelete && puedeGestionar;
    const displayedDocuments = medicalDocuments.filter((file) =>
        HEALTH_DOCUMENT_SECTIONS.some((section) => section.id === file.documentCategory)
    );
    const selectedDisplayedDocuments = displayedDocuments.filter((row) =>
        table.selected.includes(row.id)
    );

    return (
        <Card>
            <CardHeader
                title="📁 Documentos"
                subheader="Seguro médico, actas de nacimiento, cédula de identidad del miembro"
                action={renderCollapseButton(open, onToggle)}
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
                        numSelected={selectedDisplayedDocuments.length}
                        rowCount={displayedDocuments.length}
                        onSelectAllRows={(checked) =>
                            table.onSelectAllRows(
                                checked,
                                displayedDocuments.map((row) => row.id)
                            )
                        }
                        action={
                            <>
                                {canDeleteDocuments && (
                                    <Tooltip title="Eliminar">
                                        <IconButton color="primary" onClick={onDeleteSelected}>
                                            <Iconify icon="solar:trash-bin-trash-bold" />
                                        </IconButton>
                                    </Tooltip>
                                )}
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
                                borderSpacing: '0 8px',
                            }}
                        >
                            <TableHeadCustom
                                headCells={TABLE_HEAD}
                                rowCount={displayedDocuments.length}
                                numSelected={selectedDisplayedDocuments.length}
                                onSelectAllRows={(checked) =>
                                    table.onSelectAllRows(
                                        checked,
                                        displayedDocuments.map((row) => row.id)
                                    )
                                }
                            />

                            <TableBody>
                                {HEALTH_DOCUMENT_SECTIONS.map((section) => {
                                    const sectionDocuments = medicalDocuments.filter(
                                        (file) => file.documentCategory === section.id
                                    );

                                    return (
                                        <Fragment key={section.id}>
                                            <HealthDocumentSectionRow
                                                section={section}
                                                onUpload={onUpload}
                                                puedeGestionar={puedeGestionar}
                                            />

                                            {sectionDocuments.map((file) => (
                                                <FileManagerTableRow
                                                    key={file.id}
                                                    row={file}
                                                    selected={table.selected.includes(file.id)}
                                                    onSelectRow={() => table.onSelectRow(file.id)}
                                                    onDeleteRow={() => onDeleteOne(file.id)}
                                                    onRename={puedeGestionar ? onRename : undefined}
                                                    canDelete={canDeleteDocuments}
                                                    showType={false}
                                                    showAvatar={false}
                                                    showThumbnail
                                                    showRowOutline={false}
                                                    showFavorite={false}
                                                    canDownload={false}
                                                    canShare={false}
                                                    canCopyLink={false}
                                                    canOpenDetails={false}
                                                />
                                            ))}

                                            {!sectionDocuments.length && puedeGestionar && (
                                                <EmptyDocumentDropZone
                                                    section={section}
                                                    onUpload={onUpload}
                                                    onDropUpload={onDropUpload}
                                                />
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>

                <Box sx={{ height: 8 }} />
            </Collapse>
        </Card>
    );
}
