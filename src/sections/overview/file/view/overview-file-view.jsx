'use client';

import { useBoolean } from 'minimal-shared/hooks';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { CONFIG } from 'src/global-config';
import { DashboardContent } from 'src/layouts/dashboard';
import {
  FIREBASE_STORAGE_LIMIT_BYTES,
  getFirebaseStorageUsageSummary,
  createEmptyStorageUsageSummary,
} from 'src/services/firebase-storage-usage-service';

import { Iconify } from 'src/components/iconify';
import { UploadBox } from 'src/components/upload';
import { Scrollbar } from 'src/components/scrollbar';

import { FileWidget } from '../../../file-manager/file-widget';
import { FileUpgrade } from '../../../file-manager/file-upgrade';
import { FileRecentItem } from '../../../file-manager/file-recent-item';
import { FileDataActivity } from '../../../file-manager/file-data-activity';
import { FileManagerPanel } from '../../../file-manager/file-manager-panel';
import { FileStorageOverview } from '../../../file-manager/file-storage-overview';
import { FileManagerFolderItem } from '../../../file-manager/file-manager-folder-item';
import { FileManagerCreateFolderDialog } from '../../../file-manager/file-manager-create-folder-dialog';

// ----------------------------------------------------------------------

const CATEGORY_ICONS = {
  images: `${CONFIG.assetsDir}/assets/icons/files/ic-img.svg`,
  media: `${CONFIG.assetsDir}/assets/icons/files/ic-video.svg`,
  documents: `${CONFIG.assetsDir}/assets/icons/files/ic-document.svg`,
  other: `${CONFIG.assetsDir}/assets/icons/files/ic-file.svg`,
  records: `${CONFIG.assetsDir}/assets/icons/files/ic-folder.svg`,
};

const buildCategoryRow = (category, icon, countLabel) => ({
  name: category.label,
  usedStorage: category.usedStorage,
  filesCount: category.filesCount,
  countLabel,
  icon: <Box component="img" src={icon} />,
});

const FILE_MANAGER_STORAGE_LINK = `${paths.dashboard.fileManager}?source=storage&view=grid`;

