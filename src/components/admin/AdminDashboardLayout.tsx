

import React, { useEffect, useState } from 'react';
import { UserProfile, PersonalizationSettings } from '../../types'; 
import { View, AdminDashboardSection } from '../../enums/appEnums';
import { isUserAdmin } from '../../utils/helpers';

import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, useMediaQuery, IconButton, Toolbar, Divider, CircularProgress } from '@mui/material';
import { useTheme, Theme as MuiTheme } from '@mui/material/styles'; // Corrected import for useTheme and MuiTheme
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import BuildIcon from '@mui/icons-material/Build';
import GroupIcon from '@mui/icons-material/Group';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import AdUnitsIcon from '@mui/icons-material/AdUnits';
import QueryStatsIcon from '@mui/icons-material/QueryStats'; // Added for Site Stats
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MenuIcon from '@mui/icons-material/Menu'; // Hamburger icon
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';

interface AdminDashboardLayoutProps {
    user: UserProfile;
    currentAdminSection: AdminDashboardSection;
    onNavigateAdminSection: (section: AdminDashboardSection) => void;
    isSidebarCollapsed: boolean; // Controlled from App.tsx
    onToggleSidebar: () => void;   // Controlled from App.tsx
    children: React.ReactNode;
    onNavigateGlobal: (view: View) => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
    personalizationSettings: PersonalizationSettings; 
}

const ADMIN_SIDEBAR_LOGO_ICON = '🛡️';

