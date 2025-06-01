
import { UserProfile } from '../types';
import { ADMIN_USER_VIHT_ID, ADMIN_USER_EMAIL, REQUEST_RESET_INTERVAL_DAYS } from '../config/constants';

export const generateVihtId = (): string => `viht-${Math.random().toString(36).substring(2, 10).padEnd(8, '0')}${Math.random().toString(36).substring(2, 8).padEnd(6, '0')}`;
export const generateClientKey = (): string => `ckey-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
export const generateClientSideId = (): string => `csid-${Math.random().toString(36).substring(2, 11)}`;

export const isUserAdmin = (user: UserProfile | null): boolean => {
    if (!user) return false;
    return user.user_metadata?.user_viht_id === ADMIN_USER_VIHT_ID && user.email === ADMIN_USER_EMAIL;
};

export const formatDate = (dateString?: string | Date | null, includeTime: boolean = false): string => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        return date.toLocaleString('ru-RU', options);
    } catch (e) {
        return 'Неверная дата';
    }
};

export const calculateNextResetDate = (lastResetISO?: string | null): Date | null => {
    if (!lastResetISO) return null;
    try {
        const lastReset = new Date(lastResetISO);
        const nextReset = new Date(lastReset);
        nextReset.setDate(lastReset.getDate() + REQUEST_RESET_INTERVAL_DAYS);
        return nextReset;
    } catch {
        return null;
    }
};
