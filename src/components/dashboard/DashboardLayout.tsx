

import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, PersonalizationSettings } from '../../types';
import { View, DashboardSection } from '../../enums/appEnums';
import { isUserAdmin } from '../../utils/helpers';
import { supabase } from '../../api/clients'; // Added supabase import
import {
    ONSITE_AD_TITLE_KEY, ONSITE_AD_DESCRIPTION_KEY, ONSITE_AD_URL_KEY, ONSITE_AD_ACTIVE_KEY,
    DEFAULT_ONSITE_AD_CONTENT
} from '../../config/settingsKeys';

import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, CircularProgress, useMediaQuery, Divider, Toolbar, Theme as MuiTheme } from '@mui/material';
import { useTheme } from '@mui/material/styles'; // Corrected import for useTheme
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ChatIcon from '@mui/icons-material/Chat';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import IconButton from '@mui/material/IconButton';


interface DashboardLayoutProps {
  user: UserProfile;
  onLogout: () => void; // Kept for potential use, though logout usually in Header
  currentSection: DashboardSection;
  onNavigateSection: (section: DashboardSection) => void;
  personalizationSettings: PersonalizationSettings; // Added
  children: React.ReactNode;
  onNavigateGlobal: (view: View) => void;
}

interface SiteAdContent { title: string; description: string; url: string; active: boolean; }

const SIDEBAR_LOGO_ICON = '🚀'; 

