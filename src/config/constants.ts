
export const APP_NAME = "GameDev Factory";
export const GUEST_AI_REQUEST_LIMIT = 10;
export const USER_AI_REQUEST_LIMIT = 250;
export const PREMIUM_USER_AI_REQUEST_LIMIT = 10000;
export const REQUEST_RESET_INTERVAL_DAYS = 7;
export const MAX_SAVED_CHATS = 10;

// export const ADMIN_USER_VIHT_ID = 'viht-3owuiauy'; // Removed
// export const ADMIN_USER_EMAIL = 'symmalop@gmail.com'; // Removed

export interface AdminUserCredentials {
  viht_id: string;
  email: string;
}

export const ADMIN_USERS: AdminUserCredentials[] = [
  { viht_id: 'viht-3owuiauy', email: 'symmalop@gmail.com' },
  { viht_id: 'viht-b2yn', email: 'Lisenok319514@yandex.ru' },
  { viht_id: 'viht-ct18iv4r', email: 'anviht@yandex.ru' },
  // Добавьте сюда других администраторов при необходимости
];


// TODO: Пользователь должен проверить это значение!
// Убедитесь, что это имя ТОЧНО совпадает с именем бакета в вашем Supabase Storage.
// Если ваш бакет называется, например, 'my_support_files', измените значение ниже.
export const SUPPORT_ATTACHMENTS_BUCKET = 'support-attachments';