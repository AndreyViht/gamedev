
export enum View {
  Landing = 'LANDING',
  Login = 'LOGIN',
  Register = 'REGISTER',
  Dashboard = 'DASHBOARD',
  AIChatGuest = 'AI_CHAT_GUEST',
  AdminDashboard = 'ADMIN_DASHBOARD',
  VersionHistory = 'VERSION_HISTORY', // Added
}

export enum DashboardSection {
  Account = 'ACCOUNT',
  AIChat = 'AI_CHAT',
  ServicesAndAds = 'SERVICES_AND_ADS', // New combined section
  // Order = 'ORDER', // Removed
  // Advertising = 'ADVERTISING',  // Removed
  AppSettings = 'APP_SETTINGS',
  HelpChat = 'HELP_CHAT',
}

export enum AdminDashboardSection {
  AdminNews = 'ADMIN_NEWS',
  AdminProjects = 'ADMIN_PROJECTS',
  AdminUsers = 'ADMIN_USERS',
  AdminSiteStats = 'ADMIN_SITE_STATS', // Added Site Statistics
  AdminSupportChats = 'ADMIN_SUPPORT_CHATS',
  AdminAdvertisingSettings = 'ADMIN_ADVERTISING_SETTINGS',
  AdminOnSiteAdManagement = 'ADMIN_ON_SITE_AD_MANAGEMENT', // Added for managing on-site ad content
  AdminTelegramContests = 'ADMIN_TELEGRAM_CONTESTS', // Added for Telegram contests
}