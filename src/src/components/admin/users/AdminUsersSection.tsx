import React, { useState } from 'react';
import { UserProfile, SearchedUserAdminView } from '../../../types';
import { supabase } from '../../../api/clients';
import { USER_AI_REQUEST_LIMIT, PREMIUM_USER_AI_REQUEST_LIMIT } from '../../../config/constants';
import { formatDate, calculateNextResetDate } from '../../../utils/helpers';
import { PointsInputModal } from '../../common/PointsInputModal';
import { AddAdminModal } from './AddAdminModal'; // New Modal for adding admins
import { Box, TextField, Button, Typography, Paper, CircularProgress, Alert, Grid } from '@mui/material';

interface AdminUsersSectionProps {
    currentUser: UserProfile | null;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const AdminUsersSection: React.FC<AdminUsersSectionProps> = ({ currentUser, showToast }) => {
    const [searchKey, setSearchKey] = useState('');
    const [searchedUser, setSearchedUser] = useState<SearchedUserAdminView | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const [showExpiryDatePicker, setShowExpiryDatePicker] = useState(false);
    const [premiumExpiryDate, setPremiumExpiryDate] = useState<string>(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    
    const [isPointsModalOpen, setIsPointsModalOpen] = useState(false);
    const [isUpdatingPoints, setIsUpdatingPoints] = useState(false);

    const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState(false); // State for new admin modal

    const fetchUserByVihtId_admin_rpc = async (vihtIdToSearch: string): Promise<SearchedUserAdminView | null> => {
        if (!supabase) throw new Error("Клиент Supabase не инициализирован.");
        try {
            const { data: rpcResponse, error: rpcError } = await supabase.rpc('admin_get_user_by_viht_id', { p_viht_id_to_search: vihtIdToSearch });
            if (rpcError) {
                if (rpcError.message.includes("ACCESS_DENIED")) throw new Error("Доступ запрещен. Убедитесь, что вы вошли как администратор.");
                throw new Error(rpcError.message || "Ошибка RPC при поиске пользователя.");
            }
            return rpcResponse as SearchedUserAdminView | null;
        } catch (e: any) { showToast(e.message || "Клиентская ошибка при вызове RPC функции поиска.", 'error'); throw e; }
    };
    
    const updateUserMetadata_admin_rpc = async (userIdToUpdate: string, metadataUpdates: Partial<UserProfile['user_metadata']> ): Promise<boolean> => {
        if (!supabase) { showToast("Клиент Supabase не инициализирован.", 'error'); return false; }
        try {
            const currentUserData = searchedUser?.id === userIdToUpdate ? searchedUser : await fetchUserByVihtId_admin_rpc(searchKey.trim());
            if (!currentUserData) throw new Error("Не удалось получить текущие метаданные пользователя для обновления.");
            const existingMetadata = JSON.parse(JSON.stringify(currentUserData.user_metadata || {}));
            const finalMetadataToSend = { ...existingMetadata, ...metadataUpdates };
            const { data: rpcSuccess, error: rpcError } = await supabase.rpc('admin_update_user_metadata', { p_user_id_to_update: userIdToUpdate, p_metadata_updates: finalMetadataToSend });
            if (rpcError) {
                 if (rpcError.message.includes("ACCESS_DENIED")) throw new Error("Доступ запрещен (обновление). Убедитесь, что вы вошли как администратор.");
                 else if (rpcError.message.includes("USER_NOT_FOUND")) throw new Error(`Пользователь с ID ${userIdToUpdate} не найден для обновления.`);
                 throw new Error(rpcError.message || "Ошибка RPC при обновлении метаданных пользователя.");
            }
            return rpcSuccess === true;
        } catch (e: any) { showToast(e.message || "Клиентская ошибка при вызове RPC функции обновления.", 'error'); return false; }
    };

    const handleSearchUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchKey.trim()) { showToast("Введите ID Пользователя (viht-...) для поиска.", 'info'); return; }
        setIsLoading(true); setSearchedUser(null); setShowExpiryDatePicker(false);
        try {
            const user = await fetchUserByVihtId_admin_rpc(searchKey.trim());
            if (user) setSearchedUser(user);
            else showToast(`Пользователь с таким ID (viht-${searchKey.trim().replace(/^viht-/, '')}) не найден или нет доступа.`, 'error');
        } catch (err: any) { /* fetchUserByVihtId_admin_rpc already calls showToast */ }
        finally { setIsLoading(false); }
    };

