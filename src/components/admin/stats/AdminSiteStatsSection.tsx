import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../api/clients';
import { UserProfile } from '../../../types';
import { TOTAL_AD_CLICKS_KEY, DEFAULT_STATISTICS_VALUES } from '../../../config/settingsKeys';
import { Box, CircularProgress, Typography, Paper, Grid, Alert } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AdsClickIcon from '@mui/icons-material/AdsClick';

interface AdminSiteStatsSectionProps {
    currentUser: UserProfile | null;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface SiteStats {
    totalUsers: number | null;
    totalVisits: number | null; // Approximation: users who logged in at least once
    totalAdClicks: number | null;
}

export const AdminSiteStatsSection: React.FC<AdminSiteStatsSectionProps> = ({ currentUser, showToast }) => {
    const [stats, setStats] = useState<SiteStats>({
        totalUsers: null,
        totalVisits: null,
        totalAdClicks: null,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        if (!supabase) {
            setError("Клиент Supabase не инициализирован.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            let usersCount: number | null = null;
            let visitsCount: number | null = null;
            let adClicksCountValue: string | number = parseInt(DEFAULT_STATISTICS_VALUES[TOTAL_AD_CLICKS_KEY] || "0", 10);

            // Fetch total users
            const { data: usersData, error: usersError } = await supabase.rpc('admin_get_total_users_count');
            if (usersError) {
                if (usersError.message.includes("ACCESS_DENIED")) throw new Error("Доступ запрещен (всего пользователей). Убедитесь, что вы вошли как администратор и SQL функция admin_get_total_users_count настроена верно.");
                throw usersError;
            }
            usersCount = usersData;

            // Fetch total "visits" (approximated by users who logged in)
            const { data: visitsData, error: visitsError } = await supabase.rpc('admin_get_total_logins_count');
            if (visitsError) {
                 if (visitsError.message.includes("ACCESS_DENIED")) throw new Error("Доступ запрещен (всего входов). Убедитесь, что вы вошли как администратор и SQL функция admin_get_total_logins_count настроена верно.");
                throw visitsError;
            }
            visitsCount = visitsData;
            
            // Fetch total ad clicks from app_settings without .single()
            const { data: adClicksDataArray, error: adClicksError } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', TOTAL_AD_CLICKS_KEY)
                .limit(1); // Expect 0 or 1 row
            
            if (adClicksError) {
                 // Don't throw if it's just "not found", but log other errors
                if (adClicksError.code !== 'PGRST116') { // PGRST116 can be ignored if we expect the key might not exist
                     console.warn(`Ошибка загрузки кликов по рекламе: ${adClicksError.message}`);
                }
            }
            
            if (adClicksDataArray && adClicksDataArray.length > 0 && adClicksDataArray[0].value) {
                adClicksCountValue = parseInt(adClicksDataArray[0].value, 10);
            } else {
                adClicksCountValue = parseInt(DEFAULT_STATISTICS_VALUES[TOTAL_AD_CLICKS_KEY] || "0", 10);
            }


            setStats({
                totalUsers: usersCount,
                totalVisits: visitsCount,
                totalAdClicks: Number.isFinite(adClicksCountValue) ? adClicksCountValue : 0,
            });

        } catch (err: any) {
            setError(err.message || "Неизвестная ошибка при загрузке статистики.");
            showToast(err.message || "Ошибка загрузки статистики.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const StatCard: React.FC<{ title: string; value: number | string | null; icon: React.ReactNode; note?: string }> = ({ title, value, icon, note }) => (
        <Grid item={true} xs={12} sm={6} md={4}>
            <Paper sx={{ p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', borderRadius: 'var(--border-radius)' }} elevation={2}>
                <Box sx={{ fontSize: '2.5rem', color: 'primary.main', mb: 1 }}>{icon}</Box>
                <Typography variant="h6" component="h3" gutterBottom sx={{textAlign: 'center'}}>{title}</Typography>
                {value === null || isLoading ? (
                    <CircularProgress size={24} />
                ) : (
                    <Typography variant="h4" component="p" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </Typography>
                )}
                {note && <Typography variant="caption" color="text.secondary" sx={{mt: 1, textAlign: 'center'}}>{note}</Typography>}
            </Paper>
        </Grid>
    );


    if (isLoading && !error) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Загрузка статистики сайта...</Typography>
            </Box>
        );
    }
    
    return (
        <Box className="admin-site-stats-section">
            <Typography variant="h5" component="h2" gutterBottom id="admin-content-title" className="sub-page-title">
                Статистика Сайта
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 'var(--border-radius)' }}>{error}</Alert>}

            <Grid container spacing={3}>
                <StatCard 
                    title="Всего пользователей" 
                    value={stats.totalUsers} 
                    icon={<PeopleIcon fontSize="inherit" />} 
                    note="Общее количество зарегистрированных аккаунтов."
                />
                <StatCard 
                    title="Пользователей онлайн (Всего входов)" 
                    value={stats.totalVisits} 
                    icon={<VisibilityIcon fontSize="inherit" />}
                    note="Приблизительное количество уникальных пользователей, посетивших сайт (залогинившихся хотя бы раз)."
                />
                <StatCard 
                    title="Кликов по рекламе на сайте" 
                    value={stats.totalAdClicks} 
                    icon={<AdsClickIcon fontSize="inherit" />}
                    note="Общее количество кликов по рекламному блоку на сайте. Обновляется при клике (если настроено)."
                />
            </Grid>
            
            <Alert severity="info" sx={{ mt: 3, borderRadius: 'var(--border-radius)' }}>
              <Typography variant="body2"><strong>Примечание для Администратора:</strong></Typography>
              <Typography variant="caption" component="ul" sx={{pl: 2, listStyleType: 'disc'}}>
                <li>Данные о пользователях и входах получаются с помощью RPC функций `admin_get_total_users_count` и `admin_get_total_logins_count`. Убедитесь, что они созданы в Supabase SQL Editor и корректно настроены права доступа.</li>
                <li>"Пользователей онлайн" является аппроксимацией и показывает количество пользователей, которые совершили хотя бы один вход. Для точного отслеживания посещений рекомендуется интегрировать специализированные аналитические инструменты.</li>
                <li>Данные о кликах по рекламе считываются из таблицы `app_settings` (ключ: `{TOTAL_AD_CLICKS_KEY}`). Реализация самого механизма подсчета кликов (например, при клике на рекламный баннер) здесь не включена и требует отдельной настройки. Если ключ `{TOTAL_AD_CLICKS_KEY}` отсутствует в `app_settings`, будет показано значение по умолчанию (0).</li>
              </Typography>
            </Alert>
        </Box>
    );
};