export function OverviewFileView() {
  const [folderName, setFolderName] = useState('');

  const [files, setFiles] = useState([]);
  const [usageSummary, setUsageSummary] = useState(createEmptyStorageUsageSummary);
  const [usageLoading, setUsageLoading] = useState(true);

  const newFilesDialog = useBoolean();
  const newFolderDialog = useBoolean();

  useEffect(() => {
    let mounted = true;

    getFirebaseStorageUsageSummary()
      .then((summary) => {
        if (mounted) {
          setUsageSummary(summary);
        }
      })
      .catch((error) => {
        if (mounted) {
          setUsageSummary({
            ...createEmptyStorageUsageSummary(),
            error: error?.message || 'No se pudo leer Firebase Storage.',
          });
        }
      })
      .finally(() => {
        if (mounted) {
          setUsageLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleChangeFolderName = useCallback((event) => {
    setFolderName(event.target.value);
  }, []);

  const handleCreateFolder = useCallback(() => {
    newFolderDialog.onFalse();
    setFolderName('');
    console.info('CREATE NEW FOLDER');
  }, [newFolderDialog]);

  const handleDrop = useCallback(
    (acceptedFiles) => {
      setFiles([...files, ...acceptedFiles]);
    },
    [files]
  );

  const storageOverviewData = [
    buildCategoryRow(usageSummary.categories.images, CATEGORY_ICONS.images),
    buildCategoryRow(usageSummary.categories.media, CATEGORY_ICONS.media),
    buildCategoryRow(usageSummary.categories.documents, CATEGORY_ICONS.documents),
    buildCategoryRow(usageSummary.categories.other, CATEGORY_ICONS.other),
    {
      name: 'Registros',
      usedStorage: 0,
      filesCount: usageSummary.recordsCount,
      countLabel: `${usageSummary.recordsCount} registros`,
      icon: <Box component="img" src={CATEGORY_ICONS.records} />,
    },
  ];

  const renderStorageOverview = () => (
    <FileStorageOverview
      total={FIREBASE_STORAGE_LIMIT_BYTES}
      chart={{ series: usageSummary.percentUsed, used: usageSummary.usedBytes }}
      data={storageOverviewData}
    />
  );

  const renderUploadFilesDialog = () => (
    <FileManagerCreateFolderDialog open={newFilesDialog.value} onClose={newFilesDialog.onFalse} />
  );

  const renderCreateFolderDialog = () => (
    <FileManagerCreateFolderDialog
      open={newFolderDialog.value}
      onClose={newFolderDialog.onFalse}
      title="Agregar carpeta"
      folderName={folderName}
      onChangeFolderName={handleChangeFolderName}
      onCreate={handleCreateFolder}
    />
  );

  return (
    <>
      <DashboardContent maxWidth="xl">
        <Grid container spacing={3}>
          <Grid sx={{ display: { xs: 'block', sm: 'none' } }} size={12}>
            {renderStorageOverview()}
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <FileWidget
              title="Imágenes"
              value={usageSummary.categories.images.usedStorage}
              total={FIREBASE_STORAGE_LIMIT_BYTES}
              icon={
                <Box
                  component="img"
                  alt="Imágenes"
                  src={CATEGORY_ICONS.images}
                  sx={{ width: 48, height: 48 }}
                />
              }
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <FileWidget
              title="Multimedia"
              value={usageSummary.categories.media.usedStorage}
              total={FIREBASE_STORAGE_LIMIT_BYTES}
              icon={
                <Box
                  component="img"
                  alt="Multimedia"
                  src={CATEGORY_ICONS.media}
                  sx={{ width: 48, height: 48 }}
                />
              }
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <FileWidget
              title="Documentos"
              value={usageSummary.categories.documents.usedStorage}
              total={FIREBASE_STORAGE_LIMIT_BYTES}
              icon={
                <Box
                  component="img"
                  alt="Documentos"
                  src={CATEGORY_ICONS.documents}
                  sx={{ width: 48, height: 48 }}
                />
              }
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6, lg: 8 }}>
            <FileDataActivity
              title="Actividad de datos"
              subheader={
                usageLoading
                  ? 'Leyendo Firebase Storage...'
                  : usageSummary.error || `${usageSummary.totalFiles} archivos en Storage`
              }
              chart={usageSummary.activityChart}
            />

            <Box sx={{ mt: 5 }}>
              <FileManagerPanel
                title="Carpetas"
                link={FILE_MANAGER_STORAGE_LINK}
                onOpen={newFolderDialog.onTrue}
              />

              <Scrollbar sx={{ mb: 3, minHeight: 186 }}>
                <Box sx={{ gap: 3, display: 'flex' }}>
                  {usageSummary.folders.map((folder) => (
                    <FileManagerFolderItem
                      key={folder.id}
                      folder={folder}
                      onDelete={() => console.info('ELIMINAR', folder.id)}
                      sx={{
                        ...(usageSummary.folders.length > 3 && {
                          width: 240,
                          flexShrink: 0,
                        }),
                      }}
                    />
                  ))}
                </Box>
              </Scrollbar>

              <FileManagerPanel
                title="Archivos recientes"
                link={FILE_MANAGER_STORAGE_LINK}
                onOpen={newFilesDialog.onTrue}
              />

              <Box sx={{ gap: 2, display: 'flex', flexDirection: 'column' }}>
                {usageSummary.recentFiles.slice(0, 5).map((file) => (
                  <FileRecentItem
                    key={file.id}
                    file={file}
                    onDelete={() => console.info('ELIMINAR', file.id)}
                  />
                ))}
              </Box>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
            <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
              <UploadBox
                onDrop={handleDrop}
                placeholder={
                  <Box
                    sx={{
                      gap: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      color: 'text.disabled',
                      flexDirection: 'column',
                    }}
                  >
                    <Iconify icon="eva:cloud-upload-fill" width={40} />
                    <Typography variant="body2">Subir archivo</Typography>
                  </Box>
                }
                sx={{
                  py: 2.5,
                  width: 'auto',
                  height: 'auto',
                  borderRadius: 1.5,
                }}
              />

              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>{renderStorageOverview()}</Box>

              <FileUpgrade />
            </Box>
          </Grid>
        </Grid>
      </DashboardContent>

      {renderUploadFilesDialog()}
      {renderCreateFolderDialog()}
    </>
  );
}
