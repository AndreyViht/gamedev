import { UserProfile } from '../types';
import { isUserAdmin } from '../utils/helpers';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  isEarned: (user: UserProfile) => boolean;
  level?: 'bronze' | 'silver' | 'gold' | 'platinum';
  isSecret?: boolean;
  pointsAwarded: number; // Ensure all achievements have points
}

export const achievementsList: Achievement[] = [
  { id: 'pioneer', name: 'Первопроходец', description: 'Совершить первый вход в систему.', icon: '🚀', level: 'bronze', pointsAwarded: 10, isEarned: (user) => !!user.last_sign_in_at }, // Points for this are handled by first sign-in logic
  { id: 'newbie_chatter', name: 'Начинающий Оратор', description: 'Отправить 1-е сообщение AI.', icon: '💬', level: 'bronze', pointsAwarded: 5, isEarned: (user) => (user.user_metadata?.ai_requests_made ?? 0) >= 1 },
  { id: 'active_mind', name: 'Любознательный Ум', description: 'Сделать 10+ запросов к AI.', icon: '💡', level: 'silver', pointsAwarded: 15, isEarned: (user) => (user.user_metadata?.ai_requests_made ?? 0) >= 10 },
  { id: 'dialogue_expert', name: 'Эксперт Диалога', description: 'Сделать 50+ запросов к AI.', icon: '🗣️', level: 'gold', pointsAwarded: 30, isEarned: (user) => (user.user_metadata?.ai_requests_made ?? 0) >= 50 },
  { id: 'ai_enthusiast', name: 'AI Энтузиаст', description: 'Сделать 100+ запросов к AI.', icon: '🧠', level: 'gold', pointsAwarded: 50, isEarned: (user) => (user.user_metadata?.ai_requests_made ?? 0) >= 100 },
  { id: 'master_of_dialogue', name: 'Магистр Диалога', description: 'Сделать 250+ запросов к AI.', icon: '🎓', level: 'platinum', pointsAwarded: 100, isEarned: (user) => (user.user_metadata?.ai_requests_made ?? 0) >= 250 },
  { id: 'help_seeker', name: 'Искатель Помощи', description: 'Создать первое обращение в поддержку.', icon: '🆘', level: 'bronze', pointsAwarded: 10, isEarned: (user) => (user.user_metadata?.support_tickets_created ?? 0) >= 1 },
  { id: 'premium_supporter', name: 'VIP Клиент', description: 'Поддержать проект Премиум статусом.', icon: '💎', level: 'gold', pointsAwarded: 75, isEarned: (user) => user.user_metadata?.is_premium === true },
  { id: 'platform_demiurge', name: 'Демиург Платформы', description: 'Обладать правами Администратора.', icon: '👑', level: 'platinum', pointsAwarded: 150, isEarned: (user) => isUserAdmin(user) },
  { 
    id: 'easter_egg_explorer', 
    name: 'Секретный Исследователь', 
    description: 'Найти и активировать скрытую функцию или пасхалку на сайте.', 
    icon: '🗺️', 
    level: 'gold',
    pointsAwarded: 100,
    isSecret: true, 
    isEarned: (user) => user.user_metadata?.completed_secret_achievements?.includes('secret_feature_discovered_v1') ?? false,
  },
  // Add more achievements here
];
