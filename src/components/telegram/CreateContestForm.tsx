import React, { useState }
from 'react';
import { Box, TextField, Button, Typography, Paper, CircularProgress, Grid, Alert } from '@mui/material';
import { supabase } from '../../api/clients'; // Assuming supabase client is here

interface ContestDetails {
    title: string;
    description: string;
    prize: string;
    imageUrl?: string;
    buttonText?: string;
    buttonUrl?: string;
}

interface CreateContestFormProps {
    channelId: string;
    telegramUserId: number; // For context/logging, not auth
    onClose: () => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const CreateContestForm: React.FC<CreateContestFormProps> = ({ channelId, telegramUserId, onClose, showToast }) => {
    const [contestDetails, setContestDetails] = useState<ContestDetails>({
        title: '',
        description: '',
        prize: '',
        imageUrl: '',
        buttonText: '',
        buttonUrl: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setContestDetails(prev => ({ ...prev, [name]: value }));
        setFormError(null); // Clear error on input change
    };

    const handleSubmitContest = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        if (!contestDetails.title || !contestDetails.description || !contestDetails.prize) {
            setFormError('Заголовок, описание и приз являются обязательными полями.');
            return;
        }
        if (!supabase) {
            setFormError('Клиент Supabase не инициализирован.');
            return;
        }

        setIsLoading(true);
        try {
            // IMPORTANT: The Edge Function 'post-telegram-contest' must verify admin privileges of the calling user.
            // The current 'post-telegram-contest' function uses a fixed channel ID from its environment variables.
            // For this iteration, we are sending `channelId` and `telegramUserId` for potential future use
            // by an updated Edge Function, but the current function will likely ignore them and post to its configured channel.
            const payload = {
                ...contestDetails,
                targetChannelId: channelId, // Pass the selected channel ID to the Edge Function
                // requested_by_telegram_user_id: telegramUserId, // For logging/context in Edge Function
            };

            const { data, error: functionError } = await supabase.functions.invoke('post-telegram-contest', {
                body: payload,
            });

            if (functionError) {
                if (functionError.message.includes("Admin privileges required")) {
                     showToast('Ошибка: Требуются права администратора для выполнения этого действия.', 'error');
                     setFormError('Ошибка: Требуются права администратора.'); // Show specific error if applicable
                } else {
                    throw functionError; // Rethrow other function errors
                }
            } else if (data?.error) {
                 showToast(`Ошибка от функции: ${data.error}`, 'error');
                 setFormError(`Ошибка от функции: ${data.error}`);
            } else {
                showToast(`Конкурс для канала ${channelId} успешно отправлен на публикацию!`, 'success');
                onClose(); // Close form on success
            }
        } catch (err: any) {
            showToast(`Ошибка публикации конкурса: ${err.message}`, 'error');
            setFormError(`Ошибка: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    

    return (
        <Box className="landing-page" sx={{ maxWidth: '800px', mx: 'auto', py: 3 }}>
            <Paper component="form" onSubmit={handleSubmitContest} elevation={3} sx={{ p: { xs: 2, sm: 4 }, borderRadius: 'var(--border-radius-large)' }}>
                <Typography variant="h5" component="h2" gutterBottom sx={{ textAlign: 'center', fontWeight: 600, mb:2 }}>
                    Создание конкурса для канала: {channelId}
                </Typography>
                {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
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
                            helperText="Обязательное поле"
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Описание и условия (Markdown поддерживается)"
                            name="description"
                            value={contestDetails.description}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            required
                            multiline
                            rows={5}
                            variant="outlined"
                            helperText="Обязательное поле. Опишите суть конкурса, правила участия, сроки."
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
                            helperText="Обязательное поле. Что получит победитель?"
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
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{mt:1, mb:0.5, color: 'text.secondary'}}>Кнопка под постом (необязательно):</Typography>
                    </Grid>
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
                    <Grid item xs={12} sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                         <Button
                            variant="outlined"
                            color="inherit"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            Отмена
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            color="primary"
                            disabled={isLoading}
                            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
                        >
                            {isLoading ? 'Публикация...' : 'Опубликовать'}
                        </Button>
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    );
};