export const AdminDashboardLayout: React.FC<AdminDashboardLayoutProps> = ({
    user, currentAdminSection, onNavigateAdminSection, isSidebarCollapsed, onToggleSidebar, children, onNavigateGlobal, showToast, personalizationSettings
}) => {
    const theme = useTheme<MuiTheme>(); // MuiTheme is alias for @mui/material/styles/Theme
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    // For mobile, the drawer state is managed locally if needed, but primarily controlled by isSidebarCollapsed for desktop.
    // Let's assume isSidebarCollapsed prop directly influences the permanent drawer's appearance (iconic/compact/normal)
    // and a separate state for mobile temporary drawer if onToggleSidebar doesn't cover that.
    // For simplicity, we'll use `isSidebarCollapsed` to determine if it's iconic on desktop.
    // `onToggleSidebar` will be used for the button that changes `isSidebarCollapsed` in App.tsx.

    useEffect(() => {
        if (!isUserAdmin(user)) {
            showToast("Доступ запрещен. Требуются права администратора.", "error");
            onNavigateGlobal(View.Dashboard);
        }
    }, [user, onNavigateGlobal, showToast]);

    if (!isUserAdmin(user)) {
        return <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%'}}><CircularProgress /> <Typography sx={{ml:2}}>Проверка доступа...</Typography></Box>;
    }

    const getSidebarWidth = () => {
        if (isSidebarCollapsed && !isMobile) return 'var(--dashboard-sidebar-width-iconic)'; // Iconic for collapsed desktop
        // For mobile, drawer usually takes full width or a standard mobile width when temporary.
        // For desktop non-collapsed, use normal width.
        return 'var(--dashboard-sidebar-width)';
    };
    const sidebarWidth = getSidebarWidth();
    const isIconicOrMobileCollapsed = isSidebarCollapsed && !isMobile;


    const menuItems = [
        { text: 'Новости', icon: <NewspaperIcon />, section: AdminDashboardSection.AdminNews },
        { text: 'Проекты', icon: <BuildIcon />, section: AdminDashboardSection.AdminProjects },
        { text: 'Пользователи', icon: <GroupIcon />, section: AdminDashboardSection.AdminUsers },
        { text: 'Статистика Сайта', icon: <QueryStatsIcon />, section: AdminDashboardSection.AdminSiteStats },
        { text: 'Чаты Поддержки', icon: <SupportAgentIcon />, section: AdminDashboardSection.AdminSupportChats },
        { text: 'Тарифы Рекламы', icon: <MonetizationOnIcon />, section: AdminDashboardSection.AdminAdvertisingSettings },
        { text: 'Реклама на Сайте', icon: <AdUnitsIcon />, section: AdminDashboardSection.AdminOnSiteAdManagement },
    ];

    const drawerContent = (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: isIconicOrMobileCollapsed ? 'center' : 'space-between', px: isIconicOrMobileCollapsed ? 1 : 2, minHeight: 'var(--header-height) !important' }}>
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700, color: 'primary.main', fontSize: '1.1rem' }}>
            {isIconicOrMobileCollapsed ? ADMIN_SIDEBAR_LOGO_ICON : "Админ-панель"}
          </Typography>
          {!isMobile && ( // Show desktop sidebar toggle only if not mobile
             <IconButton onClick={onToggleSidebar} sx={{display: isIconicOrMobileCollapsed ? 'none' : 'flex'}}>
                <ChevronLeftIcon />
            </IconButton>
          )}
        </Toolbar>
        <Divider />
        <List sx={{flexGrow: 1, pt:1}}>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                selected={currentAdminSection === item.section}
                onClick={() => onNavigateAdminSection(item.section)}
                sx={{
                  minHeight: 44, // Reduced
                  justifyContent: isIconicOrMobileCollapsed ? 'center' : 'initial',
                  px: 2, // Reduced
                  py: 0.75, // Reduced
                  borderRadius: 'var(--border-radius-small)',
                  mx: 1, mb: 0.25, // Reduced
                  '&.Mui-selected': { backgroundColor: 'action.selected' },
                }}
                title={item.text}
                aria-label={item.text}
              >
                <ListItemIcon sx={{ minWidth: 0, mr: isIconicOrMobileCollapsed ? 0 : 1.5, justifyContent: 'center', '& .MuiSvgIcon-root': { fontSize: '1.2rem' } }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} sx={{ opacity: isIconicOrMobileCollapsed ? 0 : 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', '& .MuiTypography-root': { fontSize: '0.875rem'} }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        <List>
            <ListItem disablePadding>
                <ListItemButton 
                    onClick={() => onNavigateGlobal(View.Dashboard)}
                    sx={{
                      minHeight: 44, // Reduced
                      justifyContent: isIconicOrMobileCollapsed ? 'center' : 'initial',
                      px: 2, // Reduced
                      py: 0.75, // Reduced
                      borderRadius: 'var(--border-radius-small)',
                      mx: 1, my: 1
                    }}
                    title="Назад в кабинет"
                    aria-label="Назад в личный кабинет"
                >
                    <ListItemIcon sx={{ minWidth: 0, mr: isIconicOrMobileCollapsed ? 0 : 1.5, justifyContent: 'center', '& .MuiSvgIcon-root': { fontSize: '1.2rem' } }}>
                        <ArrowBackIcon />
                    </ListItemIcon>
                    <ListItemText primary="В кабинет" sx={{ opacity: isIconicOrMobileCollapsed ? 0 : 1, whiteSpace: 'nowrap', '& .MuiTypography-root': { fontSize: '0.875rem'} }} />
                </ListItemButton>
            </ListItem>
        </List>
      </Box>
    );

    return (
        <Box sx={{ display: 'flex', height: 'calc(100vh - var(--header-height))' }} className={`admin-dashboard-layout dashboard-layout ${isSidebarCollapsed && !isMobile ? 'sidebar-collapsed sidebar-style-iconic' : ''}`}>
            <Drawer
                variant={isMobile ? "temporary" : "permanent"}
                open={isMobile ? !isSidebarCollapsed : true} // On mobile, !isSidebarCollapsed means open
                onClose={isMobile ? onToggleSidebar : undefined} // Only allow close via toggle on mobile
                ModalProps={{ keepMounted: true }} 
                sx={{
                    width: isMobile && !isSidebarCollapsed ? 'var(--dashboard-sidebar-width)' : (isMobile && isSidebarCollapsed ? 0 : sidebarWidth),
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: isMobile && !isSidebarCollapsed ? 'var(--dashboard-sidebar-width)' : (isMobile && isSidebarCollapsed ? 0 : sidebarWidth),
                        boxSizing: 'border-box',
                        borderRight: `1px solid ${theme.palette.divider}`,
                        top: 'var(--header-height)', 
                        height: 'calc(100% - var(--header-height))', 
                        transition: theme.transitions.create('width', {
                            easing: theme.transitions.easing.sharp,
                            duration: theme.transitions.duration.enteringScreen,
                        }),
                        overflowX: 'hidden',
                        // backgroundColor and color could be influenced by personalizationSettings.sidebarFill here
                    },
                }}
            >
                {drawerContent}
            </Drawer>
            <Box 
                component="main" 
                className="admin-content dashboard-content"
                sx={{ 
                    flexGrow: 1, 
                    p: personalizationSettings.contentLayout === 'spacious' ? 'var(--content-padding-spacious)' : 'var(--content-padding)', 
                    overflowY: 'auto', 
                    width: `calc(100% - ${isMobile && isSidebarCollapsed ? 0 : sidebarWidth})`,
                    ml: isMobile && !isSidebarCollapsed ? 0 : (isMobile && isSidebarCollapsed ? 0 : 0) // Adjust margin if drawer is permanent
                }} 
                aria-labelledby="admin-content-title"
            >
                {isMobile && ( // Show mobile toggle in content area if sidebar is closed
                    <IconButton
                        color="inherit"
                        aria-label="Открыть меню администратора"
                        edge="start"
                        onClick={onToggleSidebar} // This toggles isSidebarCollapsed in App.tsx
                        sx={{ 
                            display: { md: 'none' }, 
                            position: 'absolute', 
                            top: theme.spacing(1), 
                            left: theme.spacing(1), 
                            zIndex: theme.zIndex.drawer + 2 // Above drawer temp
                        }}
                    >
                        <MenuIcon />
                    </IconButton>
                )}
                {children}
            </Box>
        </Box>
    );
};