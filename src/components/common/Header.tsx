
import React from 'react';
import { AppBar, Toolbar, Typography, Button, IconButton, Box, useTheme } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import LoginIcon from '@mui/icons-material/Login';
import AppRegistrationIcon from '@mui/icons-material/AppRegistration';
// import TelegramIcon from '@mui/icons-material/Telegram'; // Import Telegram icon - Removed as button is moved

import { View } from '../../enums/appEnums';
import { Theme as ThemeType, PersonalizationSettings } from '../../types';
import { APP_NAME } from '../../config/constants';

interface HeaderProps {
  onNavigate: (view: View) => void;
  isLoggedIn: boolean;
  onLogout: () => void;
  theme: ThemeType;
  onToggleTheme: () => void;
  userDisplayName?: string | null;
  personalizationSettings: PersonalizationSettings; // Added
}

export const Header: React.FC<HeaderProps> = ({ 
  onNavigate, isLoggedIn, onLogout, theme, onToggleTheme, userDisplayName, personalizationSettings 
}) => {
  const muiTheme = useTheme();

  const headerBaseStyle = {
    position: personalizationSettings.headerStyle === 'fixedTop' ? 'sticky' : 'static',
    top: 0,
    zIndex: muiTheme.zIndex.drawer + 1,
    backgroundColor: personalizationSettings.headerFill 
      ? muiTheme.palette.primary.main 
      : (theme === 'light' ? 'rgba(242, 242, 247, 0.8)' : 'rgba(28, 28, 30, 0.8)'), // Use theme-appropriate default
    color: personalizationSettings.headerFill ? muiTheme.palette.primary.contrastText : muiTheme.palette.text.primary,
  };
  
  const toolbarStyle = personalizationSettings.headerStyle === 'fixedWidth' 
    ? { maxWidth: 'var(--content-max-width)', width: '100%', margin: '0 auto' } 
    : {};


  return (
    <AppBar sx={headerBaseStyle} elevation={personalizationSettings.headerFill ? 1 : 0}>
      <Toolbar sx={toolbarStyle}>
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ 
            flexGrow: 1, 
            cursor: 'pointer', 
            fontWeight: 700, 
            letterSpacing: '-0.5px',
            color: personalizationSettings.headerFill ? muiTheme.palette.primary.contrastText : 'text.primary',
          }} 
          onClick={() => onNavigate(View.Landing)}
        >
          {APP_NAME}
        </Typography>
        
        {/* Button "Для телеграмм" removed from here */}

        <IconButton sx={{ ml: 1, color: personalizationSettings.headerFill ? muiTheme.palette.primary.contrastText : 'inherit' }} onClick={onToggleTheme} color="inherit" aria-label={`Переключить на ${theme === 'light' ? 'темную' : 'светлую'} тему`}>
          {theme === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>

        {isLoggedIn ? (
          <>
            {userDisplayName && <Typography sx={{ mr: 2, display: { xs: 'none', sm: 'block' }, color: personalizationSettings.headerFill ? muiTheme.palette.primary.contrastText : 'text.secondary' }}>Привет, {userDisplayName}!</Typography>}
            <Button 
              color={personalizationSettings.headerFill ? 'inherit' : 'primary'}
              variant={personalizationSettings.headerFill ? "outlined" : "text"}
              startIcon={<AccountCircleIcon />} 
              onClick={() => onNavigate(View.Dashboard)} 
              sx={{ mr: 1, borderColor: personalizationSettings.headerFill ? 'currentColor' : undefined }} // Use currentColor for border
              aria-label="Личный кабинет"
            >
              Кабинет
            </Button>
            <Button 
              color={personalizationSettings.headerFill ? 'inherit' : 'primary'} // Changed to primary for better visibility in light theme
              variant={personalizationSettings.headerFill ? "outlined" : "text"}
              startIcon={<ExitToAppIcon />} 
              onClick={onLogout}
              sx={{ borderColor: personalizationSettings.headerFill ? 'currentColor' : undefined }} // Use currentColor for border
              aria-label="Выйти"
            >
              Выйти
            </Button>
          </>
        ) : (
          <>
            <Button 
              color={personalizationSettings.headerFill ? 'inherit' : 'primary'}
              variant={personalizationSettings.headerFill ? "outlined" : "text"}
              startIcon={<LoginIcon />} 
              onClick={() => onNavigate(View.Login)} 
              sx={{ mr: 1, borderColor: personalizationSettings.headerFill ? 'currentColor' : undefined }}
              aria-label="Войти"
            >
              Войти
            </Button>
            <Button 
              variant="contained" 
              disableElevation
              startIcon={<AppRegistrationIcon />} 
              onClick={() => onNavigate(View.Register)}
              sx={{ 
                backgroundColor: personalizationSettings.headerFill ? String(muiTheme.palette.background.paper) : String(muiTheme.palette.primary.main), // Adjusted for better fill contrast
                color: personalizationSettings.headerFill ? String(muiTheme.palette.primary.main) : String(muiTheme.palette.primary.contrastText),
                '&:hover': {
                   backgroundColor: personalizationSettings.headerFill 
                    ? String(muiTheme.palette.grey[200]) 
                    : String(muiTheme.palette.primary.dark)
                }
              }}
              aria-label="Зарегистрироваться"
            >
              Регистрация
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};
