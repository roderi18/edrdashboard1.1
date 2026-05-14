'use client';

import { toast } from 'sonner';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import CardContent from '@mui/material/CardContent';
import Autocomplete from '@mui/material/Autocomplete';

import {
  COVER_PHOTO_GROUPS,
  getCoverPhotoConfig,
  getCoverPhotoImageSx,
  getCoverPhotoOverrides,
  DEFAULT_COVER_PHOTO_SRC,
  resetCoverPhotoOverride,
  fetchCoverPhotoOverrides,
  uploadCoverPhotoOverride,
  memberDivisionCoverGroup,
  MEMBER_DIVISION_COVER_ITEMS,
} from 'src/utils/cover-photos';

import { Image } from 'src/components/image';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

// ----------------------------------------------------------------------

const ALL_VALUES = 'all';

const ALL_VALUE_OPTION = { id: ALL_VALUES, name: 'Todos' };

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getItemKey = ({ group, id }) => `${group}:${id}`;

const getRows = (payload) => payload?.data || payload?.Data || [];

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const normalizeApiItems = ({ group, rows }) =>
  rows
    .map((row) => {
      if (group === 'dests') {
        const id = row.idDestacamento ?? row.id ?? row.idDest ?? '';
        const number = row.numero ? ` ${row.numero}` : '';
        const name = `${row.nombre || row.name || 'Destacamento'}${number}`.trim();

        return { id: String(id), name, defaultSrc: DEFAULT_COVER_PHOTO_SRC };
      }

      if (group === 'sectionals') {
        const id = row.idSeccion ?? row.id ?? '';

        return {
          id: String(id),
          name: row.nombre || row.name || `Seccion ${id}`,
          defaultSrc: DEFAULT_COVER_PHOTO_SRC,
        };
      }

      if (group === 'regionals') {
        const id = row.idRegion ?? row.id ?? '';

        return {
          id: String(id),
          name: row.nombre || row.name || `Region ${id}`,
          defaultSrc: DEFAULT_COVER_PHOTO_SRC,
        };
      }

      return null;
    })
    .filter((item) => item?.id);

const loadGroupItems = async (group) => {
  if (group === memberDivisionCoverGroup) return MEMBER_DIVISION_COVER_ITEMS;

  const urls = {
    dests: '/api/dest',
    sectionals: '/api/sectional',
    regionals: '/api/regional',
  };

  const url = urls[group];

  if (!url) return [];

  const response = await fetch(url);
  const payload = await response.json();

  return normalizeApiItems({ group, rows: getRows(payload) });
};

