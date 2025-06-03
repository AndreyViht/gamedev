export interface DailyTaskDefinition {
  id: string;
  name: string;
  description: string;
  points: number;
  target_value: number; // How many actions to complete the task
  action_type: 'ai_message_count' | 'login_today' | 'custom_event'; // Type of action to track
  // 'custom_event' could be used for things like "visit 3 sections" - more complex to track
}

export const dailyTasksList: DailyTaskDefinition[] = [
  {
    id: 'daily_ai_3_messages',
    name: 'AI Собеседник',
    description: 'Отправьте 3 сообщения любому AI.',
    points: 5,
    target_value: 3,
    action_type: 'ai_message_count',
  },
  {
    id: 'daily_ai_10_messages',
    name: 'Активный Диалог',
    description: 'Отправьте 10 сообщений любому AI.',
    points: 15,
    target_value: 10,
    action_type: 'ai_message_count',
  },
  {
    id: 'daily_login',
    name: 'Ежедневный Визит',
    description: 'Войдите в систему сегодня.',
    points: 5,
    target_value: 1,
    action_type: 'login_today',
  },
  // Add more tasks here
  // {
  //   id: 'daily_explore_dashboard',
  //   name: 'Исследователь Кабинета',
  //   description: 'Посетите 2 разные секции в личном кабинете.',
  //   points: 8,
  //   target_value: 2,
  //   action_type: 'custom_event', // Needs specific tracking
  // },
];
