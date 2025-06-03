
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../api/clients'; // Ваш клиент Supabase
import { Box, Typography, Button, Paper, CircularProgress, List, ListItem, ListItemText, Checkbox, FormControlLabel, Alert, Link as MuiLink, Chip } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
          };
          start_param?: string; // contestId будет здесь, если передан через startapp
        };
        ready: () => void;
        close: () => void;
        expand: () => void;
        MainButton: {
          setText: (text: string) => void;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
          isVisible: boolean;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
        };
        themeParams: Record<string, string>;
        colorScheme: 'light' | 'dark';
        isClosingConfirmationEnabled: boolean;
        enableClosingConfirmation: () => void;
        disableClosingConfirmation: () => void;
      };
    };
  }
}

interface ContestConditionClientState {
  text: string; // e.g., "Подписаться на @канал"
  type: 'subscribe' | 'join' | 'react'; // 'react' is manually confirmed
  targetLink?: string; // For subscribe/join
  isMet: boolean | null; // null = not checked, true = met, false = not met
  isLoading: boolean;
  isManuallyConfirmable?: boolean; // For conditions like 'react to post'
}

interface ContestDetailsDB {
    id: string;
    title: string;
    description: string;
    prize: string;
    conditions?: {
        subscribeChannelLink?: string;
        reactToPost?: boolean;
        joinGroupLink?: string;
    };
    // Add other fields if needed for display
}

