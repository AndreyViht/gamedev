
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } // Ваш клиент Supabase
from '../../api/clients';
import { Box, Typography, Button, Paper, CircularProgress, List, ListItem, ListItemText, Checkbox, FormControlLabel, Alert } from '@mui/material';
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
          isActive: boolean;
          isProgressVisible: boolean;
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
        showAlert: (message: string, callback?: () => void) => void;
      };
    };
  }
}

interface ContestConditionClientState {
  text: string;
  type: 'subscribe' | 'join' | 'react';
  targetLink?: string;
  isMet: boolean | null;
  isLoading: boolean;
  isManuallyConfirmable?: boolean;
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
    end_date: string;
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
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});

  useEffect(() => {
    console.log('[TWA] WebApp component mounted.');
    const isSDKDefined = !!window.Telegram?.WebApp;
    const initDataUnsafeRaw = isSDKDefined ? window.Telegram.WebApp.initDataUnsafe || {} : {};
    const sdkStartParam = isSDKDefined ? initDataUnsafeRaw.start_param : undefined;
    const queryContestId = new URLSearchParams(window.location.search).get('contestId');

    const actualContestIdToUse = sdkStartParam || queryContestId;

    const currentDebugInfo: Record<string, any> = {
        initDataUnsafe: isSDKDefined ? JSON.stringify(initDataUnsafeRaw) : "{}",
        startParam: sdkStartParam,
        locationSearch: window.location.search,
        isTelegramWebAppDefined: isSDKDefined,
        telegramUserIdFromSDK: isSDKDefined ? (initDataUnsafeRaw.user?.id || "N/A") : "N/A",
        telegramUsernameFromSDK: isSDKDefined ? (initDataUnsafeRaw.user?.username || "N/A") : "N/A",
        idFromQuery: queryContestId,
        idFromStartParam: sdkStartParam,
        finalContestId: isSDKDefined ? (actualContestIdToUse || "N/A") : "N/A",
    };
     setDebugInfo(currentDebugInfo);

    if (isSDKDefined) {
      console.log('[TWA] Telegram WebApp SDK found. Calling ready().');
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      const userFromSDK = window.Telegram.WebApp.initDataUnsafe.user || null;
      setTelegramUser(userFromSDK);

      if (actualContestIdToUse) {
        console.log(`[TWA] Using contestId: ${actualContestIdToUse}`);
        setContestId(actualContestIdToUse);
      } else {
        console.error("[TWA] contestId not found in start_param or URL query.");
        setError("ID конкурса не найден. Убедитесь, что вы перешли по правильной ссылке от бота.");
        setIsLoadingPage(false);
      }
    } else {
      console.error("[TWA] Telegram WebApp SDK not found. This page should be opened within Telegram.");
      setError("Пожалуйста, откройте эту страницу в приложении Telegram.");
      setIsLoadingPage(false);
    }
  }, []);

  const fetchContestDetails = useCallback(async (id: string) => {
    if (!supabase) {
      setError("Клиент Supabase не инициализирован."); setIsLoadingPage(false); return;
    }
    console.log(`[TWA] Fetching contest details for ID: ${id}`);
    setIsLoadingPage(true); setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('contests')
        .select('id, title, description, prize, conditions, status, end_date')
        .eq('id', id)
        .single();

      if (dbError) {
        console.error(`[TWA] DB error fetching contest: ${dbError.message}`);
        throw dbError;
      }
      if (!data) {
        console.error(`[TWA] Contest with ID ${id} not found in DB.`);
        throw new Error("Конкурс не найден.");
      }

      console.log('[TWA] Contest details fetched:', data);
      setContestDetails(data as ContestDetailsDB);
      const initialConditions: ContestConditionClientState[] = [];
      if (new Date(data.end_date) < new Date() || data.status !== 'active') {
        setError("Этот конкурс больше не активен или завершен.");
        console.warn('[TWA] Contest is not active or has ended.');
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
      console.error(`[TWA] Error in fetchContestDetails: ${err.message}`);
      setError(`Ошибка загрузки деталей конкурса: ${err.message}`);
    } finally {
      setIsLoadingPage(false);
    }
  }, []);

  useEffect(() => { if (contestId) fetchContestDetails(contestId); }, [contestId, fetchContestDetails]);

  const handleCheckCondition = async (index: number) => {
    const condition = conditionsState[index];
    if (!condition.targetLink || !telegramUser?.id || !supabase) return;

    console.log(`[TWA] Checking condition: ${condition.text}`);
    setConditionsState(prev => prev.map((c, i) => i === index ? { ...c, isLoading: true } : c));
    try {
      const { data, error: funcError } = await supabase.functions.invoke('check-telegram-condition', {
        body: { conditionType: condition.type, targetLink: condition.targetLink, telegramUserId: telegramUser.id }
      });

      if (funcError) throw funcError;
      if (data.error) throw new Error(data.error);

      console.log(`[TWA] Condition check result for "${condition.text}": ${data.met}`);
      setConditionsState(prev => prev.map((c, i) => i === index ? { ...c, isMet: data.met, isLoading: false } : c));
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(data.met ? 'light' : 'soft');
    } catch (err: any) {
      console.error(`[TWA] Error checking condition "${condition.text}": ${err.message}`);
      setError(`Проверка "${condition.text}": ${err.message}`);
      setConditionsState(prev => prev.map((c, i) => i === index ? { ...c, isLoading: false, isMet: false } : c));
    }
  };

  const handleManualConfirmChange = (index: number, checked: boolean) => {
    setConditionsState(prev => prev.map((c, i) => i === index ? { ...c, isMet: checked } : c));
  };

  const handleParticipate = useCallback(async () => {
    if (!contestId || !telegramUser || !supabase || isRegistering || successMessage || (contestDetails && contestDetails.status !== 'active')) {
      if (contestDetails && contestDetails.status !== 'active') setError("Конкурс завершен.");
      return;
    }
    console.log('[TWA] Attempting to participate...');
    setIsRegistering(true); setError(null);
    window.Telegram?.WebApp?.MainButton?.showProgress();
    window.Telegram?.WebApp?.MainButton?.disable();

    try {
      const { data, error: funcError } = await supabase.functions.invoke('register-contest-participation', {
        body: { contest_id: contestId, telegram_user_id: telegramUser.id, telegram_username: telegramUser.username }
      });
      if (funcError) throw funcError;
      if (data.error && data.error !== "User already participated.") throw new Error(data.error);

      const message = data.message_to_user || (data.error === "User already participated." ? "Вы уже участвуете! 😉" : "🎉 Успешно зарегистрированы!");
      console.log(`[TWA] Participation result: ${message}`);
      setSuccessMessage(message);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      window.Telegram?.WebApp?.MainButton?.setText("Готово!");
      // MainButton stays disabled after success.
      setTimeout(() => { window.Telegram?.WebApp?.close(); }, 3500);

    } catch (err: any) {
      console.error(`[TWA] Error during participation: ${err.message}`);
      setError(`Регистрация: ${err.message}`);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
      if (window.Telegram?.WebApp?.MainButton) {
        window.Telegram.WebApp.MainButton.hideProgress();
        if (!successMessage) window.Telegram.WebApp.MainButton.enable();
      }
    } finally {
      setIsRegistering(false);
      if (!successMessage && window.Telegram?.WebApp?.MainButton) {
        window.Telegram.WebApp.MainButton.hideProgress();
        window.Telegram.WebApp.MainButton.enable();
      }
    }
  }, [contestId, telegramUser, supabase, isRegistering, successMessage, contestDetails]);

  useEffect(() => {
    const allConditionsMet = conditionsState.length === 0 || conditionsState.every(c => c.isMet === true);
    const tgMainButton = window.Telegram?.WebApp?.MainButton;

    if (tgMainButton) {
      if (mainButtonCallbackRef.current) tgMainButton.offClick(mainButtonCallbackRef.current);
      mainButtonCallbackRef.current = handleParticipate;

      if (successMessage) {
        tgMainButton.setText("Готово!"); tgMainButton.disable(); tgMainButton.show();
      } else if (contestDetails && (new Date(contestDetails.end_date) < new Date() || contestDetails.status !== 'active')) {
        tgMainButton.setText('Конкурс завершен'); tgMainButton.disable(); tgMainButton.show();
      } else if (allConditionsMet && contestId && telegramUser) {
        tgMainButton.setText('Участвовать!'); tgMainButton.enable(); tgMainButton.show();
        tgMainButton.onClick(mainButtonCallbackRef.current);
      } else {
        tgMainButton.setText('Выполните условия'); tgMainButton.disable(); tgMainButton.show();
      }
    }
    return () => {
      if (tgMainButton && mainButtonCallbackRef.current) {
        tgMainButton.offClick(mainButtonCallbackRef.current);
      }
    };
  }, [conditionsState, successMessage, contestDetails, handleParticipate, contestId, telegramUser]);

  const themeParams = window.Telegram?.WebApp?.themeParams || {};
  const bgColor = themeParams.bg_color || '#ffffff';
  const textColor = themeParams.text_color || '#000000';
  const secondaryBgColor = themeParams.secondary_bg_color || '#f0f0f0';
  const hintColor = themeParams.hint_color || '#999999';
  const linkColor = themeParams.link_color || '#007aff';
  const buttonColor = themeParams.button_color || '#007aff';
  const destructiveTextColor = themeParams.destructive_text_color || 'red';


  if (isLoadingPage && !error && debugInfo.isTelegramWebAppDefined) {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', p:2, bgcolor: bgColor }}>
            <CircularProgress sx={{color: buttonColor }} />
            <Typography sx={{mt:2, color: textColor}}>Загрузка деталей конкурса...</Typography>
            <Paper elevation={0} sx={{p:1, mt: 2, background: secondaryBgColor, borderRadius: 1, maxWidth: '90%', overflowX: 'auto'}}>
                <Typography variant="caption" sx={{color: hintColor, fontFamily:'monospace', whiteSpace: 'pre-wrap', fontSize: '0.7rem'}}>
                    Отладка:<br />
                    TG User ID: {debugInfo.telegramUserIdFromSDK || 'N/A'}<br />
                    TG Username: {debugInfo.telegramUsernameFromSDK || 'N/A'}<br />
                    Final Contest ID: {debugInfo.finalContestId || 'N/A'}<br />
                    TG SDK: {debugInfo.isTelegramWebAppDefined ? 'Определен' : 'НЕ ОПРЕДЕЛЕН'}<br />
                    initDataUnsafe: {debugInfo.initDataUnsafe}
                </Typography>
            </Paper>
        </Box>
    );
  }

  const renderErrorPaper = (message: string | null) => (
    <Paper elevation={1} sx={{p:2, mb:2, background: destructiveTextColor ? `color-mix(in srgb, ${destructiveTextColor} 10%, transparent)` : 'rgba(255,0,0,0.1)', border: `1px solid ${destructiveTextColor}`}}>
      <Typography sx={{color: destructiveTextColor, fontWeight:'bold'}}>Ошибка</Typography>
      <Typography sx={{color: destructiveTextColor}}>{message}</Typography>
    </Paper>
  );
  
  const renderDebugInfoPaper = () => (
    <Paper elevation={0} sx={{p:1, mb: 2, background: secondaryBgColor, borderRadius: 1, maxWidth: '100%', overflowX: 'auto'}}>
        <Typography variant="caption" sx={{color: hintColor, fontFamily:'monospace', whiteSpace: 'pre-wrap', fontSize: '0.7rem'}}>
            Отладка:<br />
            TG User ID: {debugInfo.telegramUserIdFromSDK || 'N/A'}<br />
            TG Username: {debugInfo.telegramUsernameFromSDK || 'N/A'}<br />
            Final Contest ID: {debugInfo.finalContestId || 'N/A'}<br />
            TG SDK: {debugInfo.isTelegramWebAppDefined ? 'Определен' : 'НЕ ОПРЕДЕЛЕН'}<br />
            initDataUnsafe: {debugInfo.initDataUnsafe}
        </Typography>
    </Paper>
  );


  return (
    <Box sx={{ p: 2, fontFamily: 'sans-serif', color: textColor, background: bgColor, minHeight:'100vh' }}>
      {/* Handling for SDK not defined */}
      {!debugInfo.isTelegramWebAppDefined && error && (
        <>
          {renderErrorPaper(error)}
          {renderDebugInfoPaper()}
          {renderErrorPaper(error)}
        </>
      )}

      {/* Handling for SDK defined but other errors */}
      {debugInfo.isTelegramWebAppDefined && error && !successMessage && renderErrorPaper(error)}
      
      {/* Success Message */}
      {successMessage &&
        <Paper elevation={1} sx={{p:2, mb:2, background: buttonColor ? `color-mix(in srgb, ${buttonColor} 20%, transparent)` : 'rgba(0,128,0,0.1)', border: `1px solid ${buttonColor}`}}>
           <Typography sx={{color: themeParams.button_text_color || 'green', fontWeight:'bold'}}>Успех!</Typography>
           <Typography sx={{color: themeParams.button_text_color || 'green'}}>{successMessage}</Typography>
        </Paper>
      }

      {/* Debug Info (if SDK is defined and no specific error is shown, or if explicitly desired) */}
      {debugInfo.isTelegramWebAppDefined && (!error || successMessage) && renderDebugInfoPaper()}


      {/* Contest Details (only if SDK defined, no success, and details available) */}
      {debugInfo.isTelegramWebAppDefined && contestDetails && !successMessage && (
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, background: secondaryBgColor }}>
          <Typography variant="h5" component="h1" gutterBottom sx={{fontWeight: 'bold', color: textColor}}>
            {contestDetails.title}
          </Typography>
          <Typography variant="body1" paragraph sx={{color: textColor}}>
            <strong>Приз:</strong> {contestDetails.prize}
          </Typography>
          {(new Date(contestDetails.end_date) < new Date() || contestDetails.status !== 'active') &&
            <Paper elevation={0} sx={{p:1, mb:2, background: destructiveTextColor ? `color-mix(in srgb, ${destructiveTextColor} 10%, transparent)` : 'rgba(255,165,0,0.1)', border: `1px solid ${destructiveTextColor}`}}>
                <Typography sx={{color: destructiveTextColor}}>Этот конкурс больше не активен.</Typography>
            </Paper>
          }

          <Typography variant="body2" paragraph sx={{whiteSpace: 'pre-wrap', color: textColor}}>
            {contestDetails.description}
          </Typography>

          {conditionsState.length > 0 && contestDetails.status === 'active' && new Date(contestDetails.end_date) >= new Date() && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom sx={{fontWeight: 'bold', color: textColor}}>Условия участия:</Typography>
              <List dense sx={{p:0}}>
                {conditionsState.map((condition, index) => (
                  <ListItem key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mb: 1.5, p:1.5, border: `1px solid ${hintColor}`, borderRadius: 2, background: bgColor }}>
                    <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                        <Typography sx={{ flexGrow: 1, mr:1, color: textColor }}>{condition.text}</Typography>
                        {condition.isLoading ? (
                          <CircularProgress size={20} sx={{color: buttonColor}} />
                        ) : condition.isMet === true ? (
                          <CheckCircleOutlineIcon sx={{ color: buttonColor }} />
                        ) : condition.isMet === false && !condition.isManuallyConfirmable ? (
                          <HighlightOffIcon sx={{ color: destructiveTextColor }} />
                        ) : condition.isMet === null && !condition.isManuallyConfirmable ? (
                          <HelpOutlineIcon sx={{ color: hintColor }} />
                        ): null}
                    </Box>

                    {condition.targetLink && !condition.isManuallyConfirmable && (
                      <Button
                        variant="text"
                        size="small"
                        href={condition.targetLink.startsWith('@') ? `https://t.me/${condition.targetLink.substring(1)}` : condition.targetLink}
                        target="_blank"
                        onClick={condition.isMet === null ? () => handleCheckCondition(index) : undefined}
                        disabled={condition.isLoading || condition.isMet === true}
                        sx={{ mt: 1, fontSize: '0.8rem', py: '2px', px: '8px', color: linkColor, '&:hover': {background: `color-mix(in srgb, ${linkColor} 10%, transparent)`} }}
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
                                sx={{color: linkColor, '&.Mui-checked': {color: linkColor}, '&.Mui-disabled': {color: hintColor} }}
                            />
                            }
                            label="Я выполнил(а)"
                            sx={{mt:1, color: textColor}}
                        />
                    )}
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Paper>
      )}

      {/* Fallback for "No contest details" if SDK is defined but something went wrong fetching */}
      {debugInfo.isTelegramWebAppDefined && !contestDetails && !isLoadingPage && !error && !successMessage && (
         <Paper elevation={0} sx={{p:1, mt: 2, background: secondaryBgColor, borderRadius: 1, maxWidth: '100%', overflowX: 'auto'}}>
          <Typography sx={{color: textColor, textAlign: 'center'}}>Информация о конкурсе не загружена. Возможно, неверный ID или конкурс был удален.</Typography>
         </Paper>
      )}
    </Box>
  );
};

export default TelegramContestParticipationWebApp;
