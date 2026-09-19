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
    navLayout: hasKeys(defaultSettings, ['navLayout']),
    fontFamily: hasKeys(defaultSettings, ['fontFamily']),
    primaryColor: hasKeys(defaultSettings, ['primaryColor']),
    navBlanco: hasKeys(defaultSettings, ['navBlanco']),
    accesosRapidos: hasKeys(defaultSettings, ['accesosRapidos']),
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
        Configuración
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

  // LA BARRA Y LA CABECERA EN BLANCO.
  //
  // Debajo de los presets porque es lo mismo que ellos: una decision de color, no
  // de disposicion. Los presets mueven el acento; este mueve las DOS piezas de
  // marca —barra lateral y cabecera— entre el navy de la casa y el blanco de la
  // plantilla, sin tocar nada mas de la pantalla.
  const renderNavBlanco = () => (
    <LargeBlock
      title="Barra y cabecera"
      canReset={Boolean(settings.state.navBlanco) !== Boolean(defaultSettings.navBlanco)}
      onReset={() => {
        settings.setState({ navBlanco: defaultSettings.navBlanco });
      }}
    >
      <BaseOption
        label="En blanco"
        tooltip="Deja la barra lateral y la cabecera del color del contenido, sin el navy de la casa."
        selected={Boolean(settings.state.navBlanco)}
        icon={<SvgIcon>{settingIcons.siderbarDuotone}</SvgIcon>}
        onChangeOption={() => {
          settings.setState({ navBlanco: !settings.state.navBlanco });
        }}
      />
    </LargeBlock>
  );

  // LOS CUATRO ACCESOS RAPIDOS DE LA PANTALLA PRINCIPAL.
  //
  // Debajo de "Barra y cabecera" porque es la misma clase de ajuste: que se ve y
  // que no en el marco de la aplicacion. Son atajos —Registrar actividad, Proxima
  // actividad, Mis insignias, Capacitacion—, y quien no los use se los quita sin
  // perder nada: todos llevan a sitios que tambien estan en el menu.
  //
  // Solo se muestran cuando el usuario los activa de forma expresa. Esto también
  // mantiene apagadas las sesiones antiguas que todavía no guardaron esta clave.
  const accesosVisibles = settings.state.accesosRapidos === true;

  const renderAccesosRapidos = () => (
    <LargeBlock
      title="Accesos rápidos"
      canReset={accesosVisibles !== Boolean(defaultSettings.accesosRapidos)}
      onReset={() => {
        settings.setState({ accesosRapidos: defaultSettings.accesosRapidos });
      }}
    >
      <BaseOption
        label="Visibles"
        tooltip="Enseña u oculta los cuatro atajos de la pantalla Principal: Registrar actividad, Próxima actividad, Mis insignias y Capacitación."
        selected={accesosVisibles}
        icon={<SvgIcon>{settingIcons.navMini}</SvgIcon>}
        onChangeOption={() => {
          settings.setState({ accesosRapidos: !accesosVisibles });
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
          </Box>

          {(visibility.navColor || visibility.navLayout) && renderNav()}
          {visibility.primaryColor && renderPresets()}
          {visibility.navBlanco && renderNavBlanco()}
          {visibility.accesosRapidos && renderAccesosRapidos()}
          {(visibility.fontFamily || visibility.fontSize) && renderFont()}
        </Box>
      </Scrollbar>
    </Drawer>
  );
}
