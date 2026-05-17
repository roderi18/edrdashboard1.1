'use client';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import InputAdornment from '@mui/material/InputAdornment';

import { _awards } from 'src/_mock/_awards';

import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { getFolderIcon } from 'src/sections/member/awards/utils/get-folder-icon';
import { getCustomFileIcon } from 'src/sections/member/awards/utils/get-file-icon';

const ROOT_SISTEMA_ASCENSO = 'sistema-de-ascenso';
const ROOT_PARENT_KEY = '__root__';

const normalizeText = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getItemIcon = (item) =>
  item?.type === 'folder' ? getFolderIcon({ id: item.id }) : getCustomFileIcon({ id: item.id });

const getPathItems = (item, byId) => {
  const path = [];
  let current = item;

  while (current) {
    path.unshift(current);
    current = byId.get(current.parentId);
  }

  return path;
};

const getDivisionFromPath = (path) => {
  const rootIndex = path.findIndex((item) => item.id === ROOT_SISTEMA_ASCENSO);

  return rootIndex >= 0 ? path[rootIndex + 1] : null;
};

const buildAwardRoute = (item, byId) => {
  const path = getPathItems(item, byId);
  const root = path[0];
  const parent = byId.get(item.parentId);
  const division = root?.id === ROOT_SISTEMA_ASCENSO ? getDivisionFromPath(path) : null;
  const sistema = root?.id === ROOT_SISTEMA_ASCENSO ? 'sistemaAscenso' : 'academia';

  return {
    id: `${sistema}_${parent?.id || 'grupo'}_${item.id}`,
    sistema,
    idDivision: sistema === 'sistemaAscenso' ? division?.id || '' : '',
    nombreDivision: sistema === 'sistemaAscenso' ? division?.name || '' : '',
    idGrupo: parent?.id || '',
    nombreGrupo: parent?.name || '',
    idItemAscenso: item.id,
    nombreItemAscenso: item.name,
    rutaTexto: path.map((pathItem) => pathItem.name).join(' / '),
    rutaIds: path.map((pathItem) => pathItem.id),
    activo: true,
  };
};

const getSelectableRoutes = () => {
  const byId = new Map(_awards.map((item) => [item.id, item]));

  return _awards
    .filter((item) => item.type !== 'folder')
    .map((item) => buildAwardRoute(item, byId))
    .filter(
      (route) =>
        route.idItemAscenso && route.idGrupo && (route.sistema === 'academia' || route.idDivision)
    )
    .sort((a, b) => a.rutaTexto.localeCompare(b.rutaTexto));
};

const getChildrenByParent = () =>
  _awards.reduce((acc, item) => {
    const parentKey = item.parentId || ROOT_PARENT_KEY;
    const children = acc.get(parentKey) || [];

    children.push(item);
    acc.set(parentKey, children);

    return acc;
  }, new Map());

const sortAwardItems = (items = []) =>
  [...items].sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;

    return a.name.localeCompare(b.name);
  });

const getAwardRouteKey = (route) => {
  const safeRoute = route || {};

  return [
    safeRoute.sistema || '',
    safeRoute.idDivision || '',
    safeRoute.idGrupo || '',
    safeRoute.idItemAscenso || '',
  ]
    .map((item) => String(item || '').trim())
    .join('|');
};