    const handleSetPremium = async () => {
        if (!searchedUser) return;
        setIsLoading(true);
        const expiry = new Date(premiumExpiryDate); expiry.setHours(23, 59, 59, 999);
        const existingMetadata = JSON.parse(JSON.stringify(searchedUser.user_metadata || {}));
        const newMetadata: UserProfile['user_metadata'] = { ...existingMetadata, is_premium: true, premium_expires_at: expiry.toISOString(), ai_requests_limit: PREMIUM_USER_AI_REQUEST_LIMIT };
        try {
            const success = await updateUserMetadata_admin_rpc(searchedUser.id, newMetadata);
            if (success) {
                showToast(`Премиум-статус для ${searchedUser.user_metadata.display_name || searchedUser.email} теперь активен до ${formatDate(expiry)}. Баллы и достижение будут присвоены при следующей сессии пользователя.`, 'success');
                setShowExpiryDatePicker(false);
                const updatedUser = await fetchUserByVihtId_admin_rpc(searchKey.trim());
                if (updatedUser) setSearchedUser(updatedUser);
            } else showToast("Не удалось обновить статус пользователя.", 'error');
        } catch (err: any) { /* updateUserMetadata_admin_rpc calls showToast */ }
        finally { setIsLoading(false); }
    };

    const handleRemovePremium = async () => {
        if (!searchedUser) return;
        if (!window.confirm(`Вы уверены, что хотите убрать премиум-статус у пользователя ${searchedUser.user_metadata.display_name || searchedUser.email}?`)) return;
        setIsLoading(true);
        const existingMetadata = JSON.parse(JSON.stringify(searchedUser.user_metadata || {}));
        const newMetadata: UserProfile['user_metadata'] = { ...existingMetadata, is_premium: false, premium_expires_at: null, ai_requests_limit: USER_AI_REQUEST_LIMIT };
        try {
            const success = await updateUserMetadata_admin_rpc(searchedUser.id, newMetadata);
             if (success) {
                showToast(`Премиум-статус для ${searchedUser.user_metadata.display_name || searchedUser.email} убран.`, 'success');
                const updatedUser = await fetchUserByVihtId_admin_rpc(searchKey.trim());
                if (updatedUser) setSearchedUser(updatedUser);
            } else showToast("Не удалось обновить статус пользователя.", 'error');
        } catch (err: any) { /* updateUserMetadata_admin_rpc calls showToast */ }
        finally { setIsLoading(false); }
    };
    
    const handleSavePoints = async (pointsToAdd: number) => {
        if (!searchedUser) return;
        setIsUpdatingPoints(true);
        setIsPointsModalOpen(false);

        const existingMetadata = JSON.parse(JSON.stringify(searchedUser.user_metadata || {}));
        const currentPoints = existingMetadata.activity_points || 0;
        const newActivityPoints = currentPoints + pointsToAdd;
        const metadataUpdatePayload: Partial<UserProfile['user_metadata']> = { activity_points: newActivityPoints };

        try {
            const success = await updateUserMetadata_admin_rpc(searchedUser.id, metadataUpdatePayload);
            if (success) {
                showToast(`${pointsToAdd} балл(ов) успешно добавлено. Новый баланс: ${newActivityPoints} ✨.`, 'success');
                const updatedUser = await fetchUserByVihtId_admin_rpc(searchKey.trim()); // Refresh user data
                if (updatedUser) setSearchedUser(updatedUser);
            } else showToast("Не удалось обновить баллы пользователя.", 'error');
        } catch (err: any) { /* updateUserMetadata_admin_rpc calls showToast */ }
        finally { setIsUpdatingPoints(false); }
    };