const TelegramContestParticipationWebApp: React.FC = () => {
  const [contestId, setContestId] = useState<string | null>(null);
  const [contestDetails, setContestDetails] = useState<ContestDetailsDB | null>(null);
  const [telegramUser, setTelegramUser] = useState<Window['Telegram']['WebApp']['initDataUnsafe']['user'] | null>(null);
  const [conditionsState, setConditionsState] = useState<ContestConditionClientState[]>([]);
  
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const mainButtonCallbackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      setTelegramUser(window.Telegram.WebApp.initDataUnsafe.user || null);

      let idFromUrl: string | null = null;
      if (window.Telegram.WebApp.initDataUnsafe.start_param) {
        idFromUrl = window.Telegram.WebApp.initDataUnsafe.start_param;
      } else {
        const params = new URLSearchParams(window.location.search);
        idFromUrl = params.get('contestId');
      }
      
      if (idFromUrl) {
        setContestId(idFromUrl);
      } else {
        setError("ID конкурса не найден.");
        setIsLoadingPage(false);
      }
    } else {
      setError("Telegram Web App SDK не доступен. Откройте эту страницу в Telegram.");
      setIsLoadingPage(false);
    }
  }, []);

  const fetchContestDetails = useCallback(async (id: string) => {
    if (!supabase) {
      setError("Supabase не инициализирован.");
      setIsLoadingPage(false);
      return;
    }
    setIsLoadingPage(true);
    try {
      const { data, error: dbError } = await supabase
        .from('contests')
        .select('id, title, description, prize, conditions')
        .eq('id', id)
        .single();

      if (dbError) throw dbError;
      if (!data) throw new Error("Конкурс не найден.");
      
      setContestDetails(data as ContestDetailsDB);
      const initialConditions: ContestConditionClientState[] = [];
      if (data.conditions?.subscribeChannelLink) {
        initialConditions.push({ text: `Подписаться на канал ${data.conditions.subscribeChannelLink}`, type: 'subscribe', targetLink: data.conditions.subscribeChannelLink, isMet: null, isLoading: false });
      }
      if (data.conditions?.joinGroupLink) {
        initialConditions.push({ text: `Вступить в группу ${data.conditions.joinGroupLink}`, type: 'join', targetLink: data.conditions.joinGroupLink, isMet: null, isLoading: false });
      }
      if (data.conditions?.reactToPost) {
        initialConditions.push({ text: `Поставить реакцию на пост конкурса`, type: 'react', isMet: false, isLoading: false, isManuallyConfirmable: true });
      }
      setConditionsState(initialConditions);

    } catch (err: any) {
      setError(`Ошибка загрузки деталей конкурса: ${err.message}`);
    } finally {
      setIsLoadingPage(false);
    }
  }, []);

  useEffect(() => {
    if (contestId) {
      fetchContestDetails(contestId);
    }
  }, [contestId, fetchContestDetails]);
  
  const handleCheckCondition = async (index: number) => {
    const condition = conditionsState[index];
    if (!condition.targetLink || !telegramUser?.id || !supabase) return;

    setConditionsState(prev => prev.map((c, i) => i === index ? { ...c, isLoading: true } : c));
    try {
      const { data, error: funcError } = await supabase.functions.invoke('check-telegram-condition', {
        body: {
          conditionType: condition.type,
          targetLink: condition.targetLink,
          telegramUserId: telegramUser.id,
        }
      });

      if (funcError) throw funcError;
      if (data.error) throw new Error(data.error);

      setConditionsState(prev => prev.map((c, i) => i === index ? { ...c, isMet: data.met, isLoading: false } : c));
       if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred(data.met ? 'light' : 'soft');
      }
    } catch (err: any) {
      setError(`Ошибка проверки условия: ${err.message}`);
      setConditionsState(prev => prev.map((c, i) => i === index ? { ...c, isLoading: false, isMet: false } : c));
    }
  };

  const handleManualConfirmChange = (index: number, checked: boolean) => {
    setConditionsState(prev => prev.map((c, i) => i === index ? { ...c, isMet: checked } : c));
  };

  const handleParticipate = async () => {
    if (!contestId || !telegramUser || !supabase) return;
    setIsRegistering(true);
    setError(null);
    setSuccessMessage(null);
     if (window.Telegram?.WebApp?.MainButton) {
        window.Telegram.WebApp.MainButton.showProgress();
        window.Telegram.WebApp.MainButton.disable();
    }

    try {
      const { data, error: funcError } = await supabase.functions.invoke('register-contest-participation', {
        body: {
          contest_id: contestId,
          telegram_user_id: telegramUser.id,
          telegram_username: telegramUser.username,
        }
      });
      if (funcError) throw funcError;
      if (data.error && data.error !== "User already participated.") { // Allow "already participated" as a soft error
        throw new Error(data.error);
      }
      
      const message = data.message_to_user || (data.error === "User already participated." ? "Вы уже участвуете в этом конкурсе!" : "Успешно зарегистрированы!");
      setSuccessMessage(message);
       if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
       if (window.Telegram?.WebApp?.MainButton) {
        window.Telegram.WebApp.MainButton.setText("Готово!");
      }
      // Consider closing WebApp or showing a "Close" button
      setTimeout(() => {
         if (window.Telegram?.WebApp) window.Telegram.WebApp.close();
      }, 3000);

    } catch (err: any) {
      setError(`Ошибка регистрации: ${err.message}`);
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
      }
    } finally {
      setIsRegistering(false);
      if (window.Telegram?.WebApp?.MainButton) {
        window.Telegram.WebApp.MainButton.hideProgress();
        // Re-enable only if there was an error and user might retry
        if (error) window.Telegram.WebApp.MainButton.enable(); 
      }
    }
  };
  
  useEffect(() => {
    const allConditionsMet = conditionsState.every(c => c.isMet === true);
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.MainButton) {
        if (mainButtonCallbackRef.current) {
            window.Telegram.WebApp.MainButton.offClick(mainButtonCallbackRef.current);
        }
        mainButtonCallbackRef.current = handleParticipate;

        if (allConditionsMet && !successMessage && !error && contestDetails && contestDetails.status !== 'ended') {
            window.Telegram.WebApp.MainButton.setText('Участвовать!');
            window.Telegram.WebApp.MainButton.enable();
            window.Telegram.WebApp.MainButton.show();
            window.Telegram.WebApp.MainButton.onClick(mainButtonCallbackRef.current);
        } else if (successMessage) {
            window.Telegram.WebApp.MainButton.setText('Готово!');
            window.Telegram.WebApp.MainButton.disable();
            window.Telegram.WebApp.MainButton.show();
        }
        else {
            window.Telegram.WebApp.MainButton.setText('Выполните условия');
            window.Telegram.WebApp.MainButton.disable();
            window.Telegram.WebApp.MainButton.show();
        }
    }
     return () => { // Cleanup on unmount or when callback changes
        if (window.Telegram?.WebApp?.MainButton && mainButtonCallbackRef.current) {
            window.Telegram.WebApp.MainButton.offClick(mainButtonCallbackRef.current);
            window.Telegram.WebApp.MainButton.hide();
        }
    };
  }, [conditionsState, successMessage, error, contestDetails, handleParticipate]);


  if (isLoadingPage) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', p:2 }}><CircularProgress /><Typography sx={{ml:2}}>Загрузка конкурса...</Typography></Box>;
  }
  if (!telegramUser) {
    return <Alert severity="warning" sx={{m:2}}>Пожалуйста, откройте эту страницу через Telegram.</Alert>;
  }
  if (!contestDetails && !error) { // Contest ID might be invalid but not yet fetched
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', p:2 }}><CircularProgress /><Typography sx={{ml:2}}>Поиск конкурса...</Typography></Box>;
  }

  return (
    <Box sx={{ p: 2, fontFamily: 'sans-serif', color: window.Telegram?.WebApp?.themeParams?.text_color || '#000000', background: window.Telegram?.WebApp?.themeParams?.bg_color || '#ffffff', minHeight:'100vh' }}>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}
      
      {contestDetails && !successMessage && (
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, background: window.Telegram?.WebApp?.themeParams?.secondary_bg_color || '#f0f0f0' }}>
          <Typography variant="h5" component="h1" gutterBottom sx={{fontWeight: 'bold', color: window.Telegram?.WebApp?.themeParams?.text_color || 'inherit'}}>
            {contestDetails.title}
          </Typography>
          <Typography variant="body1" paragraph>
            <strong>Приз:</strong> {contestDetails.prize}
          </Typography>
          <Typography variant="body2" paragraph sx={{whiteSpace: 'pre-wrap'}}>
            {contestDetails.description}
          </Typography>

          {conditionsState.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom sx={{fontWeight: 'bold'}}>Условия для участия:</Typography>
              <List dense>
                {conditionsState.map((condition, index) => (
                  <ListItem key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mb: 1.5, p:1.5, border: `1px solid ${window.Telegram?.WebApp?.themeParams?.hint_color || '#dddddd'}`, borderRadius: 1.5 }}>
                    <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                        <Typography sx={{ flexGrow: 1, mr:1 }}>{condition.text}</Typography>
                        {condition.isLoading ? (
                          <CircularProgress size={20} />
                        ) : condition.isMet === true ? (
                          <CheckCircleOutlineIcon sx={{ color: 'green' }} />
                        ) : condition.isMet === false && !condition.isManuallyConfirmable ? (
                          <HighlightOffIcon sx={{ color: 'red' }} />
                        ) : condition.isMet === null && !condition.isManuallyConfirmable ? (
                          <HelpOutlineIcon sx={{ color: 'gray' }} />
                        ): null}
                    </Box>
                    
                    {condition.targetLink && !condition.isManuallyConfirmable && (
                      <Button 
                        variant="outlined" 
                        size="small" 
                        href={condition.targetLink.startsWith('@') ? `https://t.me/${condition.targetLink.substring(1)}` : condition.targetLink} 
                        target="_blank"
                        onClick={condition.isMet === null ? () => handleCheckCondition(index) : undefined}
                        disabled={condition.isLoading || condition.isMet === true}
                        sx={{ mt: 1, fontSize: '0.8rem', py: '2px', px: '8px', color: window.Telegram?.WebApp?.themeParams?.link_color || 'inherit', borderColor: window.Telegram?.WebApp?.themeParams?.link_color || 'inherit' }}
                      >
                        {condition.isMet === null ? 'Перейти и Проверить' : condition.isMet === true ? 'Выполнено' : 'Перейти и Выполнить'}
                      </Button>
                    )}
                    {condition.isManuallyConfirmable && (
                        <FormControlLabel
                            control={
                            <Checkbox
                                checked={condition.isMet || false}
                                onChange={(e) => handleManualConfirmChange(index, e.target.checked)}
                                disabled={condition.isLoading}
                                sx={{color: window.Telegram?.WebApp?.themeParams?.link_color || 'inherit', '&.Mui-checked': {color: window.Telegram?.WebApp?.themeParams?.link_color || 'inherit'} }}
                            />
                            }
                            label="Я выполнил(а) это условие"
                            sx={{mt:1}}
                        />
                    )}
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Paper>
      )}
      {!contestDetails && !isLoadingPage && !error && (
        <Typography sx={{textAlign: 'center', mt: 3}}>Информация о конкурсе не найдена.</Typography>
      )}
    </Box>
  );
};

export default TelegramContestParticipationWebApp;
