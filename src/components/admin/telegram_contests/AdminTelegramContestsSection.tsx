
import React, { useState } from 'react';
import { UserProfile } from '../../../types';
import { supabase } from '../../../api/clients';
import { Box, TextField, Button, Typography, Paper, CircularProgress, Alert, Grid, Divider } from '@mui/material';

interface AdminTelegramContestsSectionProps {
    currentUser: UserProfile | null;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface ContestDetails {
    title: string;
    description: string;
    prize: string;
    imageUrl?: string;
    buttonText?: string;
    buttonUrl?: string;
}

export const AdminTelegramContestsSection: React.FC<AdminTelegramContestsSectionProps> = ({ currentUser, showToast }) => {
    const [contestDetails, setContestDetails] = useState<ContestDetails>({
        title: '',
        description: '',
        prize: '',
        imageUrl: '',
        buttonText: '',
        buttonUrl: '',
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setContestDetails(prev => ({ ...prev, [name]: value }));
    };

    const handlePublishContest = async () => {
        if (!contestDetails.title || !contestDetails.description || !contestDetails.prize) {
            showToast('Заголовок, описание и приз являются обязательными полями.', 'error');
            return;
        }
        if (!supabase) {
            showToast('Клиент Supabase не инициализирован.', 'error');
            return;
        }

        setIsLoading(true);
        try {
            // IMPORTANT: The Edge Function must verify admin privileges of the calling user.
            // This is simplified here; in a real app, the JWT token would be sent.
            const { data, error: functionError } = await supabase.functions.invoke('post-telegram-contest', {
                body: { ...contestDetails },
            });

            if (functionError) {
                // Check for specific error message from function if admin check failed
                if (functionError.message.includes("Admin privileges required")) {
                     showToast('Ошибка: Требуются права администратора для выполнения этого действия.', 'error');
                } else {
                    throw functionError;
                }
            } else if (data?.error) { // Check for application-level error returned by the function
                 showToast(`Ошибка от функции: ${data.error}`, 'error');
            }
            else {
                showToast('Конкурс успешно опубликован в Telegram!', 'success');
                setContestDetails({ title: '', description: '', prize: '', imageUrl: '', buttonText: '', buttonUrl: '' }); // Reset form
            }
        } catch (err: any) {
            showToast(`Ошибка публикации конкурса: ${err.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box className="admin-telegram-contests-section">
            <Typography variant="h5" component="h2" gutterBottom id="admin-content-title" className="sub-page-title">
                Управление Конкурсами в Telegram
            </Typography>
            <Alert severity="info" sx={{ mb: 2, borderRadius: 'var(--border-radius)' }}>
                <strong>MVP:</strong> Эта форма позволяет опубликовать объявление о конкурсе в вашем Telegram-канале.
                Убедитесь, что <a href="https://github.com/AnViht/GameDev_Factory_Viht/blob/main/supabase/functions/post-telegram-contest/index.ts" target="_blank" rel="noopener noreferrer">Supabase Edge Function `post-telegram-contest`</a> развернута и правильно настроена с переменными окружения:
                `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`, `APP_SUPABASE_URL`, `APP_SERVICE_ROLE_KEY`, `ADMIN_USER_VIHT_IDS_CONFIG`, `ADMIN_USER_EMAILS_CONFIG`.
                Бот должен быть администратором в целевом канале.
            </Alert>
            <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 'var(--border-radius-large)' }}>
                <Typography variant="h6" gutterBottom>Создать новый конкурс</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Заголовок конкурса"
                            name="title"
                            value={contestDetails.title}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            required
                            variant="outlined"
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Описание и условия (Markdown)"
                            name="description"
                            value={contestDetails.description}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            required
                            multiline
                            rows={4}
                            variant="outlined"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Приз"
                            name="prize"
                            value={contestDetails.prize}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            required
                            variant="outlined"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="URL изображения (необязательно)"
                            name="imageUrl"
                            type="url"
                            value={contestDetails.imageUrl}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            variant="outlined"
                            placeholder="https://example.com/image.png"
                        />
                    </Grid>
                    <Grid item xs={12}> <Divider sx={{my:1}}><Typography variant="caption">Кнопка под постом (необязательно)</Typography></Divider> </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Текст кнопки (напр., 'Участвовать')"
                            name="buttonText"
                            value={contestDetails.buttonText}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            variant="outlined"
                        />
                    </Grid>
                     <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="URL для кнопки"
                            name="buttonUrl"
                            type="url"
                            value={contestDetails.buttonUrl}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            variant="outlined"
                            placeholder="https://t.me/your_bot?start=contest123"
                        />
                    </Grid>
                    <Grid item xs={12} sx={{ mt: 2, textAlign: 'right' }}>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handlePublishContest}
                            disabled={isLoading}
                            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
                        >
                            {isLoading ? 'Публикация...' : 'Опубликовать в Telegram'}
                        </Button>
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    );
};
