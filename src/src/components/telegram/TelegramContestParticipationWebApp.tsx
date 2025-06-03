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
    status: 'active' | 'ended' | 'cancelled';
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
      // Prefer start_param if available (when app opened from inline keyboard with startapp)
      if (window.Telegram.WebApp.initDataUnsafe.start_param) {
        idFromUrl = window.Telegram.WebApp.initDataUnsafe.start_param;
      } else { // Fallback to URL query parameter if opened directly in browser for testing
        const params = new URLSearchParams(window.location.search);
        idFromUrl = params.get('contestId');
      }
      
      if (idFromUrl) {
        setContestId(idFromUrl);
      } else {
        setError("ID конкурса не найден в параметрах запуска.");
        setIsLoadingPage(false);
      }
    } else {
      setError("Пожалуйста, откройте эту страницу в приложении Telegram.");
      setIsLoadingPage(false);
    }
  }, []);

  const fetchContestDetails = useCallback(async (id: string) => {
    if (!supabase) {
      setError("Клиент Supabase не инициализирован.");
      setIsLoadingPage(false);
      return;
    }
    setIsLoadingPage(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('contests')
        .select('id, title, description, prize, conditions, status')
        .eq('id', id)
        .single();

      if (dbError) throw dbError;
      if (!data) throw new Error("Конкурс не найден или был удален.");
      
      setContestDetails(data as ContestDetailsDB);
      const initialConditions: ContestConditionClientState[] = [];
      if (data.status !== 'active') {
        setError("Этот конкурс больше не активен.");
      }

      if (data.conditions?.subscribeChannelLink) {
        initialConditions.push({ text: `Подписаться на канал: ${data.conditions.subscribeChannelLink}`, type: 'subscribe', targetLink: data.conditions.subscribeChannelLink, isMet: null, isLoading: false });
      }
      if (data.conditions?.joinGroupLink) {
        initialConditions.push({ text: `Вступить в группу: ${data.conditions.joinGroupLink}`, type: 'join', targetLink: data.conditions.joinGroupLink, isMet: null, isLoading: false });
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
      setError(`Ошибка проверки условия "${condition.text}": ${err.message}`);
      setConditionsState(prev => prev.map((c, i) => i === index ? { ...c, isLoading: false, isMet: false } : c));
    }
  };

  const handleManualConfirmChange = (index: number, checked: boolean) => {
    setConditionsState(prev => prev.map((c, i) => i === index ? { ...c, isMet: checked } : c));
  };

  const handleParticipate = useCallback(async () => {
    if (!contestId || !telegramUser || !supabase || isRegistering || successMessage || (contestDetails && contestDetails.status !== 'active')) {
        if (contestDetails && contestDetails.status !== 'active') {
            setError("Этот конкурс больше не активен.");
        }
        return;
    }
    setIsRegistering(true);
    setError(null);
    // setSuccessMessage(null); // Do not clear success message if already set
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
      // Allow "User already participated." as a soft error/info message.
      if (data.error && data.error !== "User already participated.") { 
        throw new Error(data.error);
      }
      
      const message = data.message_to_user || (data.error === "User already participated." ? "Вы уже участвуете в этом конкурсе! 😉" : "🎉 Успешно зарегистрированы!");
      setSuccessMessage(message); // Set success message here
       if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
       if (window.Telegram?.WebApp?.MainButton) {
        window.Telegram.WebApp.MainButton.setText("Готово!"); // Main button text for success
        // Keep it disabled after success, or enable a "Close" action
      }
      // Optionally close WebApp after a delay
      setTimeout(() => {
         if (window.Telegram?.WebApp) window.Telegram.WebApp.close();
      }, 3500);

    } catch (err: any) {
      setError(`Ошибка регистрации: ${err.message}`);
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
      }
    } finally {
      setIsRegistering(false); // Set to false in finally
      if (window.Telegram?.WebApp?.MainButton) {
        window.Telegram.WebApp.MainButton.hideProgress();
        // Re-enable only if there was an error and user might retry AND not already successful
        if (error && !successMessage) window.Telegram.WebApp.MainButton.enable(); 
      }
    }
  }, [contestId, telegramUser, supabase, isRegistering, successMessage, error, contestDetails]);
  
  useEffect(() => {
    const allConditionsMet = conditionsState.length > 0 && conditionsState.every(c => c.isMet === true);
    const tgWebApp = window.Telegram?.WebApp;

    if (tgWebApp && tgWebApp.MainButton) {
        if (mainButtonCallbackRef.current) {
            tgWebApp.MainButton.offClick(mainButtonCallbackRef.current);
        }
        mainButtonCallbackRef.current = handleParticipate;

        if (successMessage) {
            tgWebApp.MainButton.setText("Готово!");
            tgWebApp.MainButton.disable();
            tgWebApp.MainButton.show();
        } else if (contestDetails && contestDetails.status !== 'active') {
            tgWebApp.MainButton.setText('Конкурс завершен');
            tgWebApp.MainButton.disable();
            tgWebApp.MainButton.show();
        } else if (allConditionsMet) {
            tgWebApp.MainButton.setText('Участвовать!');
            tgWebApp.MainButton.enable();
            tgWebApp.MainButton.show();
            tgWebApp.MainButton.onClick(mainButtonCallbackRef.current);
        } else {
            tgWebApp.MainButton.setText('Выполните все условия');
            tgWebApp.MainButton.disable();
            tgWebApp.MainButton.show();
        }
    }
     return () => {
        if (tgWebApp?.MainButton && mainButtonCallbackRef.current) {
            tgWebApp.MainButton.offClick(mainButtonCallbackRef.current);
            if (tgWebApp.MainButton.isVisible) { // Hide only if it was shown by this component
                 // tgWebApp.MainButton.hide(); // Commented out: Let Telegram handle visibility or bot command to hide
            }
        }
    };
  }, [conditionsState, successMessage, error, contestDetails, handleParticipate]);


  if (isLoadingPage) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', p:2, bgcolor: window.Telegram?.WebApp?.themeParams?.bg_color || '#ffffff' }}><CircularProgress sx={{color: window.Telegram?.WebApp?.themeParams?.button_color || 'primary.main'}} /><Typography sx={{ml:2, color: window.Telegram?.WebApp?.themeParams?.text_color || 'inherit'}}>Загрузка конкурса...</Typography></Box>;
  }
  if (!telegramUser && !isLoadingPage) { // Check after loading
    return <Alert severity="warning" sx={{m:2}}>Пожалуйста, откройте эту страницу в приложении Telegram.</Alert>;
  }
   if (!contestId && !isLoadingPage) { // Check after loading
    return <Alert severity="error" sx={{m:2}}>ID конкурса не передан.</Alert>;
  }

  return (
    <Box sx={{ p: 2, fontFamily: 'sans-serif', color: window.Telegram?.WebApp?.themeParams?.text_color || '#000000', background: window.Telegram?.WebApp?.themeParams?.bg_color || '#ffffff', minHeight:'100vh' }}>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}
      
      {contestDetails && !successMessage && (
        <Paper elevation={0} sx={{ p: 2, borderRadius: 'var(--border-radius)', background: window.Telegram?.WebApp?.themeParams?.secondary_bg_color || '#f0f0f0' }}>
          <Typography variant="h5" component="h1" gutterBottom sx={{fontWeight: 'bold', color: window.Telegram?.WebApp?.themeParams?.text_color || 'inherit'}}>
            {contestDetails.title}
          </Typography>
          <Typography variant="body1" paragraph>
            <strong>Приз:</strong> {contestDetails.prize}
          </Typography>
          {contestDetails.status !== 'active' && <Alert severity="warning" sx={{mb:2}}>Этот конкурс больше не активен.</Alert>}
          
          <Typography variant="body2" paragraph sx={{whiteSpace: 'pre-wrap', color: window.Telegram?.WebApp?.themeParams?.text_color || 'inherit'}}>
            {contestDetails.description}
          </Typography>

          {conditionsState.length > 0 && contestDetails.status === 'active' && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom sx={{fontWeight: 'bold', color: window.Telegram?.WebApp?.themeParams?.text_color || 'inherit'}}>Условия для участия:</Typography>
              <List dense sx={{p:0}}>
                {conditionsState.map((condition, index) => (
                  <ListItem key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mb: 1.5, p:1.5, border: `1px solid ${window.Telegram?.WebApp?.themeParams?.hint_color || '#dddddd'}`, borderRadius: 'var(--border-radius-small)', background: window.Telegram?.WebApp?.themeParams?.bg_color || '#ffffff' }}>
                    <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                        <Typography sx={{ flexGrow: 1, mr:1, color: window.Telegram?.WebApp?.themeParams?.text_color || 'inherit' }}>{condition.text}</Typography>
                        {condition.isLoading ? (
                          <CircularProgress size={20} sx={{color: window.Telegram?.WebApp?.themeParams?.button_color || 'primary.main'}} />
                        ) : condition.isMet === true ? (
                          <CheckCircleOutlineIcon sx={{ color: window.Telegram?.WebApp?.themeParams?.button_color || 'green' }} />
                        ) : condition.isMet === false && !condition.isManuallyConfirmable ? (
                          <HighlightOffIcon sx={{ color: window.Telegram?.WebApp?.themeParams?.destructive_text_color || 'red' }} />
                        ) : condition.isMet === null && !condition.isManuallyConfirmable ? (
                          <HelpOutlineIcon sx={{ color: window.Telegram?.WebApp?.themeParams?.hint_color || 'gray' }} />
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
                        sx={{ mt: 1, fontSize: '0.8rem', py: '2px', px: '8px', color: window.Telegram?.WebApp?.themeParams?.link_color || 'primary.main', borderColor: window.Telegram?.WebApp?.themeParams?.link_color || 'primary.main', '&:hover': {borderColor: window.Telegram?.WebApp?.themeParams?.link_color || 'primary.main', background: 'action.hover'} }}
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
                                sx={{color: window.Telegram?.WebApp?.themeParams?.link_color || 'primary.main', '&.Mui-checked': {color: window.Telegram?.WebApp?.themeParams?.link_color || 'primary.main'} }}
                            />
                            }
                            label="Я выполнил(а) это условие"
                            sx={{mt:1, color: window.Telegram?.WebApp?.themeParams?.text_color || 'inherit'}}
                        />
                    )}
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Paper>
      )}
      {!contestDetails && !isLoadingPage && error && ( // Show error only if contest details failed to load
        <Alert severity="error" sx={{m:2}}>{error}</Alert>
      )}
    </Box>
  );
};

export default TelegramContestParticipationWebApp;