// Define a type for menu items to handle the admin redirect case explicitly
interface DashboardMenuItem {
  text: string;
  icon: React.ReactNode; 
  section: DashboardSection | 'ADMIN_DASHBOARD_NAV_ACTION'; // Unique string literal for admin nav
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  user, currentSection, onNavigateSection, personalizationSettings, children, onNavigateGlobal
}) => {
  const theme = useTheme<MuiTheme>(); // MuiTheme is alias for @mui/material/styles/Theme
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };
  
  const getSidebarWidth = () => {
    if (personalizationSettings.sidebarStyle === 'compact') return 'var(--dashboard-sidebar-width-compact)';
    if (personalizationSettings.sidebarStyle === 'iconic') return 'var(--dashboard-sidebar-width-iconic)';
    return 'var(--dashboard-sidebar-width)';
  };
  const sidebarWidth = getSidebarWidth();
  const isIconicSidebar = personalizationSettings.sidebarStyle === 'iconic';


  const [siteAdContent, setSiteAdContent] = useState<SiteAdContent>({
    title: DEFAULT_ONSITE_AD_CONTENT[ONSITE_AD_TITLE_KEY] || "Реклама",
    description: DEFAULT_ONSITE_AD_CONTENT[ONSITE_AD_DESCRIPTION_KEY] || "Узнайте больше!",
    url: DEFAULT_ONSITE_AD_CONTENT[ONSITE_AD_URL_KEY] || "#",
    active: DEFAULT_ONSITE_AD_CONTENT[ONSITE_AD_ACTIVE_KEY] === 'true',
  });
  const [isLoadingAd, setIsLoadingAd] = useState(true);

  const fetchSiteAdContent = useCallback(async () => { 
    if (!supabase) { setIsLoadingAd(false); return; }
    setIsLoadingAd(true);
    try {
        const keysToFetch = [ONSITE_AD_TITLE_KEY, ONSITE_AD_DESCRIPTION_KEY, ONSITE_AD_URL_KEY, ONSITE_AD_ACTIVE_KEY];
        const { data, error } = await supabase.from('app_settings').select('key, value').in('key', keysToFetch);
        if (error) throw error;
        const fetchedSettings: Record<string, string> = {};
        data?.forEach(setting => { if (setting.key && setting.value) fetchedSettings[setting.key] = setting.value; });
        setSiteAdContent({
            title: fetchedSettings[ONSITE_AD_TITLE_KEY] || DEFAULT_ONSITE_AD_CONTENT[ONSITE_AD_TITLE_KEY]!,
            description: fetchedSettings[ONSITE_AD_DESCRIPTION_KEY] || DEFAULT_ONSITE_AD_CONTENT[ONSITE_AD_DESCRIPTION_KEY]!,
            url: fetchedSettings[ONSITE_AD_URL_KEY] || DEFAULT_ONSITE_AD_CONTENT[ONSITE_AD_URL_KEY]!,
            active: (fetchedSettings[ONSITE_AD_ACTIVE_KEY] ?? DEFAULT_ONSITE_AD_CONTENT[ONSITE_AD_ACTIVE_KEY]!) === 'true',
        });
    } catch (error) { /* console.error("Error fetching site ad content:", error); */ } 
    finally { setIsLoadingAd(false); }
  }, []);

  useEffect(() => { fetchSiteAdContent(); }, [fetchSiteAdContent]);

  const menuItems: DashboardMenuItem[] = [
    { text: 'Аккаунт', icon: <AccountCircleIcon />, section: DashboardSection.Account },
    { text: 'Viht ИИ', icon: <ChatIcon />, section: DashboardSection.AIChat },
    { text: 'Реклама и Услуги', icon: <StorefrontIcon />, section: DashboardSection.ServicesAndAds },
    { text: 'Настройки', icon: <SettingsApplicationsIcon />, section: DashboardSection.AppSettings },
    { text: 'Помощь', icon: <HelpOutlineIcon />, section: DashboardSection.HelpChat },
  ];
  if (isUserAdmin(user)) {
    menuItems.push({ text: 'Управление', icon: <AdminPanelSettingsIcon />, section: 'ADMIN_DASHBOARD_NAV_ACTION' });
  }

  const handleAdClick = async (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (supabase) {
      try {
        const { error: rpcError } = await supabase.rpc('increment_ad_click_count');
        if (rpcError) {
          console.error('Error incrementing ad click count:', rpcError);
        } else {
          // console.log('Ad click count incremented.'); // For debugging
        }
      } catch (rpcCatchError) {
        console.error('Exception incrementing ad click count:', rpcCatchError);
      }
    }

    // Original navigation logic
    if (siteAdContent.url === '#') {
      e.preventDefault(); // Prevent default if it's an internal navigation
      onNavigateSection(DashboardSection.ServicesAndAds);
    }
    // If it's an external link, default anchor behavior will handle navigation after RPC.
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: isIconicSidebar ? 'center' : 'flex-start', px: isIconicSidebar ? 0 : 2.5, minHeight: 'var(--header-height) !important' }}>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700, color: 'primary.main' }}>
          {isIconicSidebar ? SIDEBAR_LOGO_ICON : "GameDev Factory"}
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{flexGrow: 1, pt: 1}}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
            <ListItemButton
              selected={item.section !== 'ADMIN_DASHBOARD_NAV_ACTION' && currentSection === item.section}
              onClick={() => item.section === 'ADMIN_DASHBOARD_NAV_ACTION' ? onNavigateGlobal(View.AdminDashboard) : onNavigateSection(item.section as DashboardSection)}
              sx={{
                minHeight: 48,
                justifyContent: isIconicSidebar ? 'center' : 'initial',
                px: 2.5,
                borderRadius: 'var(--border-radius-small)',
                mx: 1, mb: 0.5,
                '&.Mui-selected': {
                  backgroundColor: 'action.selected', 
                },
              }}
              title={item.text}
            >
              <ListItemIcon sx={{ minWidth: 0, mr: isIconicSidebar ? 0 : 2, justifyContent: 'center' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} sx={{ opacity: isIconicSidebar ? 0 : 1, whiteSpace: 'nowrap' }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      
      {!isIconicSidebar && !isLoadingAd && siteAdContent.active && (
        <Box className="sidebar-ad-placeholder" sx={{m: 2, p: 1.5, textAlign: 'center', borderRadius: 'var(--border-radius)'}}>
            <Typography component="a" 
              href={siteAdContent.url === '#' ? undefined : siteAdContent.url} 
              onClick={handleAdClick}
              target={siteAdContent.url === '#' ? '_self' : '_blank'}
              rel={siteAdContent.url === '#' ? '' : 'noopener noreferrer'} 
              aria-label={siteAdContent.title}
              sx={{textDecoration: 'none', color: 'inherit', display: 'block'}}
            >
              <Typography variant="subtitle2" component="h4" color="primary" gutterBottom>{siteAdContent.title}</Typography>
              <Typography variant="caption" color="text.secondary">{siteAdContent.description}</Typography>
            </Typography>
        </Box>
      )}
      {!isIconicSidebar && isLoadingAd && <Box sx={{p:2, textAlign:'center'}}><CircularProgress size={24} /></Box>}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - var(--header-height))' }} className={`dashboard-layout ${personalizationSettings.sidebarStyle !== 'normal' ? `sidebar-style-${personalizationSettings.sidebarStyle}` : ''}`}>
      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={isMobile ? mobileOpen : true}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }} 
        sx={{
          width: sidebarWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: sidebarWidth,
            boxSizing: 'border-box',
            borderRight: `1px solid ${theme.palette.divider}`,
            top: 'var(--header-height)', 
            height: 'calc(100% - var(--header-height))', 
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            overflowX: 'hidden',
            backgroundColor: personalizationSettings.sidebarFill ? theme.palette.primary.main : undefined, 
            color: personalizationSettings.sidebarFill ? theme.palette.primary.contrastText : undefined,
            '& .MuiListItemIcon-root': {
               color: personalizationSettings.sidebarFill ? theme.palette.primary.contrastText : undefined,
            }
          },
        }}
      >
        {drawerContent}
      </Drawer>
      <Box 
        component="main" 
        className={`dashboard-content ${personalizationSettings.contentLayout !== 'square' ? `layout-${personalizationSettings.contentLayout}` : ''}`}
        sx={{ 
          flexGrow: 1, 
          p: personalizationSettings.contentLayout === 'spacious' ? 'var(--content-padding-spacious)' : 'var(--content-padding)', 
          overflowY: 'auto', 
          maxWidth: personalizationSettings.contentLayout === 'fullWidth' ? '100%' : 'var(--content-max-width)',
          mx: personalizationSettings.contentLayout === 'fullWidth' ? 0 : 'auto',
          width: `calc(100% - ${isMobile ? 0 : sidebarWidth})`
        }} 
        aria-labelledby="dashboard-content-title"
      >
        {isMobile && (
            <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 2, display: { md: 'none' }, position: 'absolute', top: 8, left: 8, zIndex: 100 }}
            >
                <ChevronRightIcon />
            </IconButton>
        )}
        {children}
      </Box>
    </Box>
  );
};
