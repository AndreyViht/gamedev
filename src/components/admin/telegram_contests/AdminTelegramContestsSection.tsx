
import React, { useState, useCallback } from 'react';
import { UserProfile } from '../../../types';
import { supabase } from '../../../api/clients';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { genAI } from '../../../api/clients';
import { Box, TextField, Button, Typography, Paper, CircularProgress, Grid, Alert, Checkbox, FormControlLabel, IconButton, Tooltip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'; // Для кнопки AI

// Интерфейсы остаются такими же, как в вашем CreateContestForm
interface ContestConditionDetails {
    subscribeChannelLink?: string;
    reactToPost?: boolean;
    joinGroupLink?: string;
}
interface ContestDetails {
    title: string;
    description: string;
    prize: string;
    imageUrl?: string;
    buttonText?: string; // Текст для кнопки "Участвовать"
    numberOfWinners?: number;
    endDate?: string;
    conditions?: ContestConditionDetails;
}

interface AdminTelegramContestsSectionProps {
    currentUser: UserProfile | null;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const AdminTelegramContestsSection: React.FC<AdminTelegramContestsSectionProps> = ({ currentUser, showToast }) => {
    const [contestDetails, setContestDetails] = useState<ContestDetails>({
        title: '',
        description: '',
        prize: '',
        imageUrl: '',
        buttonText: 'Участвовать', // Текст по умолчанию
        numberOfWinners: 1,
        endDate: '',
        conditions: {
            subscribeChannelLink: undefined, // Инициализируем как undefined
            reactToPost: false,
            joinGroupLink: undefined, // Инициализируем как undefined
        }
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Для выбора канала, если у админа их несколько. Пока используем targetChannelId из env.
    // const [targetChannelId, setTargetChannelId] = useState(''); // Можно добавить поле для ввода ID канала

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = event.target;
        if (type === 'number' && name === 'numberOfWinners') {
            const numVal = parseInt(value, 10);
            if (numVal < 1) setContestDetails(prev => ({ ...prev, [name]: 1 }));
            else if (numVal > 100) setContestDetails(prev => ({ ...prev, [name]: 100 }));
            else setContestDetails(prev => ({ ...prev, [name]: numVal || undefined }));
        } else {
            setContestDetails(prev => ({ ...prev, [name]: value }));
        }
        setFormError(null);
    };

    const handleConditionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked, value, type } = event.target;
        if (name === "subscribeChannelCheckbox") {
            setContestDetails(prev => ({
                ...prev,
                conditions: {
                    ...prev.conditions,
                    subscribeChannelLink: checked ? (prev.conditions?.subscribeChannelLink || '') : undefined
                }
            }));
        } else if (name === "joinGroupCheckbox") {
             setContestDetails(prev => ({
                ...prev,
                conditions: {
                    ...prev.conditions,
                    joinGroupLink: checked ? (prev.conditions?.joinGroupLink || '') : undefined
                }
            }));
        } else if (name === "subscribeChannelLink" || name === "joinGroupLink") { // Прямое изменение текстовых полей ссылок
             setContestDetails(prev => ({
                ...prev,
                conditions: {
                    ...prev.conditions,
                    [name]: value,
                }
            }));
        }
        else { // Для reactToPost
            setContestDetails(prev => ({
                ...prev,
                conditions: {
                    ...prev.conditions,
                    [name]: type === 'checkbox' ? checked : value,
                }
            }));
        }
    };

    const generateDescriptionWithAI = useCallback(async () => {
        if (!genAI) {
            showToast("Клиент Gemini AI не инициализирован.", "error");
            return;
        }
        if (!contestDetails.title) {
            showToast("Пожалуйста, сначала введите заголовок конкурса для генерации описания.", "info");
            return;
        }
        setIsAiGenerating(true);
        setFormError(null);
        try {
            const prompt = \`Ты — креативный копирайтер, специализирующийся на увлекательных анонсах для Telegram.
Нужно написать привлекательное описание для конкурса под названием "\${contestDetails.title}".
Твоя задача — сделать описание живым, интересным и призывающим к действию, используя:
- Эмодзи (уместно и по теме).
- Хорошее форматирование с отступами и абзацами (используй Markdown переносы строк, например, два пробела в конце строки или пустая строка между абзацами).
- Энтузиазм и позитивный тон.
Важно:
- Не придумывай условия конкурса, призы, даты или количество победителей. Эти детали пользователь введет отдельно.
- Просто создай общее привлекательное описание, которое заинтересует людей в конкурсе "\${contestDetails.title}".
- Описание должно быть не слишком длинным, идеально для поста в Telegram (3-5 абзацев).
- Не используй слова "конкурс" или "\${contestDetails.title}" слишком часто, если это не звучит естественно.
Пример структуры (но не копируй дословно, будь оригинальным!):
"🎉 Эй, друзья! Готовы к чему-то невероятному? Мы запускаем нечто особенное, связанное с "\${contestDetails.title}"! 🚀
Вас ждет море позитива, интересные моменты и, конечно же, крутые возможности! ✨
Не упустите свой шанс стать частью этого захватывающего события! Следите за анонсами! 😉"
Сгенерируй только сам текст описания.\`;

            const response: GenerateContentResponse = await genAI.models.generateContent({
                model: "gemini-2.5-flash-preview-04-17",
                contents: prompt,
            });

            setContestDetails(prev => ({ ...prev, description: response.text }));
            showToast("Описание сгенерировано AI!", "success");

        } catch (error: any) {
            console.error("AI Description generation error:", error);
            let displayErrorMessage = \`Ошибка генерации описания AI: \${error.message || "Неизвестная ошибка"}\`;
            if (error.message && error.message.toLowerCase().includes("region")) {
                 displayErrorMessage = "Включите пожалуйста VPN (данная проблема будет временно)";
            }
            showToast(displayErrorMessage, "error");
            setFormError(displayErrorMessage);
        } finally {
            setIsAiGenerating(false);
        }
    }, [genAI, contestDetails.title, showToast]);

    const handleSubmitContest = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        if (!currentUser) {
            setFormError('Пользователь не авторизован.');
            return;
        }
        if (!contestDetails.title || !contestDetails.description || !contestDetails.prize || !contestDetails.numberOfWinners || !contestDetails.endDate) {
            setFormError('Заголовок, описание, приз, кол-во победителей и дата окончания являются обязательными.');
            return;
        }
        if (contestDetails.numberOfWinners < 1 || contestDetails.numberOfWinners > 100) {
            setFormError('Количество победителей должно быть от 1 до 100.');
            return;
        }
        if (new Date(contestDetails.endDate) <= new Date()) {
            setFormError('Дата окончания конкурса должна быть в будущем.');
            return;
        }

        const conditions = contestDetails.conditions || {};
        const subscribeCheckboxChecked = !!conditions.subscribeChannelLink; // Проверяем наличие текста, а не чекбокса
        if (subscribeCheckboxChecked && !conditions.subscribeChannelLink?.trim()) {
            setFormError('Если выбрана подписка на канал, укажите ссылку на канал.');
            return;
        }
        const joinGroupCheckboxChecked = !!conditions.joinGroupLink; // Проверяем наличие текста
        if (joinGroupCheckboxChecked && !conditions.joinGroupLink?.trim()) {
            setFormError('Если выбрано вступление в группу, укажите ссылку на группу.');
            return;
        }

        if (!supabase) {
            setFormError('Клиент Supabase не инициализирован.');
            return;
        }

        setIsLoading(true);
        try {
            const finalConditions: ContestConditionDetails = {};
            if (conditions.subscribeChannelLink?.trim()) {
                finalConditions.subscribeChannelLink = conditions.subscribeChannelLink.trim();
            }
            if (conditions.reactToPost) {
                finalConditions.reactToPost = true;
            }
            if (conditions.joinGroupLink?.trim()) {
                finalConditions.joinGroupLink = conditions.joinGroupLink.trim();
            }

            const payload = {
                ...contestDetails,
                conditions: Object.keys(finalConditions).length > 0 ? finalConditions : undefined,
                // targetChannelId: targetChannelId, // Раскомментировать, если есть поле для ввода ID канала
            };
            console.log("Payload to Edge Function (AdminContestsSection):", payload);

            const functionName = 'post-telegram-contest';
            const { data, error: functionError } = await supabase.functions.invoke(functionName, {
                body: payload,
            });

            if (functionError) {
                if (functionError.message.includes("Admin privileges required")) {
                     showToast('Ошибка: Требуются права администратора.', 'error');
                     setFormError('Ошибка: Требуются права администратора.');
                } else {
                    throw functionError;
                }
            } else if (data?.error) {
                 showToast(\`Ошибка от функции: \${data.error}\`, 'error');
                 setFormError(\`Ошибка от функции: \${data.error}\`);
            } else if (data?.success) {
                showToast('Конкурс успешно опубликован!', 'success');
                // Reset form
                setContestDetails({ title: '', description: '', prize: '', imageUrl: '', buttonText: 'Участвовать', numberOfWinners: 1, endDate: '', conditions: { subscribeChannelLink: undefined, reactToPost: false, joinGroupLink: undefined }});
            } else {
                console.warn("Function response did not explicitly state success or error.", data);
                showToast("Запрос на публикацию конкурса отправлен. Проверьте канал.", "info");
            }
        } catch (err: any) {
            showToast(\`Ошибка публикации конкурса: \${err.message}\`, 'error');
            setFormError(\`Ошибка: \${err.message}\`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box className="admin-telegram-contests-section">
            <Typography variant="h5" component="h2" gutterBottom id="admin-content-title" className="sub-page-title">
                Создать Конкурс в Telegram
            </Typography>
            <Alert severity="info" sx={{ mb: 2, borderRadius: 'var(--border-radius)' }}>
                Эта форма позволяет опубликовать объявление о конкурсе в вашем Telegram-канале через бота.
                Убедитесь, что Edge Function `post-telegram-contest` и переменные окружения (включая `TELEGRAM_BOT_USERNAME_CONFIG`) настроены.
            </Alert>
            <Paper component="form" onSubmit={handleSubmitContest} elevation={3} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 'var(--border-radius-large)' }}>
                <Typography variant="h6" gutterBottom sx={{fontWeight: 500}}>Детали конкурса</Typography>
                {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                <Grid container spacing={2.5}>
                    <Grid item xs={12}>
                        <TextField fullWidth label="Заголовок конкурса" name="title" value={contestDetails.title} onChange={handleInputChange} disabled={isLoading || isAiGenerating} required variant="outlined" helperText="Будет выделен жирным в Telegram." />
                    </Grid>
                    <Grid item xs={12}>
                        <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 1}}>
                            <TextField fullWidth label="Описание и условия" name="description" value={contestDetails.description} onChange={handleInputChange} disabled={isLoading || isAiGenerating} required multiline rows={5} variant="outlined" helperText="Опишите суть конкурса, правила. Markdown поддерживается." />
                            <Tooltip title="Сгенерировать описание с помощью Viht AI">
                                <span>
                                <IconButton onClick={generateDescriptionWithAI} disabled={isLoading || isAiGenerating || !contestDetails.title.trim()} color="primary" sx={{border: '1px solid', borderColor: 'primary.main', borderRadius: 1, mt:0.5}}>
                                    {isAiGenerating ? <CircularProgress size={22} /> : <AutoAwesomeIcon />}
                                </IconButton>
                                </span>
                            </Tooltip>
                        </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}><TextField fullWidth label="Приз" name="prize" value={contestDetails.prize} onChange={handleInputChange} disabled={isLoading} required variant="outlined" helperText="Что получит победитель?" /></Grid>
                    <Grid item xs={12} sm={6}><TextField fullWidth label="URL изображения (необязательно)" name="imageUrl" type="url" value={contestDetails.imageUrl || ''} onChange={handleInputChange} disabled={isLoading} variant="outlined" placeholder="https://example.com/image.png" /></Grid>
                    <Grid item xs={12} sm={6}><TextField fullWidth label="Количество победителей (1-100)" name="numberOfWinners" type="number" value={contestDetails.numberOfWinners || ''} onChange={handleInputChange} disabled={isLoading} required variant="outlined" inputProps={{ min: 1, max: 100 }} helperText="Число от 1 до 100" /></Grid>
                    <Grid item xs={12} sm={6}><TextField fullWidth label="Дата и время окончания" name="endDate" type="datetime-local" value={contestDetails.endDate || ''} onChange={handleInputChange} disabled={isLoading} required InputLabelProps={{ shrink: true }} variant="outlined" helperText="Конкурс завершится в это время" /></Grid>

                    <Grid item xs={12}><Typography variant="subtitle1" sx={{mt:1, mb:0.5, fontWeight: 500}}>Условия участия (необязательно):</Typography></Grid>
                    <Grid item xs={12}>
                        <FormControlLabel control={<Checkbox checked={contestDetails.conditions?.reactToPost || false} onChange={handleConditionChange} name="reactToPost" disabled={isLoading} />} label="Поставить реакцию на конкурсный пост" />
                    </Grid>
                    <Grid item xs={12} container spacing={1} alignItems="center">
                        <Grid item>
                            <FormControlLabel control={<Checkbox checked={!!contestDetails.conditions?.subscribeChannelLink} onChange={(e) => handleConditionChange({target: {name: "subscribeChannelCheckbox", checked: e.target.checked}} as any)} name="subscribeChannelCheckbox" disabled={isLoading} />} label="Подписка на канал:" sx={{mr:0, flexShrink:0}} />
                        </Grid>
                        <Grid item xs>
                            <TextField fullWidth variant="outlined" size="small" placeholder="@имя_канала или https://t.me/канал" name="subscribeChannelLink" value={contestDetails.conditions?.subscribeChannelLink || ''} onChange={handleConditionChange} disabled={isLoading || !contestDetails.conditions?.subscribeChannelLink} required={!!contestDetails.conditions?.subscribeChannelLink && !contestDetails.conditions?.subscribeChannelLink.trim()} />
                        </Grid>
                    </Grid>
                     <Grid item xs={12} container spacing={1} alignItems="center">
                        <Grid item>
                            <FormControlLabel control={<Checkbox checked={!!contestDetails.conditions?.joinGroupLink} onChange={(e) => handleConditionChange({target: {name: "joinGroupCheckbox", checked: e.target.checked}} as any)} name="joinGroupCheckbox" disabled={isLoading} />} label="Вступить в группу/чат:" sx={{mr:0, flexShrink:0}} />
                        </Grid>
                        <Grid item xs>
                            <TextField fullWidth variant="outlined" size="small" placeholder="Ссылка на группу/чат" name="joinGroupLink" value={contestDetails.conditions?.joinGroupLink || ''} onChange={handleConditionChange} disabled={isLoading || !contestDetails.conditions?.joinGroupLink} required={!!contestDetails.conditions?.joinGroupLink && !contestDetails.conditions?.joinGroupLink.trim()} />
                        </Grid>
                    </Grid>

                    <Grid item xs={12}><Typography variant="subtitle2" sx={{mt:1, mb:0.5, color: 'text.secondary'}}>Кнопка "Участвовать" (текст можно изменить):</Typography></Grid>
                    <Grid item xs={12}>
                        <TextField fullWidth label="Текст кнопки (по умолч. 'Участвовать')" name="buttonText" value={contestDetails.buttonText || ''} onChange={handleInputChange} disabled={isLoading} variant="outlined" helperText="Этот текст будет на кнопке для участия." />
                    </Grid>

                    <Grid item xs={12} sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                        <Button type="submit" variant="contained" color="primary" disabled={isLoading || isAiGenerating} startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}>
                            {isLoading ? 'Публикация...' : 'Опубликовать'}
                        </Button>
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    );
};
