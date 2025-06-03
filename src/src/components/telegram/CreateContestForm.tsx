
import React, { useState, useCallback } from 'react';
import { Box, TextField, Button, Typography, Paper, CircularProgress, Grid, Alert, Checkbox, FormControlLabel, IconButton, Tooltip } from '@mui/material';
import { supabase } from '../../api/clients';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai'; 
import { genAI } from '../../api/clients'; 
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'; 


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
    // buttonUrl?: string; // Удалено, будет генерироваться системой
    numberOfWinners?: number;
    endDate?: string; 
    conditions?: ContestConditionDetails;
}

interface CreateContestFormProps {
    channelId: string;
    telegramUserId: number; 
    onClose: () => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const CreateContestForm: React.FC<CreateContestFormProps> = ({ channelId, telegramUserId, onClose, showToast }) => {
    const [contestDetails, setContestDetails] = useState<ContestDetails>({
        title: '',
        description: '',
        prize: '',
        imageUrl: '',
        buttonText: 'Участвовать', // Текст по умолчанию
        numberOfWinners: 1,
        endDate: '',
        conditions: {
            subscribeChannelLink: '',
            reactToPost: false,
            joinGroupLink: '',
        }
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

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
        }
        else {
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
            const prompt = `Ты — креативный копирайтер, специализирующийся на увлекательных анонсах для Telegram.
Нужно написать привлекательное описание для конкурса под названием "${contestDetails.title}".

Твоя задача — сделать описание живым, интересным и призывающим к действию, используя:
- Эмодзи (уместно и по теме).
- Хорошее форматирование с отступами и абзацами (используй Markdown переносы строк, например, два пробела в конце строки или пустая строка между абзацами).
- Энтузиазм и позитивный тон.

Важно:
- Не придумывай условия конкурса, призы, даты или количество победителей. Эти детали пользователь введет отдельно.
- Просто создай общее привлекательное описание, которое заинтересует людей в конкурсе "${contestDetails.title}".
- Описание должно быть не слишком длинным, идеально для поста в Telegram (3-5 абзацев).
- Не используй слова "конкурс" или "${contestDetails.title}" слишком часто, если это не звучит естественно.

Пример структуры (но не копируй дословно, будь оригинальным!):
"🎉 Эй, друзья! Готовы к чему-то невероятному? Мы запускаем нечто особенное, связанное с "${contestDetails.title}"! 🚀

Вас ждет море позитива, интересные моменты и, конечно же, крутые возможности! ✨

Не упустите свой шанс стать частью этого захватывающего события! Следите за анонсами! 😉"

Сгенерируй только сам текст описания.`;

            const response: GenerateContentResponse = await genAI.models.generateContent({
                model: "gemini-2.5-flash-preview-04-17", 
                contents: prompt,
            });
            
            setContestDetails(prev => ({ ...prev, description: response.text }));
            showToast("Описание сгенерировано AI!", "success");

        } catch (error: any) {
            console.error("AI Description generation error:", error);
            let displayErrorMessage = `Ошибка генерации описания AI: ${error.message || "Неизвестная ошибка"}`;
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
        const subscribeCheckboxChecked = document.querySelector<HTMLInputElement>('input[name="subscribeChannelCheckbox"]')?.checked;
        if (subscribeCheckboxChecked && !conditions.subscribeChannelLink?.trim()) {
            setFormError('Если выбрана подписка на канал, укажите ссылку на канал.');
            return;
        }
        const joinGroupCheckboxChecked = document.querySelector<HTMLInputElement>('input[name="joinGroupCheckbox"]')?.checked;
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
            if (subscribeCheckboxChecked && conditions.subscribeChannelLink?.trim()) {
                finalConditions.subscribeChannelLink = conditions.subscribeChannelLink.trim();
            }
            if (conditions.reactToPost) {
                finalConditions.reactToPost = true;
            }
            if (joinGroupCheckboxChecked && conditions.joinGroupLink?.trim()) {
                finalConditions.joinGroupLink = conditions.joinGroupLink.trim();
            }

            const payload = {
                ...contestDetails, // buttonText is included here
                conditions: Object.keys(finalConditions).length > 0 ? finalConditions : undefined,
                targetChannelId: channelId,
            };
            // buttonUrl is intentionally omitted from payload as it's generated by backend

            const { data, error: functionError } = await supabase.functions.invoke('post-telegram-contest', {
                body: payload,
            });

            if (functionError) {
                if (functionError.message.includes("Admin privileges required")) {
                     showToast('Ошибка: Требуются права администратора для выполнения этого действия.', 'error');
                     setFormError('Ошибка: Требуются права администратора.');
                } else {
                    throw functionError;
                }
            } else if (data?.error) { // Application-level error from function logic
                 showToast(`Ошибка от функции: ${data.error}`, 'error');
                 setFormError(`Ошибка от функции: ${data.error}`);
            } else if (data?.success) { // Check for explicit success flag from function
                showToast(`Конкурс для канала ${channelId} успешно опубликован!`, 'success');
                onClose();
            }
             else { // Fallback if success flag is missing but no explicit error
                console.warn("Function response did not explicitly state success or error, but no exceptions caught.", data);
                showToast("Запрос на публикацию конкурса отправлен. Проверьте канал.", "info");
                onClose();
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
                <Grid container spacing={2.5}>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Заголовок конкурса"
                            name="title"
                            value={contestDetails.title}
                            onChange={handleInputChange}
                            disabled={isLoading || isAiGenerating}
                            required
                            variant="outlined"
                            helperText="Будет выделен жирным в Telegram."
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 1}}>
                            <TextField
                                fullWidth
                                label="Описание и условия"
                                name="description"
                                value={contestDetails.description}
                                onChange={handleInputChange}
                                disabled={isLoading || isAiGenerating}
                                required
                                multiline
                                rows={5}
                                variant="outlined"
                                helperText="Опишите суть конкурса, правила. Markdown поддерживается."
                            />
                            <Tooltip title="Сгенерировать описание с помощью Viht AI">
                                <span> {/* Span for Tooltip on disabled button */}
                                <IconButton 
                                    onClick={generateDescriptionWithAI} 
                                    disabled={isLoading || isAiGenerating || !contestDetails.title.trim()}
                                    color="primary"
                                    sx={{border: '1px solid', borderColor: 'primary.main', borderRadius: 1, mt:0.5}}
                                >
                                    {isAiGenerating ? <CircularProgress size={22} /> : <AutoAwesomeIcon />}
                                </IconButton>
                                </span>
                            </Tooltip>
                        </Box>
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
                            helperText="Что получит победитель?"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="URL изображения (необязательно)"
                            name="imageUrl"
                            type="url"
                            value={contestDetails.imageUrl || ''}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            variant="outlined"
                            placeholder="https://example.com/image.png"
                        />
                    </Grid>
                     <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Количество победителей (1-100)"
                            name="numberOfWinners"
                            type="number"
                            value={contestDetails.numberOfWinners || ''}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            required
                            variant="outlined"
                            inputProps={{ min: 1, max: 100 }}
                            helperText="Число от 1 до 100"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Дата и время окончания"
                            name="endDate"
                            type="datetime-local"
                            value={contestDetails.endDate || ''}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            required
                            InputLabelProps={{ shrink: true }}
                            variant="outlined"
                            helperText="Конкурс завершится в это время"
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <Typography variant="subtitle1" sx={{mt:1, mb:0.5, fontWeight: 500}}>Условия участия (необязательно):</Typography>
                        <Box sx={{pl:1}}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={contestDetails.conditions?.reactToPost || false}
                                        onChange={handleConditionChange}
                                        name="reactToPost"
                                        disabled={isLoading}
                                    />
                                }
                                label="Поставить реакцию на конкурсный пост"
                            />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1}}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={contestDetails.conditions?.subscribeChannelLink !== undefined}
                                            onChange={(e) => {
                                                const { checked } = e.target;
                                                setContestDetails(prev => ({
                                                    ...prev,
                                                    conditions: { ...prev.conditions, subscribeChannelLink: checked ? (prev.conditions?.subscribeChannelLink || '') : undefined }
                                                }));
                                            }}
                                            name="subscribeChannelCheckbox" 
                                            disabled={isLoading}
                                        />
                                    }
                                    label="Подписка на канал:"
                                    sx={{mr:0, flexShrink:0}}
                                />
                                <TextField
                                    fullWidth
                                    variant="outlined"
                                    size="small"
                                    placeholder="@имя_канала или https://t.me/канал"
                                    name="subscribeChannelLink"
                                    value={contestDetails.conditions?.subscribeChannelLink || ''}
                                    onChange={handleConditionChange}
                                    disabled={isLoading || contestDetails.conditions?.subscribeChannelLink === undefined}
                                    required={contestDetails.conditions?.subscribeChannelLink !== undefined && !contestDetails.conditions?.subscribeChannelLink.trim()}
                                />
                            </Box>
                             <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1}}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={contestDetails.conditions?.joinGroupLink !== undefined}
                                            onChange={(e) => {
                                                const { checked } = e.target;
                                                setContestDetails(prev => ({
                                                    ...prev,
                                                    conditions: { ...prev.conditions, joinGroupLink: checked ? (prev.conditions?.joinGroupLink || '') : undefined }
                                                }));
                                            }}
                                            name="joinGroupCheckbox"
                                            disabled={isLoading}
                                        />
                                    }
                                    label="Вступить в группу/чат:"
                                    sx={{mr:0, flexShrink:0}}
                                />
                                <TextField
                                    fullWidth
                                    variant="outlined"
                                    size="small"
                                    placeholder="Ссылка на группу/чат"
                                    name="joinGroupLink"
                                    value={contestDetails.conditions?.joinGroupLink || ''}
                                    onChange={handleConditionChange}
                                    disabled={isLoading || contestDetails.conditions?.joinGroupLink === undefined}
                                     required={contestDetails.conditions?.joinGroupLink !== undefined && !contestDetails.conditions?.joinGroupLink.trim()}
                                />
                            </Box>
                        </Box>
                    </Grid>
                    
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{mt:1, mb:0.5, color: 'text.secondary'}}>Кнопка "Участвовать" (текст можно изменить):</Typography>
                    </Grid>
                    <Grid item xs={12}> {/* Button text now full width as URL is removed */}
                        <TextField
                            fullWidth
                            label="Текст кнопки (по умолч. 'Участвовать')"
                            name="buttonText"
                            value={contestDetails.buttonText || ''}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            variant="outlined"
                            helperText="Этот текст будет на кнопке для участия."
                        />
                    </Grid>
                    {/* URL для кнопки удален, так как он будет генерироваться автоматически */}

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
                            disabled={isLoading || isAiGenerating}
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
