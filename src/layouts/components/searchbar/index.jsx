'use client';

import parse from 'autosuggest-highlight/parse';
import match from 'autosuggest-highlight/match';
import { varAlpha } from 'minimal-shared/utils';
import { useBoolean } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import MenuList from '@mui/material/MenuList';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import InputAdornment from '@mui/material/InputAdornment';
import Dialog, { dialogClasses } from '@mui/material/Dialog';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import MenuItem, { menuItemClasses } from '@mui/material/MenuItem';
import InputBase, { inputBaseClasses } from '@mui/material/InputBase';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { SearchNotFound } from 'src/components/search-not-found';

import { ResultItem } from './result-item';
import { applyFilter, flattenNavSections } from './utils';

// ----------------------------------------------------------------------

const breakpoint = 'sm';

export function Searchbar({
  data: navItems = [],
  disabled = false,
  // ABIERTO: el campo se ve y se escribe en el, sin abrir nada.
  //
  // La version de siempre era una lupa que abria un dialogo encima de la
  // pantalla. Funciona, pero esconde la busqueda detras de un clic y de saber
  // que existe. Con el campo a la vista y el texto de ayuda dentro, se ve que se
  // puede buscar y QUE se puede buscar.
  //
  // Se queda como variante y no sustituye a la otra porque en un telefono un
  // campo ancho no cabe en la cabecera: ahi sigue la lupa con su dialogo.
  abierto = false,
  sx,
  ...other
}) {
  const theme = useTheme();
  const [anclaje, setAnclaje] = useState(null);
  const smUp = useMediaQuery(theme.breakpoints.up(breakpoint));

  const { value: open, onFalse: onClose, onTrue: onOpen, onToggle } = useBoolean();
  const [searchQuery, setSearchQuery] = useState('');

  const handleClose = useCallback(() => {
    onClose();
    setSearchQuery('');
  }, [onClose]);

  const handleKeyDown = useCallback(
    (event) => {
      if (disabled) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();

        // Con el campo a la vista, el atajo lleva el cursor ahi. Abrir un dialogo
        // encima de un buscador que ya se esta viendo no tiene sentido.
        if (abierto) {
          document.getElementById('search-input-abierto')?.focus();
          return;
        }

        onToggle();
        setSearchQuery('');
      }
    },
    [abierto, disabled, onToggle]
  );

  useEffect(() => {
    if (disabled) return undefined;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [disabled, handleKeyDown]);

  const handleSearch = useCallback((event) => {
    setSearchQuery(event.target.value);
  }, []);

  const formattedNavItems = flattenNavSections(navItems);

  const dataFiltered = useMemo(
    () =>
      applyFilter({
        inputData: formattedNavItems,
        query: searchQuery,
      }),
    [formattedNavItems, searchQuery]
  );

  const notFound = searchQuery && !dataFiltered.length;

  const renderButton = () => (
    <Box
      onClick={disabled ? undefined : onOpen}
      aria-disabled={disabled}
      sx={[
        {
          display: 'flex',
          alignItems: 'center',
          opacity: disabled ? 0.48 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
          [theme.breakpoints.up(breakpoint)]: {
            pr: 1,
            borderRadius: 1.5,
            cursor: disabled ? 'not-allowed' : 'pointer',
            bgcolor: varAlpha(theme.vars.palette.grey['500Channel'], 0.08),
            transition: theme.transitions.create('background-color', {
              easing: theme.transitions.easing.easeInOut,
              duration: theme.transitions.duration.shortest,
            }),
            '&:hover': {
              bgcolor: disabled
                ? varAlpha(theme.vars.palette.grey['500Channel'], 0.08)
                : varAlpha(theme.vars.palette.grey['500Channel'], 0.16),
            },
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Box
        component={smUp ? 'span' : IconButton}
        sx={{
          [theme.breakpoints.up(breakpoint)]: {
            p: 1,
            display: 'inline-flex',
            color: 'action.active',
          },
        }}
      >
        <Iconify icon="eva:search-fill" />
      </Box>

      <Label
        sx={{
          color: 'grey.800',
          cursor: 'inherit',
          bgcolor: 'common.white',
          fontSize: theme.typography.pxToRem(12),
          boxShadow: theme.vars.customShadows.z1,
          display: { xs: 'none', [breakpoint]: 'inline-flex' },
        }}
      >
        ⌘K
      </Label>
    </Box>
  );

  const renderResults = () => (
    <MenuList
      disablePadding
      sx={{
        [`& .${menuItemClasses.root}`]: {
          p: 0,
          mb: 0,
          '&:hover': { bgcolor: 'transparent' },
        },
      }}
    >
      {dataFiltered.map((item) => {
        const matchesTitle = match(item.title, searchQuery, { insideWords: true });
        const partsTitle = parse(item.title, matchesTitle);

        const matchesPath = match(item.path, searchQuery, { insideWords: true });
        const partsPath = parse(item.path, matchesPath);

        return (
          <MenuItem disableRipple key={`${item.title}${item.path}`}>
            <ResultItem
              path={partsPath}
              title={partsTitle}
              href={item.path}
              labels={item.group.split('.')}
              onClick={abierto ? cerrarDesplegable : handleClose}
            />
          </MenuItem>
        );
      })}
    </MenuList>
  );

  const cerrarDesplegable = useCallback(() => setSearchQuery(''), []);

  /** El campo a la vista, con los resultados colgando debajo. */
  const renderCampoAbierto = () => (
    <ClickAwayListener onClickAway={cerrarDesplegable}>
      <Box
        ref={setAnclaje}
        sx={[
          {
            // Se come el ancho que sobre, entre un minimo y un tope.
            //
            // El minimo hace falta porque el area central de la cabecera tambien
            // crece y se repartian el hueco a partes iguales: el campo se quedaba
            // en 300 pixeles y el texto de ayuda no cabia entero.
            //
            // Y el tope, porque un campo de 900 pixeles parece un error, no un
            // buscador.
            flex: '1 1 auto',
            minWidth: { [breakpoint]: 280, md: 380 },
            maxWidth: 520,
            display: { xs: 'none', [breakpoint]: 'block' },
            position: 'relative',
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...other}
      >
        <InputBase
          fullWidth
          disabled={disabled}
          value={searchQuery}
          onChange={handleSearch}
          onKeyDown={(event) => {
            if (event.key === 'Escape') cerrarDesplegable();
          }}
          placeholder="Buscar actividades, personas, insignias, documentos..."
          inputProps={{ id: 'search-input-abierto', 'aria-label': 'Buscar' }}
          startAdornment={
            <InputAdornment position="start">
              <Iconify icon="eva:search-fill" width={20} sx={{ opacity: 0.64 }} />
            </InputAdornment>
          }
          sx={{
            px: 1.5,
            height: 40,
            borderRadius: 1.25,
            color: 'inherit',
            // Superficies en blanco translucido y no en gris: este campo vive en
            // la cabecera de marca, que es navy. Un gris del tema ahi se ve sucio.
            bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.1),
            border: `solid 1px ${varAlpha(theme.vars.palette.common.whiteChannel, 0.14)}`,
            transition: theme.transitions.create(['background-color', 'border-color']),
            '&:hover': { bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.16) },
            [`&.${inputBaseClasses.focused}`]: {
              bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.18),
              borderColor: varAlpha(theme.vars.palette.common.whiteChannel, 0.32),
            },
            [`& .${inputBaseClasses.input}`]: {
              typography: 'body2',
              '&::placeholder': { color: 'inherit', opacity: 0.56 },
            },
          }}
        />

        {/* SOLO CUANDO HAY ALGO ESCRITO. Un desplegable que se abre vacio al
            enfocar tapa la pantalla sin dar nada a cambio. */}
        <Popper
          open={Boolean(searchQuery)}
          anchorEl={anclaje}
          placement="bottom-start"
          sx={{ zIndex: (t) => t.zIndex.modal, width: anclaje?.clientWidth }}
        >
          <Paper
            sx={{ mt: 0.75, overflow: 'hidden', boxShadow: theme.vars.customShadows.dropdown }}
          >
            {notFound ? (
              <SearchNotFound query={searchQuery} sx={{ py: 5, px: 2.5 }} />
            ) : (
              <Scrollbar sx={{ p: 1.5, maxHeight: 400 }}>{renderResults()}</Scrollbar>
            )}
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );

  // El dialogo sigue existiendo para el telefono, donde el campo no cabe.
  if (abierto) {
    return renderCampoAbierto();
  }

  return (
    <>
      {renderButton()}

      <Dialog
        fullWidth
        maxWidth="sm"
        open={open}
        onClose={handleClose}
        transitionDuration={{ enter: theme.transitions.duration.shortest, exit: 100 }}
        sx={[
          {
            [`& .${dialogClasses.paper}`]: { mt: 15, overflow: 'unset' },
            [`& .${dialogClasses.container}`]: { alignItems: 'flex-start' },
          },
        ]}
      >
        <InputBase
          fullWidth
          autoFocus={open}
          placeholder="Buscar..."
          value={searchQuery}
          onChange={handleSearch}
          startAdornment={
            <InputAdornment position="start">
              <Iconify icon="eva:search-fill" width={24} sx={{ color: 'text.disabled' }} />
            </InputAdornment>
          }
          endAdornment={<Label sx={{ letterSpacing: 1, color: 'text.secondary' }}>esc</Label>}
          inputProps={{ id: 'search-input' }}
          sx={{
            p: 3,
            borderBottom: `solid 1px ${theme.vars.palette.divider}`,
            [`& .${inputBaseClasses.input}`]: { typography: 'h6' },
          }}
        />

        {notFound ? (
          <SearchNotFound query={searchQuery} sx={{ py: 15, px: 2.5 }} />
        ) : (
          <Scrollbar sx={{ p: 2.5, height: 400 }}>{renderResults()}</Scrollbar>
        )}
      </Dialog>
    </>
  );
}
