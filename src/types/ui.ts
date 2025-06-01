
export type LandingPageSection = 'news' | 'projects' | 'about' | 'order';
export type Theme = 'light' | 'dark';

export interface PersonalizationSettings {
  fontSize: 'xs' | 's' | 'm' | 'l';
  sidebarStyle: 'normal' | 'compact' | 'iconic';
  sidebarFill: boolean; // Whether to use a fill color for sidebar
  headerStyle: 'fixedTop' | 'static' | 'fixedWidth'; // fixedWidth not fully implemented here, needs more CSS
  headerFill: boolean; // Whether to use a fill color for header
  contentLayout: 'square' | 'fullWidth' | 'spacious'; // spacious adds more padding
}