export function AdminCoverPhotosView() {
  const dragStateRef = useRef(null);
  const [, setOverrides] = useState(getCoverPhotoOverrides);
  const [loadingId, setLoadingId] = useState('');
  const [activeGroup, setActiveGroup] = useState(memberDivisionCoverGroup);
  const [activeValue, setActiveValue] = useState(ALL_VALUES);
  const [groupItems, setGroupItems] = useState(MEMBER_DIVISION_COVER_ITEMS);
  const [loadingValues, setLoadingValues] = useState(false);
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    fetchCoverPhotoOverrides({ force: true }).then(setOverrides);
  }, []);

  useEffect(() => {
    let isMounted = true;

    setActiveValue(ALL_VALUES);
    setLoadingValues(true);

    loadGroupItems(activeGroup)
      .then((items) => {
        if (isMounted) setGroupItems(items);
      })
      .catch(() => {
        if (isMounted) {
          setGroupItems([]);
          toast.error('No se pudieron cargar los valores del grupo.');
        }
      })
      .finally(() => {
        if (isMounted) setLoadingValues(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeGroup]);

  const visibleItems = useMemo(
    () =>
      activeValue === ALL_VALUES
        ? groupItems
        : groupItems.filter((item) => String(item.id) === String(activeValue)),
    [activeValue, groupItems]
  );

  const valueOptions = useMemo(() => [ALL_VALUE_OPTION, ...groupItems], [groupItems]);
  const selectedValueOption = useMemo(
    () =>
      valueOptions.find((option) => String(option.id) === String(activeValue)) || ALL_VALUE_OPTION,
    [activeValue, valueOptions]
  );

  const getItemConfig = useCallback(
    (item) =>
      drafts[getItemKey({ group: activeGroup, id: item.id })] ||
      getCoverPhotoConfig({
        group: activeGroup,
        id: item.id,
        ids: [item.id, item.name],
        defaultSrc: item.defaultSrc,
      }),
    [activeGroup, drafts]
  );

  const handleSelectFile = useCallback(
    async (event, item) => {
      try {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) return;

        const itemKey = getItemKey({ group: activeGroup, id: item.id });
        const currentConfig = getItemConfig(item);
        const src = await readFileAsDataUrl(file);

        setDrafts((currentDrafts) => ({
          ...currentDrafts,
          [itemKey]: {
            ...currentConfig,
            src,
            file,
          },
        }));
      } catch (error) {
        toast.error(error?.message || 'No se pudo seleccionar la portada.');
      }
    },
    [activeGroup, getItemConfig]
  );

  const handleDraftChange = useCallback(
    (item, values) => {
      const itemKey = getItemKey({ group: activeGroup, id: item.id });

      setDrafts((currentDrafts) => ({
        ...currentDrafts,
        [itemKey]: {
          ...(currentDrafts[itemKey] || {}),
          ...values,
        },
      }));
    },
    [activeGroup]
  );

  const updateDraftPosition = useCallback((itemKey, values) => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [itemKey]: {
        ...(currentDrafts[itemKey] || {}),
        ...values,
      },
    }));
  }, []);

  const handleCoverPointerDown = useCallback(
    (event, item, draft) => {
      if (!draft) return;

      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);

      const rect = event.currentTarget.getBoundingClientRect();

      dragStateRef.current = {
        rect,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        itemKey: getItemKey({ group: activeGroup, id: item.id }),
        startPositionX: Number(draft.positionX ?? 50),
        startPositionY: Number(draft.positionY ?? 50),
        frame: null,
      };
    },
    [activeGroup]
  );

  const handleCoverPointerMove = useCallback(
    (event) => {
      const dragState = dragStateRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) return;

      const deltaX = ((event.clientX - dragState.startX) / dragState.rect.width) * 100;
      const deltaY = ((event.clientY - dragState.startY) / dragState.rect.height) * 100;
      const positionX = clamp(dragState.startPositionX - deltaX, 0, 100);
      const positionY = clamp(dragState.startPositionY - deltaY, 0, 100);

      if (dragState.frame) cancelAnimationFrame(dragState.frame);

      dragState.frame = requestAnimationFrame(() => {
        updateDraftPosition(dragState.itemKey, { positionX, positionY });
      });
    },
    [updateDraftPosition]
  );

  const handleCoverPointerUp = useCallback((event) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) return;

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragStateRef.current = null;
  }, []);

  const handleCancelDraft = useCallback(
    (item) => {
      const itemKey = getItemKey({ group: activeGroup, id: item.id });

      setDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[itemKey];

        return nextDrafts;
      });
    },
    [activeGroup]
  );

  const handleSaveDraft = useCallback(
    async (item) => {
      try {
        const itemKey = getItemKey({ group: activeGroup, id: item.id });
        const draft = drafts[itemKey];

        if (!draft?.file) return;

        setLoadingId(`${activeGroup}:${item.id}`);

        const nextOverrides = await uploadCoverPhotoOverride({
          file: draft.file,
          group: activeGroup,
          id: item.id,
          name: item.name,
          positionX: draft.positionX,
          positionY: draft.positionY,
          scale: draft.scale,
        });

        setOverrides(nextOverrides);
        handleCancelDraft(item);
        toast.success(`Portada de ${item.name} actualizada.`);
      } catch (error) {
        toast.error(error?.message || 'No se pudo actualizar la portada.');
      } finally {
        setLoadingId('');
      }
    },
    [activeGroup, drafts, handleCancelDraft]
  );

  const handleReset = useCallback(
    async (item) => {
      try {
        setLoadingId(`${activeGroup}:${item.id}`);
        setOverrides(
          await resetCoverPhotoOverride({ group: activeGroup, id: item.id, name: item.name })
        );
        handleCancelDraft(item);
        toast.success(`Portada de ${item.name} restaurada.`);
      } catch (error) {
        toast.error(error?.message || 'No se pudo restaurar la portada.');
      } finally {
        setLoadingId('');
      }
    },
    [activeGroup, handleCancelDraft]
  );

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <FormControl size="small" sx={{ minWidth: { xs: 1, md: 240 } }}>
          <InputLabel id="cover-photo-group-label">Grupo</InputLabel>
          <Select
            label="Grupo"
            value={activeGroup}
            labelId="cover-photo-group-label"
            onChange={(event) => setActiveGroup(event.target.value)}
          >
            {COVER_PHOTO_GROUPS.map((group) => (
              <MenuItem key={group.value} value={group.value}>
                {group.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Autocomplete
          size="small"
          value={selectedValueOption}
          options={valueOptions}
          loading={loadingValues}
          disabled={loadingValues || groupItems.length === 0}
          getOptionLabel={(option) => option?.name || ''}
          isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
          onChange={(_, option) => setActiveValue(option?.id || ALL_VALUES)}
          sx={{ width: { xs: 1, md: 280 } }}
          renderInput={(params) => <TextField {...params} label="Valor" />}
        />
      </Stack>

      <Alert severity="info" variant="outlined">
        Las portadas de secciones se muestran en los destacamentos. Las portadas de regiones se
        muestran en las secciones. Las portadas de divisiones se muestran segun la division o edad
        del miembro.
      </Alert>

      <Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 2.5 }}
        >
          <Box>
            <Typography variant="h6">Fotos de portadas</Typography>
          </Box>

          <Chip
            size="small"
            color="primary"
            variant="soft"
            label={`${visibleItems.length} de ${groupItems.length} portadas`}
          />
        </Stack>

        {visibleItems.length === 0 ? (
          <EmptyContent
            filled
            title={loadingValues ? 'Cargando valores...' : 'No hay valores para mostrar'}
            sx={{ py: 8 }}
          />
        ) : (
          <Box
            sx={{
              gap: 2.5,
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            {visibleItems.map((item) => {
              const itemLoadingId = `${activeGroup}:${item.id}`;
              const itemKey = getItemKey({ group: activeGroup, id: item.id });
              const draft = drafts[itemKey];
              const coverConfig = getItemConfig(item);
              const savedCoverConfig = getCoverPhotoConfig({
                group: activeGroup,
                id: item.id,
                ids: [item.id, item.name],
                defaultSrc: item.defaultSrc,
              });
              const hasCustomCover =
                savedCoverConfig.src !== (item.defaultSrc || DEFAULT_COVER_PHOTO_SRC);
              const isEditing = Boolean(draft);

              return (
                <Card key={item.id} variant="outlined" sx={{ borderRadius: 1 }}>
                  <Box
                    onPointerUp={handleCoverPointerUp}
                    onPointerMove={handleCoverPointerMove}
                    onPointerCancel={handleCoverPointerUp}
                    onPointerDown={(event) => handleCoverPointerDown(event, item, draft)}
                    sx={{
                      position: 'relative',
                      overflow: 'hidden',
                      touchAction: isEditing ? 'none' : 'auto',
                      cursor: isEditing ? 'move' : 'default',
                      '&:active': {
                        cursor: isEditing ? 'move' : 'default',
                      },
                      '&:hover .cover-photo-upload-action, &:focus-within .cover-photo-upload-action':
                        {
                          opacity: 1,
                        },
                    }}
                  >
                    <Image
                      src={coverConfig.src}
                      alt={item.name}
                      ratio="16/6"
                      visibleByDefault
                      slotProps={{
                        img: {
                          sx: getCoverPhotoImageSx(coverConfig),
                        },
                      }}
                    />

                    {isEditing && (
                      <Box
                        sx={{
                          top: '50%',
                          left: '50%',
                          zIndex: 2,
                          width: 58,
                          height: 58,
                          opacity: 0.62,
                          display: 'grid',
                          color: 'common.white',
                          pointerEvents: 'none',
                          position: 'absolute',
                          placeItems: 'center',
                          borderRadius: 1.5,
                          backdropFilter: 'blur(1px)',
                          transform: 'translate(-50%, -50%)',
                          bgcolor: 'rgba(255,255,255,0.16)',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                        }}
                      >
                        <Iconify icon="mdi:arrow-all" width={34} />
                      </Box>
                    )}

                    <Box
                      className="cover-photo-upload-action"
                      sx={{
                        inset: 0,
                        zIndex: 2,
                        opacity: { xs: 1, md: 0 },
                        display: 'flex',
                        pointerEvents: 'none',
                        position: 'absolute',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: isEditing ? 'transparent' : 'rgba(0, 0, 0, 0.32)',
                        transition: (theme) =>
                          theme.transitions.create('opacity', {
                            duration: theme.transitions.duration.shorter,
                          }),
                      }}
                    >
                      <IconButton
                        component="label"
                        onPointerDown={(event) => event.stopPropagation()}
                        sx={{
                          width: 48,
                          height: 48,
                          color: 'common.white',
                          cursor: 'pointer',
                          pointerEvents: 'auto',
                          bgcolor: 'rgba(255, 255, 255, 0.18)',
                          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.28)' },
                        }}
                      >
                        <Iconify icon="solar:camera-add-bold" width={26} />

                        <Box
                          component="input"
                          hidden
                          type="file"
                          accept="image/*"
                          onChange={(event) => handleSelectFile(event, item)}
                        />
                      </IconButton>
                    </Box>
                  </Box>

                  <CardContent>
                    <Stack spacing={2}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        spacing={1.5}
                      >
                        <Box>
                          <Typography variant="subtitle1">{item.name}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {hasCustomCover ? 'Imagen personalizada' : 'Imagen predeterminada'}
                          </Typography>
                        </Box>

                        <Chip
                          size="small"
                          variant={hasCustomCover ? 'filled' : 'soft'}
                          color={hasCustomCover ? 'success' : 'default'}
                          label={hasCustomCover ? 'Editada' : 'Base'}
                        />
                      </Stack>

                      <Divider sx={{ borderStyle: 'dashed' }} />

                      {isEditing && (
                        <Stack spacing={1.5}>
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}
                            >
                              Tamano - {Math.round((Number(draft.scale || 1) - 1) * 100)}%
                            </Typography>
                            <Slider
                              size="small"
                              min={1}
                              max={2}
                              step={0.05}
                              value={draft.scale}
                              valueLabelDisplay="auto"
                              onChange={(_, value) =>
                                handleDraftChange(item, { scale: Number(value) })
                              }
                            />
                          </Box>
                        </Stack>
                      )}

                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {isEditing && (
                          <>
                            <Button
                              size="small"
                              variant="contained"
                              loading={loadingId === itemLoadingId}
                              startIcon={<Iconify icon="solar:diskette-bold" />}
                              onClick={() => handleSaveDraft(item)}
                            >
                              Guardar
                            </Button>

                            <Button
                              size="small"
                              color="inherit"
                              variant="outlined"
                              disabled={loadingId === itemLoadingId}
                              onClick={() => handleCancelDraft(item)}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}

                        <Button
                          size="small"
                          color="inherit"
                          variant="outlined"
                          disabled={!hasCustomCover || loadingId === itemLoadingId}
                          startIcon={<Iconify icon="solar:restart-bold" />}
                          onClick={() => handleReset(item)}
                        >
                          Restaurar
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </Box>
    </Stack>
  );
}