export function AwardsPathSelector({ value, onChange, usedRoutes = [] }) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('individual');
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [pendingUsedRoute, setPendingUsedRoute] = useState(null);
  const routes = useMemo(() => getSelectableRoutes(), []);
  const byId = useMemo(() => new Map(_awards.map((item) => [item.id, item])), []);
  const childrenByParent = useMemo(() => getChildrenByParent(), []);
  const routeByItemId = useMemo(
    () => new Map(routes.map((route) => [route.idItemAscenso, route])),
    [routes]
  );
  const usedRoutesByKey = useMemo(
    () => new Map(usedRoutes.map((route) => [route.key, route])),
    [usedRoutes]
  );
  const usedRoutesById = useMemo(
    () => new Map(usedRoutes.filter((route) => route.id).map((route) => [route.id, route])),
    [usedRoutes]
  );
  const filteredRoutes = useMemo(() => {
    const term = normalizeText(search);

    if (!term) return routes;

    return routes.filter((route) => normalizeText(route.rutaTexto).includes(term));
  }, [routes, search]);

  const selectedId = value?.id || '';
  const currentItems = useMemo(
    () => sortAwardItems(childrenByParent.get(currentFolderId || ROOT_PARENT_KEY) || []),
    [childrenByParent, currentFolderId]
  );
  const breadcrumbs = useMemo(() => {
    if (!currentFolderId) return [];

    return getPathItems(byId.get(currentFolderId), byId);
  }, [byId, currentFolderId]);

  const getUsedRoute = (route) =>
    usedRoutesByKey.get(getAwardRouteKey(route)) || usedRoutesById.get(route.id);

  const handleSelectRoute = (route) => {
    const usedRoute = getUsedRoute(route);

    if (usedRoute) {
      setPendingUsedRoute({ route, usedRoute });
      return;
    }

    onChange?.(route);
  };

  const handleOpenItem = (item) => {
    if (item.type === 'folder') {
      setCurrentFolderId(item.id);
      return;
    }

    const route = routeByItemId.get(item.id);

    if (route) {
      handleSelectRoute(route);
    }
  };

  const renderRouteItem = ({ route }) => {
    const selected = selectedId === route.id;
    const usedRoute = getUsedRoute(route);
    const isUsed = Boolean(usedRoute);
    const icon = getItemIcon({ id: route.idItemAscenso, type: 'pdf' });

    return (
      <Button
        key={route.id}
        fullWidth
        variant={selected ? 'soft' : 'outlined'}
        color={selected ? 'primary' : 'inherit'}
        onClick={() => handleSelectRoute(route)}
        sx={{
          p: 1.25,
          opacity: isUsed ? 0.58 : 1,
          minHeight: 76,
          justifyContent: 'flex-start',
          borderColor: selected ? 'primary.main' : 'divider',
          '&:hover': {
            opacity: 1,
            '& .award-route-icon': {
              filter: 'none',
              opacity: 1,
            },
          },
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: 1 }}>
          <Box
            component="img"
            src={icon?.src || '/assets/icons/files/ic-pdf.svg'}
            className="award-route-icon"
            sx={{
              width: 34,
              height: 34,
              flexShrink: 0,
              objectFit: 'contain',
              filter: isUsed ? 'grayscale(1)' : 'none',
              opacity: isUsed ? 0.72 : 1,
            }}
          />
          <Stack spacing={0.4} sx={{ minWidth: 0, textAlign: 'left' }}>
            <Typography noWrap variant="subtitle2">
              {route.nombreItemAscenso}
            </Typography>
            <Typography noWrap variant="caption" sx={{ color: 'text.secondary' }}>
              {route.rutaTexto}
            </Typography>
            <Stack direction="row" spacing={0.75}>
              <Chip
                size="small"
                variant="soft"
                label={route.sistema === 'academia' ? 'Academia' : 'Sistema Ascenso'}
              />
              {route.nombreDivision && (
                <Chip size="small" variant="soft" label={route.nombreDivision} />
              )}
              {isUsed && <Chip size="small" color="success" variant="soft" label="Ya cargada" />}
            </Stack>
          </Stack>
        </Stack>
      </Button>
    );
  };

  const renderFolderItem = (item) => {
    const isFolder = item.type === 'folder';
    const route = routeByItemId.get(item.id);
    const selected = route && selectedId === route.id;
    const usedRoute = route ? getUsedRoute(route) : null;
    const isUsed = Boolean(usedRoute);
    const icon = getItemIcon(item);

    return (
      <Button
        key={item.id}
        fullWidth
        variant={selected ? 'soft' : 'outlined'}
        color={selected ? 'primary' : 'inherit'}
        onClick={() => handleOpenItem(item)}
        sx={{
          p: 1.25,
          opacity: isUsed ? 0.58 : 1,
          minHeight: 70,
          justifyContent: 'flex-start',
          borderColor: selected ? 'primary.main' : 'divider',
          '&:hover': {
            opacity: 1,
            '& .award-route-icon': {
              filter: 'none',
              opacity: 1,
            },
          },
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: 1 }}>
          <Box
            component="img"
            src={icon?.src || '/assets/icons/files/ic-folder.svg'}
            className="award-route-icon"
            sx={{
              width: 34,
              height: 34,
              flexShrink: 0,
              objectFit: 'contain',
              filter: isUsed ? 'grayscale(1)' : 'none',
              opacity: isUsed ? 0.72 : 1,
            }}
          />

          <Stack
            spacing={0.35}
            sx={{
              minWidth: 0,
              flexGrow: 1,
              textAlign: 'left',
              minHeight: 44,
              justifyContent: isFolder ? 'center' : 'flex-start',
            }}
          >
            <Typography noWrap variant="subtitle2">
              {item.name}
            </Typography>
            {!isFolder && (
              <Typography noWrap variant="caption" sx={{ color: 'text.secondary' }}>
                {route?.rutaTexto}
              </Typography>
            )}
            {isUsed && (
              <Stack direction="row">
                <Chip size="small" color="success" variant="soft" label="Ya cargada" />
              </Stack>
            )}
          </Stack>

          {isFolder ? (
            <Iconify width={20} icon="eva:arrow-ios-forward-fill" sx={{ color: 'text.disabled' }} />
          ) : (
            selected && <Iconify width={20} icon="solar:check-circle-bold" />
          )}
        </Stack>
      </Button>
    );
  };

  return (
    <>
      <Stack spacing={2.5}>
        <Tabs value={activeTab} onChange={(event, newValue) => setActiveTab(newValue)}>
          <Tab value="individual" label="Ruta individual" />
          <Tab value="all" label="Todos" />
        </Tabs>

        {activeTab === 'individual' ? (
          <Stack spacing={1.5}>
            <Breadcrumbs separator="/">
              <Link
                component="button"
                underline="hover"
                color={!currentFolderId ? 'text.primary' : 'text.secondary'}
                onClick={() => setCurrentFolderId(null)}
                sx={{ fontWeight: !currentFolderId ? 700 : 500 }}
              >
                Premios
              </Link>
              {breadcrumbs.map((item, index) => {
                const active = index === breadcrumbs.length - 1;

                return (
                  <Link
                    key={item.id}
                    component="button"
                    underline={active ? 'none' : 'hover'}
                    color={active ? 'text.primary' : 'text.secondary'}
                    onClick={() => setCurrentFolderId(item.id)}
                    sx={{ fontWeight: active ? 700 : 500 }}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </Breadcrumbs>

            <Box
              sx={{
                gap: 1,
                pr: 1,
                display: 'grid',
                maxHeight: 520,
                overflow: 'auto',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              }}
            >
              {currentItems.map((item) => renderFolderItem(item))}
            </Box>
          </Stack>
        ) : (
          <>
            <TextField
              fullWidth
              value={search}
              placeholder="Buscar premio o ruta..."
              onChange={(event) => setSearch(event.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Iconify icon="eva:search-fill" />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Box
              sx={{
                gap: 1,
                pr: 1,
                display: 'grid',
                maxHeight: 520,
                overflow: 'auto',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              }}
            >
              {filteredRoutes.map((route) => renderRouteItem({ route }))}
            </Box>
          </>
        )}
      </Stack>

      <ConfirmDialog
        open={Boolean(pendingUsedRoute)}
        onClose={() => setPendingUsedRoute(null)}
        title="Ruta con plantilla cargada"
        content={
          <>
            Ya se ha cargado una plantilla en esta ruta
            {pendingUsedRoute?.usedRoute?.templateName ? (
              <>
                : <strong>{pendingUsedRoute.usedRoute.templateName}</strong>
              </>
            ) : null}
            .<br />
            ¿Realmente deseas actualizarla?
          </>
        }
        action={
          <Button
            variant="contained"
            onClick={() => {
              onChange?.(pendingUsedRoute.route);
              setPendingUsedRoute(null);
            }}
          >
            Sí, actualizarla
          </Button>
        }
      />
    </>
  );
}
