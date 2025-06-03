
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User as SupabaseAuthUser, Session as SupabaseSession, AuthChangeEvent as SupabaseAuthChangeEvent, Subscription as SupabaseSubscription } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

import { ThemeProvider, createTheme, CssBaseline, Box, Fab, CircularProgress, Typography, Alert as MuiAlert } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';


import { supabase, genAI } from './api/clients';
import { View, DashboardSection, AdminDashboardSection } from './enums/appEnums';
import { Theme, LandingPageSection, NewsItem, ProjectItem, NewsItemDB, ProjectItemDB, UserProfile, PersonalizationSettings } from './types';
import { APP_NAME, GUEST_AI_REQUEST_LIMIT, USER_AI_REQUEST_LIMIT, PREMIUM_USER_AI_REQUEST_LIMIT, REQUEST_RESET_INTERVAL_DAYS, ADMIN_USERS } from './config/constants';
import { achievementsList, Achievement } from './config/achievements'; 
import { dailyTasksList, DailyTaskDefinition } from './config/dailyTasks'; 
import { generateVihtId, generateClientKey, isUserAdmin, calculateNextResetDate, generateClientSideId } from './utils/helpers';

import { Header } from './components/common/Header';
import { AppFooter } from './components/common/AppFooter';
// import CanvasBackground from './components/common/CanvasBackground'; 
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { AIChatPage } from './components/ai/AIChatPage';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { AccountSection } from './components/dashboard/AccountSection';
import { AppSettingsSection } from './components/dashboard/AppSettingsSection';
import { HelpChatSection } from './components/dashboard/help/HelpChatSection';
import { ServicesAndAdvertisingSection } from './components/dashboard/services_ads/ServicesAndAdvertisingSection';
import { AdminDashboardLayout } from './components/admin/AdminDashboardLayout';
import { AdminNewsSection } from './components/admin/news/AdminNewsSection';
import { AdminProjectsSection } from './components/admin/projects/AdminProjectsSection';
import { AdminUsersSection } from './components/admin/users/AdminUsersSection';
import { AdminSiteStatsSection } from './components/admin/stats/AdminSiteStatsSection'; // Added
import { AdminSupportChatsSection } from './components/admin/support/AdminSupportChatsSection';
import { AdminAdvertisingSettingsSection } from './components/admin/advertising/AdminAdvertisingSettingsSection';
import { AdminOnSiteAdManagementSection } from './components/admin/advertising/AdminOnSiteAdManagementSection'; 
import { ToastNotification, ToastConfig } from './components/common/ToastNotification';
import { PersonalizationModal } from './components/common/PersonalizationModal';
import { LegalInfoModal } from './components/common/LegalInfoModal';
import { VersionHistoryPage } from './components/common/VersionHistoryPage'; // Added


const getRandomNews = (): NewsItem[] => {
  const newsTitles = [
    "Революция в разработке игр: новый движок", "Indie Dev покоряет чарты", "VR-игры: следующий рубеж",
    "AI в геймдизайне: возможности и вызовы", "Крупный издатель анонсировал AAA-проект"
  ];
  const newsSummaries = [
    "Обзор передовых функций и потенциала для разработчиков.", "История успеха небольшой команды и их прорывной игры.",
    "Погружение в мир виртуальной реальности и перспективы развития.", "Как искусственный интеллект меняет подходы к созданию игровых миров.",
    "Первые подробности о долгожданной игре от известной студии."
  ];
  const selectedNews: NewsItem[] = [];
  const usedIndexes = new Set<number>();
  while (selectedNews.length < 3) { 
    const randomIndex = Math.floor(Math.random() * newsTitles.length);
    if (!usedIndexes.has(randomIndex)) {
      selectedNews.push({ id: `random-${selectedNews.length + 1}`, title: newsTitles[randomIndex], summary: newsSummaries[randomIndex], imageUrl: `https://picsum.photos/seed/${randomIndex + 10}/600/350`, created_at: new Date().toISOString(), is_published: true, action_buttons: [{text: "Подробнее", url: "#"}] });
      usedIndexes.add(randomIndex);
    }
  }
  return selectedNews;
};

const getPlaceholderProjects = (): ProjectItem[] => [
    { id: 1, title: "Космические Рейнджеры HD: Перезагрузка фанатов", description: "Фанатский ремейк легендарной игры с улучшенной графикой и новым контентом. В разработке энтузиастами.", imageUrl: `https://picsum.photos/seed/project1/600/350`, status: "В разработке", genre: "RPG / Стратегия", project_url: "https://example.com/sr-remake", source_code_url: "https://github.com/example/sr-remake" },
    { id: 2, title: "Pixel Warriors: Arena", description: "Динамичный платформер-арена с пиксельной графикой и множеством героев. Готов к бета-тесту!", imageUrl: `https://picsum.photos/seed/project2/600/350`, status: "Бета-тест", genre: "Платформер / Экшен", project_url: "https://example.com/pixel-warriors" },
];

const defaultPersonalizationSettings: PersonalizationSettings = {
  fontSize: 'm',
  sidebarStyle: 'normal',
  sidebarFill: false,
  headerStyle: 'fixedTop',
  headerFill: false,
  contentLayout: 'square',
};

const getStoredJson = <T extends string | number | boolean | object | null>(key: string, defaultValue: T, validator?: (value: any) => value is T): T => {
    try {
        const storedValue = localStorage.getItem(key);
        if (storedValue) {
            const parsed = JSON.parse(storedValue);
             if (validator ? validator(parsed) : true) {
                return parsed as T;
            }
        }
    } catch (e) {
        // console.warn(`Error reading or validating ${key} from localStorage`, e);
    }
    return defaultValue;
};

