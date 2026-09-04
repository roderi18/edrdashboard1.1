'use client';

import { useEffect, useCallback } from 'react';
import { hasKeys, varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Drawer from '@mui/material/Drawer';
import SvgIcon from '@mui/material/SvgIcon';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';

import { themeConfig } from 'src/theme/theme-config';
import { primaryColorPresets } from 'src/theme/with-settings';

import { Label } from '../../label';
import { settingIcons } from './icons';
import { Iconify } from '../../iconify';
import { BaseOption } from './base-option';
import { Scrollbar } from '../../scrollbar';
import { SmallBlock, LargeBlock } from './styles';
import { PresetsOptions } from './presets-options';
import { FullScreenButton } from './fullscreen-button';
import { FontSizeOptions, FontFamilyOptions } from './font-options';
import { useSettingsContext } from '../context/use-settings-context';
import { NavColorOptions, NavLayoutOptions } from './nav-layout-option';

// ----------------------------------------------------------------------

// TRES ESTADOS, NO DOS.
//
// "Sistema" es el de partida: decide el telefono y cambia solo cuando el
// telefono cambia. Con dos estados, el primer toque fijaba el tema para
// siempre y no habia forma de devolverle el mando; por eso el tercer toque
// vuelve a "Sistema".
const MODOS = ['system', 'light', 'dark'];

const ETIQUETA_MODO = {
  system: 'Sistema',
  light: 'Claro',
  dark: 'Oscuro',
};

export function SettingsDrawer({ sx, defaultSettings }) {
  const settings = useSettingsContext();
  const { mode, setMode, colorScheme } = useColorScheme();

  // Visible options by default settings
  const visibility = {
    mode: hasKeys(defaultSettings, ['mode']),
    contrast: hasKeys(defaultSettings, ['contrast']),
    navColor: hasKeys(defaultSettings, ['navColor']),
    fontSize: hasKeys(defaultSettings, ['fontSize']),
    direction: hasKeys(defaultSettings, ['direction']),
    navLayout: hasKeys(defaultSettings, ['navLayout']),
    fontFamily: hasKeys(defaultSettings, ['fontFamily']),
    primaryColor: hasKeys(defaultSettings, ['primaryColor']),
    compactLayout: hasKeys(defaultSettings, ['compactLayout']),
  };

  useEffect(() => {
    if (mode !== undefined && mode !== settings.state.mode) {
      settings.setState({ mode });
    }
  }, [mode, settings]);

  const handleReset = useCallback(() => {
    settings.onReset();
    setMode(null);
  }, [setMode, settings]);

  const renderHead = () => (
    <Box
      sx={{
        py: 2,
        pr: 1,
        pl: 2.5,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Typography variant="h6" sx={{ flexGrow: 1 }}>
        Settings
      </Typography>

      <FullScreenButton />

      <Tooltip title="Reset all">
        <IconButton onClick={handleReset}>
          <Badge color="error" variant="dot" invisible={!settings.canReset}>
            <Iconify icon="solar:restart-bold" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Tooltip title="Close">
        <IconButton onClick={settings.onCloseDrawer}>
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </Tooltip>
    </Box>
  );

  const renderMode = () => {
    // En el primer pintado del servidor todavia no hay modo resuelto; se
    // ensena el de partida para no estrenar la tarjeta en blanco.
    const modoActual = MODOS.includes(mode) ? mode : themeConfig.defaultMode;
    const siguiente = MODOS[(MODOS.indexOf(modoActual) + 1) % MODOS.length];

    return (
      <BaseOption
        label="Modo"
        // Lo que se pinta es el tema que se esta VIENDO, no el elegido: con
        // "Sistema" la tarjeta se enciende sola cuando el telefono se oscurece.
        selected={colorScheme === 'dark'}
        icon={<SvgIcon>{settingIcons.moon}</SvgIcon>}
        action={
          <Label
            sx={{
              height: 20,
              cursor: 'inherit',
              borderRadius: '20px',
              fontWeight: 'fontWeightSemiBold',
            }}
          >
            {ETIQUETA_MODO[modoActual]}
          </Label>
        }
        onChangeOption={() => {
          setMode(siguiente);
          settings.setState({ mode: siguiente });
        }}
      />
    );
  };

  const renderContrast = () => (
    <BaseOption
      label="Contraste"
      selected={settings.state.contrast === 'high'}
      icon={<SvgIcon>{settingIcons.contrast}</SvgIcon>}
      onChangeOption={() => {
        settings.setState({
          contrast: settings.state.contrast === 'default' ? 'high' : 'default',
        });
      }}
    />
  );

  const renderDirection = () => (
    <BaseOption
      label="Derecha a Izq."
      selected={settings.state.direction === 'rtl'}
      icon={<SvgIcon>{settingIcons.alignRight}</SvgIcon>}
      onChangeOption={() => {
        settings.setState({ direction: settings.state.direction === 'ltr' ? 'rtl' : 'ltr' });
      }}
    />
  );

  const renderCompactLayout = () => (
    <BaseOption
      tooltip="Dashboard only and available at large resolutions > 1600px (xl)"
      label="Compacto"
      selected={!!settings.state.compactLayout}
      icon={<SvgIcon>{settingIcons.autofitWidth}</SvgIcon>}
      onChangeOption={() => {
        settings.setState({ compactLayout: !settings.state.compactLayout });
      }}
    />
  );

  const renderPresets = () => (
    <LargeBlock
      title="Presets"
      canReset={settings.state.primaryColor !== defaultSettings.primaryColor}
      onReset={() => {
        settings.setState({ primaryColor: defaultSettings.primaryColor });
      }}
    >
      <PresetsOptions
        icon={<SvgIcon sx={{ width: 28, height: 28 }}>{settingIcons.siderbarDuotone}</SvgIcon>}
        options={Object.keys(primaryColorPresets).map((key) => ({
          name: key,
          value: primaryColorPresets[key].main,
        }))}
        value={settings.state.primaryColor}
        onChangeOption={(newOption) => {
          settings.setState({ primaryColor: newOption });
        }}
      />
    </LargeBlock>
  );

  const renderNav = () => (
    <LargeBlock title="Nav" tooltip="Dashboard only" sx={{ gap: 2.5 }}>
      {visibility.navLayout && (
        <SmallBlock
          label="Layout"
          canReset={settings.state.navLayout !== defaultSettings.navLayout}
          onReset={() => {
            settings.setState({ navLayout: defaultSettings.navLayout });
          }}
        >
          <NavLayoutOptions
            value={settings.state.navLayout}
            onChangeOption={(newOption) => {
              settings.setState({ navLayout: newOption });
            }}
            options={[
              {
                value: 'vertical',
                icon: (
                  <SvgIcon sx={{ width: 1, height: 'auto' }}>{settingIcons.navVertical}</SvgIcon>
                ),
              },
              {
                value: 'horizontal',
                icon: (
                  <SvgIcon sx={{ width: 1, height: 'auto' }}>{settingIcons.navHorizontal}</SvgIcon>
                ),
              },
              {
                value: 'mini',
                icon: <SvgIcon sx={{ width: 1, height: 'auto' }}>{settingIcons.navMini}</SvgIcon>,
              },
            ]}
          />
        </SmallBlock>
      )}
      {visibility.navColor && (
        <SmallBlock
          label="Color"
          canReset={settings.state.navColor !== defaultSettings.navColor}
          onReset={() => {
            settings.setState({ navColor: defaultSettings.navColor });
          }}
        >
          <NavColorOptions
            value={settings.state.navColor}
            onChangeOption={(newOption) => {
              settings.setState({ navColor: newOption });
            }}
            options={[
              {
                label: 'Integrate',
                value: 'integrate',
                icon: <SvgIcon>{settingIcons.sidebarOutline}</SvgIcon>,
              },
              {
                label: 'Apparent',
                value: 'apparent',
                icon: <SvgIcon>{settingIcons.sidebarFill}</SvgIcon>,
              },
            ]}
          />
        </SmallBlock>
      )}
    </LargeBlock>
  );

  const renderFont = () => (
    <LargeBlock title="Font" sx={{ gap: 2.5 }}>
      {visibility.fontFamily && (
        <SmallBlock
          label="Family"
          canReset={settings.state.fontFamily !== defaultSettings.fontFamily}
          onReset={() => {
            settings.setState({ fontFamily: defaultSettings.fontFamily });
          }}
        >
          <FontFamilyOptions
            value={settings.state.fontFamily}
            onChangeOption={(newOption) => {
              settings.setState({ fontFamily: newOption });
            }}
            options={[
              themeConfig.fontFamily.primary,
              'Inter Variable',
              'DM Sans Variable',
              'Nunito Sans Variable',
            ]}
            icon={<SvgIcon sx={{ width: 28, height: 28 }}>{settingIcons.font}</SvgIcon>}
          />
        </SmallBlock>
      )}
      {visibility.fontSize && (
        <SmallBlock
          label="Size"
          canReset={settings.state.fontSize !== defaultSettings.fontSize}
          onReset={() => {
            settings.setState({ fontSize: defaultSettings.fontSize });
          }}
          sx={{ gap: 5 }}
        >
          <FontSizeOptions
            options={[12, 20]}
            value={settings.state.fontSize}
            onChangeOption={(newOption) => {
              settings.setState({ fontSize: newOption });
            }}
          />
        </SmallBlock>
      )}
    </LargeBlock>
  );

  return (
    <Drawer
      anchor="right"
      open={settings.openDrawer}
      onClose={settings.onCloseDrawer}
      slotProps={{
        backdrop: { invisible: true },
        paper: {
          sx: [
            (theme) => ({
              ...theme.mixins.paperStyles(theme, {
                color: varAlpha(theme.vars.palette.background.defaultChannel, 0.9),
              }),
              width: 360,
            }),
            ...(Array.isArray(sx) ? sx : [sx]),
          ],
        },
      }}
    >
      {renderHead()}

      <Scrollbar>
        <Box
          sx={{
            pb: 5,
            gap: 6,
            px: 2.5,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ gap: 2, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {visibility.mode && renderMode()}
            {visibility.contrast && renderContrast()}
            {visibility.direction && renderDirection()}
            {visibility.compactLayout && renderCompactLayout()}
          </Box>

          {(visibility.navColor || visibility.navLayout) && renderNav()}
          {visibility.primaryColor && renderPresets()}
          {(visibility.fontFamily || visibility.fontSize) && renderFont()}
        </Box>
      </Scrollbar>
    </Drawer>
  );
}