    const handleAddAdmin = async (email: string, vihtId: string): Promise<{success: boolean, message: string}> => {
        if (!supabase) {
            return { success: false, message: "Клиент Supabase не инициализирован." };
        }
        try {
            // RPC function `admin_assign_viht_id_to_user` will check if the caller is an admin.
            const { data, error: rpcError } = await supabase.rpc('admin_assign_viht_id_to_user', {
                target_user_email: email,
                target_viht_id: vihtId
            });

            if (rpcError) {
                throw new Error(rpcError.message || "Ошибка RPC при назначении Viht ID.");
            }

            if (data && data.success) {
                // If a user was being viewed, refresh their data if it's the one being made admin.
                if (searchedUser && searchedUser.email === email) {
                    const updatedUser = await fetchUserByVihtId_admin_rpc(searchKey.trim());
                    if (updatedUser) setSearchedUser(updatedUser);
                }
                return { success: true, message: data.message || "Viht ID успешно назначен. Не забудьте обновить ADMIN_USERS в коде и перезапустить приложение."};
            } else {
                return { success: false, message: data?.error || "Не удалось назначить Viht ID."};
            }
        } catch (e: any) {
            return { success: false, message: e.message || "Клиентская ошибка при добавлении администратора." };
        }
    };
    
    const metadata = searchedUser?.user_metadata;
    const nextReset = metadata?.last_request_reset_at ? calculateNextResetDate(metadata.last_request_reset_at) : null;

