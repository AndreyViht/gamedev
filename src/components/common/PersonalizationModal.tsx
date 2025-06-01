
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, ToggleButtonGroup, ToggleButton, Switch, FormControlLabel, Divider, Paper } from '@mui/material';
import { PersonalizationSettings, Theme } from '../../types';
import FontSizeSmallIcon from '@mui/icons-material/FormatSize'; // Placeholder, better icons can be used
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import ViewCompactIcon from '@mui/icons-material/ViewCompact';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import WebAssetIcon from '@mui/icons-material/WebAsset'; // For Header
import SquareFootIcon from '@mui/icons-material/SquareFoot'; // Content Square
import AspectRatioIcon from '@mui/icons-material/AspectRatio'; // Content Full Width
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap'; // Content Spacious (concept)
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';


interface PersonalizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: PersonalizationSettings;
  onUpdateSettings: (newSettings: Partial<PersonalizationSettings>) => void;
  currentTheme: Theme;
  onToggleTheme: () => void;
}

export const PersonalizationModal: React.FC<PersonalizationModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onUpdateSettings,
  currentTheme,
  onToggleTheme,
}) => {
  const [tempSettings, setTempSettings] = useState<PersonalizationSettings>(currentSettings);

  const handleSettingChange = (key: keyof PersonalizationSettings, value: any) => {
    setTempSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyChanges = () => {
    onUpdateSettings(tempSettings);
    onClose();
  };
  
  const handleThemeToggleInternal = () => {
    onToggleTheme(); // Update global theme
    // No need to update tempSettings for theme here, it's global
  };

  const fontSizes: { value: PersonalizationSettings['fontSize']; label: string }[] = [
    { value: 'xs', label: 'XS' }, { value: 's', label: 'S' }, { value: 'm', label: 'M' }, { value: 'l', label: 'L' },
  ];
  const sidebarStyles: { value: PersonalizationSettings['sidebarStyle']; label: string; icon: React.ReactNode }[] = [
    { value: 'normal', label: 'Обычный', icon: <ViewSidebarIcon /> },
    { value: 'compact', label: 'Компактный', icon: <ViewCompactIcon /> },
    { value: 'iconic', label: 'Иконки', icon: <ViewQuiltIcon /> },
  ];
  const headerStyles: { value: PersonalizationSettings['headerStyle']; label: string }[] = [
    { value: 'fixedTop', label: 'Фикс. сверху' },
    { value: 'static', label: 'Статичный' },
    // { value: 'fixedWidth', label: 'По ширине контента' }, // Could add later
  ];
  const contentLayouts: { value: PersonalizationSettings['contentLayout']; label: string; icon: React.ReactNode }[] = [
    { value: 'square', label: 'Ограниченный', icon: <SquareFootIcon /> },
    { value: 'fullWidth', label: 'Во всю ширину', icon: <AspectRatioIcon /> },
    { value: 'spacious', label: 'Просторный', icon: <ZoomOutMapIcon /> },
  ];

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="xs" fullWidth 
            PaperProps={{ 
              className: "personalization-modal-content", // For custom scrollbar if needed
              sx: { borderRadius: 'var(--border-radius-large)' } 
            }}>
      <DialogTitle sx={{textAlign: 'center', fontWeight: 600 }}>Персонализация</DialogTitle>
      <DialogContent dividers className="personalization-modal-content">
        <Box className="personalization-section">
          <Typography variant="subtitle1" gutterBottom component="h3">Тема оформления</Typography>
          <ToggleButtonGroup value={currentTheme} exclusive onChange={handleThemeToggleInternal} fullWidth aria-label="Тема">
            <ToggleButton value="light" aria-label="Светлая тема" sx={{textTransform: 'none', flexGrow: 1}}>
              <Brightness7Icon sx={{mr: 1}} /> Светлая
            </ToggleButton>
            <ToggleButton value="dark" aria-label="Темная тема" sx={{textTransform: 'none', flexGrow: 1}}>
              <Brightness4Icon sx={{mr: 1}} /> Темная
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box className="personalization-section">
          <Typography variant="subtitle1" gutterBottom component="h3">Размер шрифта</Typography>
          <ToggleButtonGroup
            value={tempSettings.fontSize}
            exclusive fullWidth
            onChange={(e, newValue) => newValue && handleSettingChange('fontSize', newValue)}
            aria-label="Размер шрифта"
          >
            {fontSizes.map(size => (
              <ToggleButton key={size.value} value={size.value} aria-label={size.label} sx={{textTransform: 'none', flexGrow: 1}}>
                <FontSizeSmallIcon sx={{mr: 0.5, fontSize: size.value === 'xs' ? '1rem' : size.value === 's' ? '1.15rem' : size.value === 'l' ? '1.4rem' : '1.25rem'}} /> {size.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Box className="personalization-section">
          <Typography variant="subtitle1" gutterBottom component="h3">Боковая панель</Typography>
          <ToggleButtonGroup
            value={tempSettings.sidebarStyle}
            exclusive fullWidth
            onChange={(e, newValue) => newValue && handleSettingChange('sidebarStyle', newValue)}
            aria-label="Стиль боковой панели"
          >
            {sidebarStyles.map(style => (
              <ToggleButton key={style.value} value={style.value} aria-label={style.label} sx={{textTransform: 'none', flexGrow: 1}}>
                {style.icon}
                <Typography variant="caption" sx={{ml: 0.5, display: {xs: 'none', sm: 'inline'}}}>{style.label}</Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
           {/* <FormControlLabel control={<Switch checked={tempSettings.sidebarFill} onChange={(e) => handleSettingChange('sidebarFill', e.target.checked)} />} label="Заливка цветом" sx={{mt:1}}/> */}
        </Box>
        
        <Box className="personalization-section">
          <Typography variant="subtitle1" gutterBottom component="h3">Шапка сайта</Typography>
          <ToggleButtonGroup
            value={tempSettings.headerStyle}
            exclusive fullWidth
            onChange={(e, newValue) => newValue && handleSettingChange('headerStyle', newValue)}
            aria-label="Стиль шапки"
          >
             {headerStyles.map(style => (
              <ToggleButton key={style.value} value={style.value} aria-label={style.label} sx={{textTransform: 'none', flexGrow: 1}}>
                {style.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
           {/* <FormControlLabel control={<Switch checked={tempSettings.headerFill} onChange={(e) => handleSettingChange('headerFill', e.target.checked)} />} label="Заливка цветом" sx={{mt:1}} /> */}
        </Box>

        <Box className="personalization-section">
          <Typography variant="subtitle1" gutterBottom component="h3">Область контента</Typography>
           <ToggleButtonGroup
            value={tempSettings.contentLayout}
            exclusive fullWidth
            onChange={(e, newValue) => newValue && handleSettingChange('contentLayout', newValue)}
            aria-label="Макет контента"
          >
            {contentLayouts.map(layout => (
              <ToggleButton key={layout.value} value={layout.value} aria-label={layout.label} sx={{textTransform: 'none', flexGrow: 1}}>
                 {layout.icon}
                <Typography variant="caption" sx={{ml: 0.5, display: {xs: 'none', sm: 'inline'}}}>{layout.label}</Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

      </DialogContent>
      <DialogActions sx={{ p: '16px 24px' }}>
        <Button onClick={onClose} color="inherit">Отмена</Button>
        <Button onClick={handleApplyChanges} variant="contained">Применить</Button>
      </DialogActions>
    </Dialog>
  );
};