// --- LocalStorage Keys ---
const LS_KEY_CURRENT_VIEW = 'app_currentView_gdf_v2';
const LS_KEY_CURRENT_DASHBOARD_SECTION = 'app_currentDashboardSection_gdf_v2';
const LS_KEY_CURRENT_ADMIN_SECTION = 'app_currentAdminDashboardSection_gdf_v2';
const LS_KEY_CURRENT_LANDING_SECTION = 'app_currentLandingSection_gdf_v2';
const LS_KEY_HAS_VISITED_BEFORE = 'app_hasVisitedBefore_gdf_v2'; // Used to differentiate first-ever visit
const LS_KEY_THEME_MODE = 'themeMode_gdf_v2';
const LS_KEY_PERSONALIZATION_SETTINGS = 'personalizationSettings_gdf_v2';
const LS_KEY_GUEST_AI_REQUESTS = 'guestAiRequestsMade_gdf_v2';


export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(() => getStoredJson<View>(LS_KEY_CURRENT_VIEW, View.Landing, (v): v is View => Object.values(View).includes(v as View)));
  const [currentDashboardSection, setCurrentDashboardSection] = useState<DashboardSection>(() => getStoredJson<DashboardSection>(LS_KEY_CURRENT_DASHBOARD_SECTION, DashboardSection.Account, (v): v is DashboardSection => Object.values(DashboardSection).includes(v as DashboardSection)));
  const [currentAdminDashboardSection, setCurrentAdminDashboardSection] = useState<AdminDashboardSection>(() => getStoredJson<AdminDashboardSection>(LS_KEY_CURRENT_ADMIN_SECTION, AdminDashboardSection.AdminNews, (v): v is AdminDashboardSection => Object.values(AdminDashboardSection).includes(v as AdminDashboardSection)));
  const [currentLandingSection, setCurrentLandingSection] = useState<LandingPageSection>(() => getStoredJson<LandingPageSection>(LS_KEY_CURRENT_LANDING_SECTION, 'news', (v): v is LandingPageSection => ['news', 'projects', 'about', 'order'].includes(v)));
  
  const [themeMode, setThemeMode] = useState<Theme>(() => getStoredJson<Theme>(LS_KEY_THEME_MODE, 'light', (v): v is Theme => v === 'light' || v === 'dark'));
  const [personalizationSettings, setPersonalizationSettings] = useState<PersonalizationSettings>(() => 
    getStoredJson<PersonalizationSettings>(LS_KEY_PERSONALIZATION_SETTINGS, defaultPersonalizationSettings, (v): v is PersonalizationSettings => {
        return typeof v === 'object' && v !== null &&
               ['xs', 's', 'm', 'l'].includes(v.fontSize) &&
               ['normal', 'compact', 'iconic'].includes(v.sidebarStyle) &&
               typeof v.sidebarFill === 'boolean' &&
               ['fixedTop', 'static', 'fixedWidth'].includes(v.headerStyle) &&
               typeof v.headerFill === 'boolean' &&
               ['square', 'fullWidth', 'spacious'].includes(v.contentLayout);
    })
  );
  const [isPersonalizationModalOpen, setIsPersonalizationModalOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false); 
  
  const [dbNewsItems, setDbNewsItems] = useState<NewsItemDB[]>([]); 
  const [displayedNewsItems, setDisplayedNewsItems] = useState<NewsItem[]>([]);
  const [dbProjects, setDbProjects] = useState<ProjectItemDB[]>([]);
  const [displayedProjectItems, setDisplayedProjectItems] = useState<ProjectItem[]>([]);
  const [placeholderNewsItems] = useState<NewsItem[]>(getRandomNews()); 
  const [placeholderProjectItems] = useState<ProjectItem[]>(getPlaceholderProjects());
  
  const [sessionState, setSessionState] = useState<SupabaseSession | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [guestAiRequestsMade, setGuestAiRequestsMade] = useState(() => getStoredJson<number>(LS_KEY_GUEST_AI_REQUESTS, 0, (v): v is number => typeof v === 'number'));
  
  const [initialDataLoaded, setInitialDataLoaded] = useState(false); // Controls visibility of main loading screen
  const [initialViewLogicApplied, setInitialViewLogicApplied] = useState(false); // Ensures one-time view setup

  const [toasts, setToasts] = useState<ToastConfig[]>([]);

  const [isAdminSidebarCollapsed, setIsAdminSidebarCollapsed] = useState(false);
  const handleToggleAdminSidebar = () => setIsAdminSidebarCollapsed(prev => !prev);

  const muiTheme = useMemo(() => createTheme({
    palette: {
      mode: themeMode,
      primary: { main: themeMode === 'light' ? '#007AFF' : '#0A84FF' },
      secondary: { main: themeMode === 'light' ? '#5856D6' : '#5E5CE6' },
      background: {
        default: themeMode === 'light' ? '#F2F2F7' : '#000000',
        paper: themeMode === 'light' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(28, 28, 30, 0.85)',
      },
      text: {
        primary: themeMode === 'light' ? '#000000' : '#FFFFFF', 
        secondary: themeMode === 'light' ? '#3c3c4399' : '#8E8E93', 
      },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "-apple-system", BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
      fontSize: personalizationSettings.fontSize === 'xs' ? 13 : 
                personalizationSettings.fontSize === 's' ? 14.5 :
                personalizationSettings.fontSize === 'l' ? 17.5 : 16,
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)', 
          }
        }
      },
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme: currentMuiTheme }) => ({ 
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            backgroundColor: personalizationSettings.headerFill 
              ? (currentMuiTheme.palette.primary.main) 
              : (themeMode === 'light' ? 'rgba(242, 242, 247, 0.8)' : 'rgba(28, 28, 30, 0.8)'),   
            color: personalizationSettings.headerFill ? currentMuiTheme.palette.primary.contrastText : undefined,
            boxShadow: 'none',
            borderBottom: `1px solid ${themeMode === 'light' ? '#D1D1D6' : '#38383A'}`
          })
        }
      },
      MuiDrawer: {
         styleOverrides: {
          paper: ({ theme: currentMuiTheme }) => ({ 
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
             backgroundColor: personalizationSettings.sidebarFill
              ? (currentMuiTheme.palette.primary.light)
              : (themeMode === 'light' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(28, 28, 30, 0.8)'), 
          })
        }
      }
    }
  }), [themeMode, personalizationSettings]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    localStorage.setItem(LS_KEY_THEME_MODE, themeMode);
    document.body.classList.remove('font-size-xs', 'font-size-s', 'font-size-m', 'font-size-l');
    document.body.classList.add(`font-size-${personalizationSettings.fontSize}`);
  }, [themeMode, personalizationSettings.fontSize]);

  const handleToggleTheme = () => setThemeMode(prevMode => prevMode === 'light' ? 'dark' : 'light');
  
  const handleUpdatePersonalization = (settingsUpdate: Partial<PersonalizationSettings>) => {
    setPersonalizationSettings(prev => {
      const newSettings = { ...prev, ...settingsUpdate };
      localStorage.setItem(LS_KEY_PERSONALIZATION_SETTINGS, JSON.stringify(newSettings));
      return newSettings;
    });
  };

  const showToast = useCallback((messageText: string, toastType: ToastConfig['type'] = 'info', toastDuration: number = 5000) => {
    const toastId = generateClientSideId(); 
    setToasts(prevToasts => [...prevToasts, { id: toastId, message: messageText, type: toastType, duration: toastDuration }]);
  }, []);

  const closeToast = (idToClose: string) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== idToClose));
  };

  const fetchNewsFromSupabase = useCallback(async () => {
    if (!supabase) { return; }
    try {
        const { data: newsData, error: newsError } = await supabase.from('news_articles').select('*').order('created_at', { ascending: false });
        if (newsError) throw newsError;
        setDbNewsItems(newsData || []);
    } catch (error) { /* console.error("Error fetching news from Supabase:", error); */ }
  }, []); // Removed supabase from dep array as it's constant

  const fetchProjectsFromSupabase = useCallback(async () => {
    if (!supabase) { return; }
    try {
        const { data: projectsData, error: projectsError } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
        if (projectsError) throw projectsError;
        setDbProjects(projectsData || []);
    } catch (error) { /* console.error("Error fetching projects from Supabase:", error); */ }
  }, []); // Removed supabase from dep array

  useEffect(() => {
    const newsForLanding: NewsItem[] = dbNewsItems
        .filter(n => n.is_published)
        .map(n_db => ({
            id: n_db.id, title: n_db.title, content: n_db.content || '',
            summary: n_db.content ? (n_db.content.length > 150 ? n_db.content.substring(0, 150) + '...' : n_db.content) : '',
            imageUrl: n_db.image_url || undefined, created_at: n_db.created_at, is_published: n_db.is_published,
            action_buttons: n_db.action_buttons?.map(ab => ({ ...ab })) || [],
        }));
    setDisplayedNewsItems(newsForLanding);
  }, [dbNewsItems]);

  useEffect(() => {
    const projectsForLanding: ProjectItem[] = dbProjects
        .filter(p => p.is_published)
        .map(p_db => ({
            id: p_db.id, title: p_db.title, description: p_db.description || '', imageUrl: p_db.image_url,
            status: p_db.status || 'Не указан', genre: p_db.genre || 'Не указан',
            project_url: p_db.project_url, source_code_url: p_db.source_code_url,
        }));
    setDisplayedProjectItems(projectsForLanding);
  }, [dbProjects]);

  const processUserSessionLogic = useCallback(async (userToProcessParam: SupabaseAuthUser | UserProfile | null, isNewSignInEvent: boolean = false): Promise<UserProfile | null> => {
    if (!userToProcessParam || !supabase) { return userToProcessParam as UserProfile | null; }
    
    const baseUser = userToProcessParam as SupabaseAuthUser; // Treat as SupabaseAuthUser initially
    
    // Try to get existing UserProfile data if userToProcessParam was already a UserProfile
    const existingProfileData = (userToProcessParam as UserProfile).user_metadata 
                                  ? (userToProcessParam as UserProfile).user_metadata 
                                  : (baseUser.user_metadata || {});
    
    const userToProcess: UserProfile = {
        ...(baseUser as Omit<SupabaseAuthUser, 'user_metadata'>), // Cast baseUser to ensure correct properties are spread
        user_metadata: { // Start with Supabase's user_metadata, then layer our specific app data
            ...baseUser.user_metadata, 
            ...existingProfileData,
        },
    } as UserProfile; // Assert to UserProfile after constructing
    
    const metadata = userToProcess.user_metadata; // metadata is now CustomUserMetadata
    
    let needsServerUpdate = false;
    const now = new Date();
    const todayDateString = now.toISOString().split('T')[0];

    // Handle display_name: if our app's display_name is not set, try to use full_name from OAuth (e.g., Google)
    // Supabase user_metadata might contain 'full_name' from OAuth.
    if (!metadata.display_name && (baseUser.user_metadata as any)?.full_name) {
        metadata.display_name = (baseUser.user_metadata as any)?.full_name;
        needsServerUpdate = true;
    } else if (!metadata.display_name) { // Fallback if full_name is also missing
        metadata.display_name = userToProcess.email?.split('@')[0] || "Пользователь";
        needsServerUpdate = true;
    }


    let isAdminMatch = false;
    for (const adminCred of ADMIN_USERS) {
        if (userToProcess.email === adminCred.email) {
            if (metadata.user_viht_id !== adminCred.viht_id) {
                metadata.user_viht_id = adminCred.viht_id;
                needsServerUpdate = true;
            }
            isAdminMatch = true;
            break; 
        }
    }
    if (!isAdminMatch && !metadata.user_viht_id) {
        metadata.user_viht_id = generateVihtId();
        needsServerUpdate = true;
    }
    
    if (!metadata.client_key) { metadata.client_key = generateClientKey(); needsServerUpdate = true; }
    
    metadata.activity_points = typeof metadata.activity_points === 'number' ? metadata.activity_points : 0;
    metadata.awarded_achievement_points_log = metadata.awarded_achievement_points_log || {};
    metadata.support_tickets_created = typeof metadata.support_tickets_created === 'number' ? metadata.support_tickets_created : 0;
    metadata.completed_secret_achievements = Array.isArray(metadata.completed_secret_achievements) ? metadata.completed_secret_achievements : [];
    metadata.terms_agreed_at = typeof metadata.terms_agreed_at === 'string' ? metadata.terms_agreed_at : null;


    let isCurrentlyPremium = metadata.is_premium === true;
    const premiumExpiry = metadata.premium_expires_at ? new Date(metadata.premium_expires_at) : null;
    if (isCurrentlyPremium && premiumExpiry && premiumExpiry < now) {
        metadata.is_premium = false; metadata.premium_expires_at = null; isCurrentlyPremium = false; needsServerUpdate = true;
    }
     metadata.is_premium = metadata.is_premium === undefined ? false : metadata.is_premium; 
    
    const newAiLimit = isCurrentlyPremium ? PREMIUM_USER_AI_REQUEST_LIMIT : USER_AI_REQUEST_LIMIT;
    if (metadata.ai_requests_limit !== newAiLimit) { metadata.ai_requests_limit = newAiLimit; needsServerUpdate = true; }
    
    const lastResetDate = metadata.last_request_reset_at ? new Date(metadata.last_request_reset_at) : null;
    if (!lastResetDate || (now.getTime() - lastResetDate.getTime()) / (1000 * 60 * 60 * 24) >= REQUEST_RESET_INTERVAL_DAYS) {
        metadata.ai_requests_made = 0; metadata.last_request_reset_at = now.toISOString(); needsServerUpdate = true;
    }
    metadata.ai_requests_made = typeof metadata.ai_requests_made === 'number' ? metadata.ai_requests_made : 0;

    let currentDailyTasks = Array.isArray(metadata.daily_task_progress) ? metadata.daily_task_progress : [];
    let tasksUpdated = false;
    const processedTaskProgress: NonNullable<UserProfile['user_metadata']['daily_task_progress']> = [];
    for (const taskDef of dailyTasksList) {
        let userTask = currentDailyTasks.find(ut => ut.task_id === taskDef.id);
        if (userTask) {
            userTask.ai_generated_name = userTask.ai_generated_name ?? undefined;
            userTask.ai_generated_description = userTask.ai_generated_description ?? undefined;
            userTask.ai_generated_points = userTask.ai_generated_points ?? undefined;
            userTask.is_ai_refreshed = userTask.is_ai_refreshed ?? false;
            userTask.claimed_at_timestamp = userTask.claimed_at_timestamp ?? undefined;

            if (userTask.last_progress_date !== todayDateString && !userTask.claimed_at_timestamp) { 
                userTask.current_value = 0; userTask.completed_today = false; userTask.claimed_today = false;
                userTask.last_progress_date = todayDateString; 
                tasksUpdated = true;
            }
            processedTaskProgress.push(userTask);
        } else { 
            processedTaskProgress.push({ 
                task_id: taskDef.id, current_value: 0, completed_today: false, claimed_today: false, 
                last_progress_date: todayDateString,
                ai_generated_name: undefined, ai_generated_description: undefined, ai_generated_points: undefined,
                is_ai_refreshed: false, claimed_at_timestamp: undefined
            });
            tasksUpdated = true;
        }
    }
    if (tasksUpdated || currentDailyTasks.length !== processedTaskProgress.length) {
        metadata.daily_task_progress = processedTaskProgress; needsServerUpdate = true;
    }

    const achievementsToProcessImmediately = [
        { id: 'pioneer', condition: isNewSignInEvent },
        { id: 'platform_demiurge', condition: isUserAdmin({ ...userToProcess } as UserProfile) }, // Pass the constructed UserProfile
        { id: 'premium_supporter', condition: metadata.is_premium === true }
    ];

    const initialMetadataSnapshotForToast = JSON.parse(JSON.stringify(userToProcess.user_metadata || {}));

    for (const achInfo of achievementsToProcessImmediately) {
        const ach = achievementsList.find(a => a.id === achInfo.id);
        if (ach && achInfo.condition && !metadata.awarded_achievement_points_log?.[ach.id]) {
            metadata.activity_points = (metadata.activity_points || 0) + ach.pointsAwarded;
            if (!metadata.awarded_achievement_points_log) metadata.awarded_achievement_points_log = {};
            metadata.awarded_achievement_points_log[ach.id] = true;
            needsServerUpdate = true;
            if (!initialMetadataSnapshotForToast.awarded_achievement_points_log?.[ach.id]) { 
                 showToast(`Получено достижение: ${ach.name} (+${ach.pointsAwarded} ✨)`, 'success');
            }
        }
    }
    
    if (isNewSignInEvent) {
        const loginTaskDef = dailyTasksList.find(dt => dt.id === 'daily_login');
        const loginTaskProgress = metadata.daily_task_progress?.find(t => t.task_id === 'daily_login');
        if (loginTaskProgress && loginTaskDef && loginTaskProgress.last_progress_date === todayDateString && loginTaskProgress.current_value < loginTaskDef.target_value && !loginTaskProgress.completed_today) {
            loginTaskProgress.current_value = loginTaskDef.target_value; 
            loginTaskProgress.completed_today = true;
            needsServerUpdate = true;
            showToast(`Ежедневное задание "${loginTaskDef.name}" выполнено! Зайдите в раздел 'Аккаунт', чтобы забрать награду.`, 'info');
        }
    }
    
    if (needsServerUpdate) {
        try {
            const updatePayload = { ...metadata }; // Only update the metadata part

            const { data: updatedUserData, error: updateError } = await supabase.auth.updateUser({ data: updatePayload });
            if (updateError) {
                console.error("Error updating user metadata during session processing:", updateError);
                // Return the user object with the locally modified metadata, as server update failed
                return { ...userToProcess, user_metadata: metadata } as UserProfile; 
            }
            // Supabase returns the updated user. Merge it with our UserProfile structure.
            const supabaseReturnedUser = updatedUserData?.user;
            if (supabaseReturnedUser) {
                return {
                     ...(supabaseReturnedUser as Omit<SupabaseAuthUser, 'user_metadata'>),
                     user_metadata: { ...supabaseReturnedUser.user_metadata, ...updatePayload } as UserProfile['user_metadata']
                } as UserProfile;
            }
            return { ...userToProcess, user_metadata: metadata } as UserProfile;
        } catch (e) {
            console.error("Exception updating user metadata during session processing:", e);
            return { ...userToProcess, user_metadata: metadata } as UserProfile; 
        }
    }
    
    return { ...userToProcess, user_metadata: metadata } as UserProfile;
  }, [showToast, supabase]);


  const updateUserProfile = useCallback(async (updates: Partial<UserProfile['user_metadata']>) => {
    if (!user || !supabase) return;
    const currentMetaBeforeUpdate = JSON.parse(JSON.stringify(user.user_metadata || {})); 
    const newMetaAfterLocalUpdate = { ...currentMetaBeforeUpdate, ...updates };
    if (updates.daily_task_progress) { 
        newMetaAfterLocalUpdate.daily_task_progress = updates.daily_task_progress;
    }
    
    const finalMetaForServer = { ...newMetaAfterLocalUpdate };
    if (updates.support_tickets_created !== undefined && updates.support_tickets_created > (currentMetaBeforeUpdate.support_tickets_created || 0)) {
        const helpSeekerAch = achievementsList.find(ach => ach.id === 'help_seeker');
        const tempUserForCheck = { ...user, user_metadata: finalMetaForServer } as UserProfile;
        if (helpSeekerAch && helpSeekerAch.isEarned(tempUserForCheck) && !finalMetaForServer.awarded_achievement_points_log?.[helpSeekerAch.id] && helpSeekerAch.pointsAwarded > 0) {
            finalMetaForServer.activity_points = (finalMetaForServer.activity_points || 0) + helpSeekerAch.pointsAwarded;
            if (!finalMetaForServer.awarded_achievement_points_log) finalMetaForServer.awarded_achievement_points_log = {};
            finalMetaForServer.awarded_achievement_points_log[helpSeekerAch.id] = true;
            if (!currentMetaBeforeUpdate.awarded_achievement_points_log?.[helpSeekerAch.id]) {
                 showToast(`Достижение "${helpSeekerAch.name}" получено! +${helpSeekerAch.pointsAwarded} ✨`, 'success');
            }
        }
    }

    setUser(prev => prev ? ({ ...prev, user_metadata: finalMetaForServer }) as UserProfile : null); 

    try {
        const { error: updateError } = await supabase.auth.updateUser({ data: finalMetaForServer });
        if (updateError) {
            showToast(`Ошибка обновления профиля: ${updateError.message}`, 'error');
            setUser(prev => prev ? ({ ...prev, user_metadata: currentMetaBeforeUpdate }) as UserProfile : null); 
        }
    } catch (e: any) {
        showToast(`Исключение при обновлении профиля: ${e.message}`, 'error');
        setUser(prev => prev ? ({ ...prev, user_metadata: currentMetaBeforeUpdate }) as UserProfile : null); 
    }
  }, [user, supabase, showToast]);

  useEffect(() => { localStorage.setItem(LS_KEY_CURRENT_VIEW, JSON.stringify(currentView)); }, [currentView]);
  useEffect(() => { localStorage.setItem(LS_KEY_CURRENT_LANDING_SECTION, JSON.stringify(currentLandingSection)); }, [currentLandingSection]);
  useEffect(() => { localStorage.setItem(LS_KEY_CURRENT_DASHBOARD_SECTION, JSON.stringify(currentDashboardSection)); }, [currentDashboardSection]);
  useEffect(() => { localStorage.setItem(LS_KEY_CURRENT_ADMIN_SECTION, JSON.stringify(currentAdminDashboardSection)); }, [currentAdminDashboardSection]);

  const handleNavigation = useCallback((viewTarget: View) => {
    if ((viewTarget === View.Dashboard || viewTarget === View.AdminDashboard) && !user) { setCurrentView(View.Login); return; }
    if (viewTarget === View.AdminDashboard && !isUserAdmin(user)) { setCurrentView(View.Dashboard); return; } 
    setCurrentView(viewTarget);
    if (viewTarget === View.Dashboard) setCurrentDashboardSection(getStoredJson<DashboardSection>(LS_KEY_CURRENT_DASHBOARD_SECTION, DashboardSection.Account, (v): v is DashboardSection => Object.values(DashboardSection).includes(v as DashboardSection))); 
    if (viewTarget === View.AdminDashboard) setCurrentAdminDashboardSection(getStoredJson<AdminDashboardSection>(LS_KEY_CURRENT_ADMIN_SECTION, AdminDashboardSection.AdminNews, (v): v is AdminDashboardSection => Object.values(AdminDashboardSection).includes(v as AdminDashboardSection))); 
    if (viewTarget === View.Landing) setCurrentLandingSection(getStoredJson<LandingPageSection>(LS_KEY_CURRENT_LANDING_SECTION, 'news', (v): v is LandingPageSection => ['news', 'projects', 'about', 'order'].includes(v))); 
  }, [user]);


  // Effect for fetching initial data (news, projects) and session
  useEffect(() => {
    if (!supabase) { 
        setLoadingSession(false); 
        setInitialDataLoaded(true);
        return;
    }
    fetchNewsFromSupabase(); 
    fetchProjectsFromSupabase();

    let authListener: SupabaseSubscription | undefined;

    const getActiveSessionAndSubscribe = async () => {
      setLoadingSession(true);
      try {
        const { data: { session: activeSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError; 
        
        let currentUserAuth = activeSession?.user as SupabaseAuthUser | null;
        let processedCurrentUser: UserProfile | null = null;
        if (currentUserAuth) {
            processedCurrentUser = await processUserSessionLogic(currentUserAuth, false); 
        }
        setUser(processedCurrentUser); 
        setSessionState(activeSession);
        
      } catch (error) { 
          setUser(null); 
          setSessionState(null);
      } finally { 
          setLoadingSession(false); 
          setInitialDataLoaded(true); 
      }

      const { data: authListenerData } = supabase.auth.onAuthStateChange(async (event: SupabaseAuthChangeEvent, newSession: SupabaseSession | null) => {
        setLoadingSession(true); 
        try {
            let authChangeUserAuth = newSession?.user as SupabaseAuthUser | null;
            let processedAuthChangeUser: UserProfile | null = null;
            const isNewSignInEvent = event === 'SIGNED_IN' && (!sessionState || !sessionState.user || sessionState.user.id !== newSession?.user?.id);
            
            if (authChangeUserAuth) {
                processedAuthChangeUser = await processUserSessionLogic(authChangeUserAuth, isNewSignInEvent);
            }
            
            setUser(processedAuthChangeUser); 
            setSessionState(newSession); 
            
            if (event === 'PASSWORD_RECOVERY') {
                 setCurrentView(View.Login); 
                 showToast("Введите новый пароль или следуйте инструкциям, если вы запросили сброс.", "info");
            } else if (event === 'SIGNED_OUT') {
                const lastUserId = sessionState?.user?.id; 
                if (lastUserId) { 
                    localStorage.removeItem(`gameDevFactory_chats_vk_style_${lastUserId}`); 
                    localStorage.removeItem(`gameDevFactory_activeChatId_vk_style_${lastUserId}`); 
                }
                setGuestAiRequestsMade(getStoredJson<number>(LS_KEY_GUEST_AI_REQUESTS, 0, (v): v is number => typeof v === 'number'));
            }

        } catch (error) {
            setUser(null); setSessionState(null);
        } finally { 
            setLoadingSession(false); 
        }
      });
      authListener = authListenerData?.subscription;
    };

    getActiveSessionAndSubscribe();
    return () => { if (authListener) authListener.unsubscribe(); };
  }, [fetchNewsFromSupabase, fetchProjectsFromSupabase, processUserSessionLogic, showToast, supabase]); 


  // Effect for one-time initial view logic after session and data are loaded
  useEffect(() => {
    if (initialDataLoaded && !initialViewLogicApplied) {
        const visitedBefore = localStorage.getItem(LS_KEY_HAS_VISITED_BEFORE) === 'true';
        if (user) { 
            if (!visitedBefore) localStorage.setItem(LS_KEY_HAS_VISITED_BEFORE, 'true');
            
            if (currentView === View.Login || currentView === View.Register || currentView === View.AIChatGuest || currentView === View.VersionHistory) {
                handleNavigation(View.Dashboard);
            } else if (currentView === View.AdminDashboard && !isUserAdmin(user)) {
                 handleNavigation(View.Dashboard);
            }
        } else { 
            const allowedGuestViews = [View.Landing, View.Login, View.Register, View.AIChatGuest, View.VersionHistory];
            if (!allowedGuestViews.includes(currentView)) {
                handleNavigation(View.Landing);
            }
            if (!visitedBefore) localStorage.setItem(LS_KEY_HAS_VISITED_BEFORE, 'true');
        }
        setInitialViewLogicApplied(true);
    }
  }, [initialDataLoaded, user, currentView, handleNavigation, initialViewLogicApplied]);

  // Effect for checking and refreshing daily tasks if timers expired while user was offline
  useEffect(() => {
    if(user && user.user_metadata?.daily_task_progress && currentView === View.Dashboard && currentDashboardSection === DashboardSection.Account){
        const todayDateString = new Date().toISOString().split('T')[0];
        let needsUpdate = false;
        const updatedTasksProgress = user.user_metadata.daily_task_progress.map(tp => {
            if (tp.claimed_today && tp.claimed_at_timestamp) {
                const elapsed = (Date.now() - tp.claimed_at_timestamp) / 1000;
                if (elapsed >= 24 * 60 * 60) { // Timer expired
                    needsUpdate = true;
                }
            } else if(tp.last_progress_date !== todayDateString) { // New day, reset non-cooldown tasks
                needsUpdate = true;
                return {...tp, current_value:0, completed_today: false, claimed_today: false, last_progress_date: todayDateString};
            }
            return tp;
        });
        if(needsUpdate) {
            // The actual refresh logic (including AI call for new tasks) is in DailyTasksModal and AccountSection.
            // This effect primarily ensures data is consistent on app load for timer display.
            // If a task's timer expired offline, DailyTasksModal's useEffect will trigger refreshTaskAfterTimer.
        }
    }
  }, [user, currentView, currentDashboardSection, updateUserProfile]);


  useEffect(() => {
    let dynamicViewName = APP_NAME; 
    if (currentView === View.Landing) { 
      const sectionTitles: Record<LandingPageSection, string> = { news: "Новости", projects: "Проекты", about: "О нас", order: "Заказать" };
      dynamicViewName = sectionTitles[currentLandingSection] || "Главная";
    } else {
      const viewTitles: Record<View, string> = {
        [View.Landing]: "Главная", [View.Login]: "Вход", [View.Register]: "Регистрация",
        [View.Dashboard]: "Личный Кабинет", [View.AIChatGuest]: "AI Чат Гостя", 
        [View.AdminDashboard]: "Админ-Панель", [View.VersionHistory]: "История Версий"
      };
      dynamicViewName = viewTitles[currentView] || APP_NAME;
      if (currentView === View.Dashboard) {
        const sectionTitles: Record<DashboardSection, string> = {
            [DashboardSection.Account]: "Аккаунт", [DashboardSection.AIChat]: "Viht AI Чат",
            [DashboardSection.ServicesAndAds]: "Реклама и Услуги", [DashboardSection.AppSettings]: "Настройки",
            [DashboardSection.HelpChat]: "Помощь",
        };
        dynamicViewName = sectionTitles[currentDashboardSection] || dynamicViewName;
      } else if (currentView === View.AdminDashboard) {
        const adminSectionTitles: Record<AdminDashboardSection, string> = {
            [AdminDashboardSection.AdminNews]: "Упр. Новостями", [AdminDashboardSection.AdminProjects]: "Упр. Проектами",
            [AdminDashboardSection.AdminUsers]: "Упр. Пользователями", [AdminDashboardSection.AdminSiteStats]: "Статистика Сайта",
            [AdminDashboardSection.AdminSupportChats]: "Чаты Поддержки", [AdminDashboardSection.AdminAdvertisingSettings]: "Тарифы Рекламы", 
            [AdminDashboardSection.AdminOnSiteAdManagement]: "Реклама на Сайте"
        };
        dynamicViewName = adminSectionTitles[currentAdminDashboardSection] || dynamicViewName;
      }
    }
    document.title = `${APP_NAME} - ${dynamicViewName}`;
  }, [currentView, currentDashboardSection, currentAdminDashboardSection, currentLandingSection]);

  const handleDashboardSectionNavigation = (section: DashboardSection) => setCurrentDashboardSection(section);
  const handleAdminDashboardSectionNavigation = (section: AdminDashboardSection) => setCurrentAdminDashboardSection(section);
  const handleLandingSectionNavigation = (section: LandingPageSection) => setCurrentLandingSection(section);

  const handleLogout = async () => {
    if (!supabase) { showToast("Ошибка: Supabase не инициализирован.", "error"); return; }
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) { showToast(`Ошибка выхода: ${signOutError.message}`, "error");} 
    else { 
        handleNavigation(View.Landing);
    }
  };
  
  const handleAiRequestMade = useCallback(async () => {
    if (!user) { 
      const newGuestRequests = guestAiRequestsMade + 1;
      setGuestAiRequestsMade(newGuestRequests);
      localStorage.setItem(LS_KEY_GUEST_AI_REQUESTS, newGuestRequests.toString());
      if (newGuestRequests >= GUEST_AI_REQUEST_LIMIT) {
        showToast("Для гостей лимит запросов исчерпан. Зарегистрируйтесь для продолжения.", "info");
      }
      return;
    }

    const metadataCopy = JSON.parse(JSON.stringify(user.user_metadata || {})) as UserProfile['user_metadata']; 
    metadataCopy.ai_requests_made = (metadataCopy.ai_requests_made || 0) + 1;
    
    const initialMetadataSnapshotForToast = JSON.parse(JSON.stringify(user.user_metadata || {}));

    achievementsList.forEach(ach => {
      if (ach.id.includes('chatter') || ach.id.includes('mind') || ach.id.includes('expert') || ach.id.includes('enthusiast') || ach.id.includes('master_of_dialogue')) {
        const tempUserForCheck = { ...user, user_metadata: metadataCopy } as UserProfile; 
        if (ach.isEarned(tempUserForCheck) && !metadataCopy.awarded_achievement_points_log?.[ach.id] && ach.pointsAwarded > 0) {
          metadataCopy.activity_points = (metadataCopy.activity_points || 0) + ach.pointsAwarded;
          if (!metadataCopy.awarded_achievement_points_log) metadataCopy.awarded_achievement_points_log = {};
          metadataCopy.awarded_achievement_points_log[ach.id] = true;
          if(!initialMetadataSnapshotForToast.awarded_achievement_points_log?.[ach.id]) {
            showToast(`Достижение "${ach.name}" получено! +${ach.pointsAwarded} ✨`, 'success');
          }
        }
      }
    });

    const aiMessageTasks = dailyTasksList.filter(task => task.action_type === 'ai_message_count');
    if (metadataCopy.daily_task_progress) {
      aiMessageTasks.forEach(taskDef => {
        const taskProgress = metadataCopy.daily_task_progress!.find(tp => tp.task_id === taskDef.id);
        if (taskProgress && taskProgress.last_progress_date === new Date().toISOString().split('T')[0] && !taskProgress.completed_today) {
          taskProgress.current_value += 1;
          if (taskProgress.current_value >= taskDef.target_value) {
            taskProgress.completed_today = true;
            if(!initialMetadataSnapshotForToast.daily_task_progress?.find((tp: any) => tp.task_id === taskDef.id)?.completed_today) {
                 showToast(`Ежедневное задание "${taskProgress.ai_generated_name || taskDef.name}" выполнено! Зайдите в раздел 'Аккаунт', чтобы забрать награду.`, 'info');
            }
          }
        }
      });
    }
    await updateUserProfile(metadataCopy);
  }, [user, guestAiRequestsMade, showToast, updateUserProfile]);

  const handleAgreeToTerms = async () => {
    if (user) {
        await updateUserProfile({ terms_agreed_at: new Date().toISOString() });
        showToast("Условия приняты.", "success");
    }
    setIsLegalModalOpen(false);
  };


  if (loadingSession || !initialDataLoaded) {
    return (
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <Box className="app-container loading-app" sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ mt: 2 }}>Загрузка {APP_NAME}...</Typography>
        </Box>
      </ThemeProvider>
    );
  }

  const renderContent = () => {
    switch (currentView) {
      case View.Landing:
        return <LandingPage news={displayedNewsItems.length > 0 ? displayedNewsItems : placeholderNewsItems} projects={displayedProjectItems.length > 0 ? displayedProjectItems : placeholderProjectItems} activeSection={currentLandingSection} onNavigateToSection={handleLandingSectionNavigation} onNavigate={handleNavigation} />;
      case View.Login:
        return <LoginPage onNavigate={handleNavigation} />;
      case View.Register:
        return <RegisterPage onNavigate={handleNavigation} />;
      case View.AIChatGuest: 
        if (!genAI) return <Box sx={{p:3, textAlign:'center'}}><MuiAlert severity="error">Gemini AI клиент не инициализирован.</MuiAlert></Box>;
        return <AIChatPage genAI={genAI} user={null} onAiRequestMade={handleAiRequestMade} onNavigate={handleNavigation} isInsideDashboard={false} globalAiRequestsMade={guestAiRequestsMade} globalAiRequestsLimit={GUEST_AI_REQUEST_LIMIT} />;
      case View.Dashboard:
        if (!user || !genAI) { handleNavigation(View.Login); return null; }
        return (
          <DashboardLayout user={user} onLogout={handleLogout} currentSection={currentDashboardSection} onNavigateSection={handleDashboardSectionNavigation} personalizationSettings={personalizationSettings} onNavigateGlobal={handleNavigation}>
            {currentDashboardSection === DashboardSection.Account && <AccountSection user={user} onNavigateSection={handleDashboardSectionNavigation} onUserProfileUpdate={updateUserProfile} showToast={showToast} />}
            {currentDashboardSection === DashboardSection.AIChat && <AIChatPage genAI={genAI} user={user} onAiRequestMade={handleAiRequestMade} onNavigate={handleNavigation} isInsideDashboard={true} globalAiRequestsMade={user.user_metadata?.ai_requests_made || 0} globalAiRequestsLimit={user.user_metadata?.ai_requests_limit || USER_AI_REQUEST_LIMIT}/>}
            {currentDashboardSection === DashboardSection.ServicesAndAds && <ServicesAndAdvertisingSection onNavigateToHelpChat={() => handleDashboardSectionNavigation(DashboardSection.HelpChat)} />}
            {currentDashboardSection === DashboardSection.AppSettings && <AppSettingsSection user={user} showToast={showToast} />}
            {currentDashboardSection === DashboardSection.HelpChat && <HelpChatSection user={user} onUserProfileUpdate={updateUserProfile} showToast={showToast} />}
          </DashboardLayout>
        );
      case View.AdminDashboard:
        if (!user || !isUserAdmin(user) || !genAI) { handleNavigation(View.Login); return null; }
        return (
          <AdminDashboardLayout user={user} currentAdminSection={currentAdminDashboardSection} onNavigateAdminSection={handleAdminDashboardSectionNavigation} isSidebarCollapsed={isAdminSidebarCollapsed} onToggleSidebar={handleToggleAdminSidebar} onNavigateGlobal={handleNavigation} showToast={showToast} personalizationSettings={personalizationSettings}>
            {currentAdminDashboardSection === AdminDashboardSection.AdminNews && <AdminNewsSection user={user} onDataChange={fetchNewsFromSupabase} />}
            {currentAdminDashboardSection === AdminDashboardSection.AdminProjects && <AdminProjectsSection user={user} onDataChange={fetchProjectsFromSupabase} />}
            {currentAdminDashboardSection === AdminDashboardSection.AdminUsers && <AdminUsersSection currentUser={user} showToast={showToast} />}
            {currentAdminDashboardSection === AdminDashboardSection.AdminSiteStats && <AdminSiteStatsSection currentUser={user} showToast={showToast} />}
            {currentAdminDashboardSection === AdminDashboardSection.AdminSupportChats && <AdminSupportChatsSection currentUser={user} showToast={showToast} />}
            {currentAdminDashboardSection === AdminDashboardSection.AdminAdvertisingSettings && <AdminAdvertisingSettingsSection currentUser={user} showToast={showToast} />}
            {currentAdminDashboardSection === AdminDashboardSection.AdminOnSiteAdManagement && <AdminOnSiteAdManagementSection currentUser={user} showToast={showToast} />}
          </AdminDashboardLayout>
        );
      case View.VersionHistory:
        return <VersionHistoryPage onNavigateBack={() => handleNavigation(View.Landing)} />;
      default:
        return <LandingPage news={displayedNewsItems.length > 0 ? displayedNewsItems : placeholderNewsItems} projects={displayedProjectItems.length > 0 ? displayedProjectItems : placeholderProjectItems} activeSection={currentLandingSection} onNavigateToSection={handleLandingSectionNavigation} onNavigate={handleNavigation}/>;
    }
  };

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      {/* <CanvasBackground /> */}
      <Box className="app-container">
        <Header
          onNavigate={handleNavigation}
          isLoggedIn={!!user}
          onLogout={handleLogout}
          theme={themeMode}
          onToggleTheme={handleToggleTheme}
          userDisplayName={user?.user_metadata?.display_name}
          personalizationSettings={personalizationSettings}
        />
        <main className="main-content">
          {renderContent()}
        </main>
        <AppFooter 
            onOpenLegalModal={() => setIsLegalModalOpen(true)} 
            onNavigateToVersionHistory={() => handleNavigation(View.VersionHistory)}
        />
      </Box>
      <Box className="toast-notification-container">
        {toasts.map(toast => (
          <ToastNotification key={toast.id} {...toast} onClose={closeToast} />
        ))}
      </Box>
      <Fab
        color="primary"
        aria-label="Настройки персонализации"
        onClick={() => setIsPersonalizationModalOpen(true)}
        sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1500 }}
        size="medium"
      >
        <SettingsIcon />
      </Fab>
      {isPersonalizationModalOpen && (
        <PersonalizationModal
          isOpen={isPersonalizationModalOpen}
          onClose={() => setIsPersonalizationModalOpen(false)}
          currentSettings={personalizationSettings}
          onUpdateSettings={handleUpdatePersonalization}
          currentTheme={themeMode}
          onToggleTheme={handleToggleTheme}
        />
      )}
      {isLegalModalOpen && (
        <LegalInfoModal
          isOpen={isLegalModalOpen}
          onClose={() => setIsLegalModalOpen(false)}
          onAgree={handleAgreeToTerms}
          hasAgreed={!!user?.user_metadata?.terms_agreed_at}
          agreementDate={user?.user_metadata?.terms_agreed_at ? new Date(user.user_metadata.terms_agreed_at) : null}
          isUserLoggedIn={!!user}
        />
      )}
    </ThemeProvider>
  );
};