    return (
        <Box>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap'}}>
                <Typography variant="h5" component="h2" gutterBottom id="admin-content-title" className="sub-page-title" sx={{mb: {xs:1, sm:0}}}>Управление Пользователями</Typography>
                <Button 
                    variant="contained" 
                    onClick={() => setIsAddAdminModalOpen(true)}
                    className="admin-add-button primary-button"
                >
                    Добавить Админ
                </Button>
            </Box>
            
            <Paper component="form" onSubmit={handleSearchUser} sx={{ p: 2, mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField 
                    fullWidth
                    label="Поиск по ID пользователя (viht-...)"
                    id="admin-user-search-key" 
                    value={searchKey} 
                    onChange={(e) => setSearchKey(e.target.value)} 
                    placeholder="Введите ID пользователя" 
                    disabled={isLoading || isUpdatingPoints}
                    variant="outlined"
                    size="small"
                />
                <Button type="submit" variant="contained" disabled={isLoading || isUpdatingPoints}>
                    {isLoading ? <CircularProgress size={24} /> : 'Найти'}
                </Button>
            </Paper>

            <Alert severity="info" sx={{mb: 2, borderRadius: 'var(--border-radius)'}}>
              <Typography variant="body2"><strong>Примечание для Администратора:</strong></Typography>
              <Typography variant="caption" component="ul" sx={{pl: 2, listStyleType: 'disc'}}>
                <li>Для поиска и управления пользователями используются SQL-функции (`admin_get_user_by_viht_id` и `admin_update_user_metadata`).</li>
                <li>Убедитесь, что SQL-функции корректно созданы в Supabase SQL Editor (с `SECURITY DEFINER` и `GRANT EXECUTE ... TO authenticated`).</li>
                <li>SQL-функции проверяют, является ли вызывающий администратором.</li>
                <li>**Добавление нового администратора:** После использования кнопки "Добавить Админ" и успешного назначения Viht ID, необходимо **вручную обновить массив `ADMIN_USERS` в файле `src/config/constants.ts`**, добавив email и Viht ID нового администратора, а затем **пересобрать и перезапустить приложение**.</li>
              </Typography>
            </Alert>

            {isLoading && !searchedUser && <Box sx={{display: 'flex', justifyContent: 'center', my: 3}}><CircularProgress /></Box>}
            
            {searchedUser && metadata && (
                <Paper sx={{ p: 3, mt: 2, borderRadius: 'var(--border-radius-large)' }}>
                    <Typography variant="h6" gutterBottom>Информация о пользователе</Typography>
                    <Grid container spacing={1.5}>
                        <Grid xs={12} sm={6}><Typography variant="body2"><strong>Логин:</strong> {metadata.display_name || 'N/A'}</Typography></Grid>
                        <Grid xs={12} sm={6}><Typography variant="body2"><strong>Email:</strong> {searchedUser.email || 'N/A'}</Typography></Grid>
                        <Grid xs={12} sm={6}><Typography variant="body2"><strong>ID (viht):</strong> {metadata.user_viht_id || 'N/A'}</Typography></Grid>
                        <Grid xs={12} sm={6}><Typography variant="body2"><strong>Supabase ID:</strong> {searchedUser.id || 'N/A'}</Typography></Grid>
                        <Grid xs={12} sm={6}><Typography variant="body2"><strong>Премиум:</strong> {metadata.is_premium ? `Да (до ${formatDate(metadata.premium_expires_at)})` : 'Нет'}</Typography></Grid>
                        <Grid xs={12} sm={6}><Typography variant="body2"><strong>AI Запросы:</strong> {metadata.ai_requests_made ?? 0} / {metadata.ai_requests_limit ?? (metadata.is_premium ? PREMIUM_USER_AI_REQUEST_LIMIT : USER_AI_REQUEST_LIMIT)}</Typography></Grid>
                        <Grid xs={12} sm={6}><Typography variant="body2"><strong>Сброс запросов:</strong> {nextReset ? formatDate(nextReset) : 'N/A'}</Typography></Grid>
                        <Grid xs={12} sm={6}><Typography variant="body2"><strong>Баллы Активности:</strong> {metadata.activity_points || 0} ✨</Typography></Grid>
                    </Grid>
                    
                    <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
                        {!metadata.is_premium || (metadata.premium_expires_at && new Date(metadata.premium_expires_at) < new Date()) ? (
                            <>
                                <Button variant="contained" onClick={() => setShowExpiryDatePicker(true)} disabled={isLoading || showExpiryDatePicker || isUpdatingPoints}>Дать Премиум</Button>
                                {showExpiryDatePicker && (
                                    <Paper sx={{p: 2, mt:1, display: 'flex', flexDirection: 'column', gap: 1.5, border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 'var(--border-radius)'}}>
                                        <TextField type="date" label="Дата окончания премиума" value={premiumExpiryDate}
                                            onChange={(e) => setPremiumExpiryDate(e.target.value)}
                                            InputLabelProps={{ shrink: true }}
                                            inputProps={{ min: new Date().toISOString().split('T')[0] }}
                                            disabled={isLoading || isUpdatingPoints} size="small"
                                        />
                                        <Box sx={{display: 'flex', gap: 1}}>
                                            <Button variant="contained" onClick={handleSetPremium} disabled={isLoading || isUpdatingPoints} size="small">Подтвердить</Button>
                                            <Button variant="outlined" onClick={() => setShowExpiryDatePicker(false)} disabled={isLoading || isUpdatingPoints} size="small">Отмена</Button>
                                        </Box>
                                    </Paper>
                                )}
                            </>
                        ) : (
                            <Button variant="outlined" color="error" onClick={handleRemovePremium} disabled={isLoading || isUpdatingPoints}>Убрать Премиум</Button>
                        )}
                        <Button variant="contained" color="secondary" onClick={() => setIsPointsModalOpen(true)} disabled={isLoading || isUpdatingPoints}>Добавить баллы</Button>
                    </Box>
                </Paper>
            )}
            {isPointsModalOpen && searchedUser && (
                <PointsInputModal
                    isOpen={isPointsModalOpen}
                    onClose={() => setIsPointsModalOpen(false)}
                    onSave={handleSavePoints}
                    userName={searchedUser.user_metadata.display_name || searchedUser.email || 'Пользователь'}
                    currentPoints={searchedUser.user_metadata.activity_points || 0}
                    isLoading={isUpdatingPoints}
                />
            )}
            <AddAdminModal
                isOpen={isAddAdminModalOpen}
                onClose={() => setIsAddAdminModalOpen(false)}
                onAddAdmin={handleAddAdmin}
            />
        </Box>
    );
};