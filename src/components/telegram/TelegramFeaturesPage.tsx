import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../../types';
import { View } from '../../enums/appEnums';
import { Box, Typography, Button, Paper, Link as MuiLink, Stack, CircularProgress, Alert } from '@mui/material';
import AddToQueueIcon from '@mui/icons-material/AddToQueue';
import BarChartIcon from '@mui/icons-material/BarChart';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TelegramIcon from '@mui/icons-material/Telegram';
import { TelegramAuthData } from '../../types/telegram';

// Extend the Window interface to include our callback
declare global {
  interface Window {
    onTelegramAuthCallback?: (user: TelegramAuthData) => void;
  }
}

interface TelegramFeaturesPageProps {
  user: UserProfile | null;
  onNavigate: (view: View) => void;
}

const TELEGRAM_BOT_USERNAME = "gamegev_bot"; // Matches the bot link

export const TelegramFeaturesPage: React.FC<TelegramFeaturesPageProps> = ({ user, onNavigate }) => {
  const botLink = `https://t.me/${TELEGRAM_BOT_USERNAME}`;
  const [telegramUser, setTelegramUser] = useState<TelegramAuthData | null>(null);
  const [isLoading, setIsLoading] = useState(false); // For any async operations if needed
  const telegramLoginContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Define the callback function that Telegram widget will call
    window.onTelegramAuthCallback = (authData: TelegramAuthData) => {
      // IMPORTANT SECURITY WARNING:
      // The 'hash' parameter received from Telegram MUST be verified on your backend server
      // using your bot token to ensure the data is authentic and from Telegram.
      // Client-side validation is insecure as it would expose your bot token.
      // For this frontend-only example, we are skipping hash validation,
      // but this is NOT SUITABLE FOR PRODUCTION.
      console.log("Telegram Auth Data Received (Hash NOT validated):", authData);
      setTelegramUser(authData);
    };

    // Dynamically load the Telegram login script if not already logged in
    if (!telegramUser && telegramLoginContainerRef.current) {
      const script = document.createElement('script');
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.async = true;
      script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '8');
      script.setAttribute('data-onauth', 'onTelegramAuthCallback(user)');
      script.setAttribute('data-request-access', 'write');
      
      // Clear previous button if any and append new
      telegramLoginContainerRef.current.innerHTML = ''; 
      telegramLoginContainerRef.current.appendChild(script);
    }

    // Cleanup the global callback function when the component unmounts
    return () => {
      delete window.onTelegramAuthCallback;
    };
  }, [telegramUser]); // Rerun if telegramUser changes (e.g., logs out)

  const handleCreateContest = () => {
    alert("Функция 'Создать конкурс' находится в разработке.");
  };

  const handleScheduledPosts = () => {
    alert("Функция 'Создать отложенные публикации' находится в разработке.");
  };

  const handleChannelStats = () => {
    alert("Функция 'Статистика канала' находится в разработке.");
  };
  
  const handleLogoutTelegram = () => {
    setTelegramUser(null);
    // Optionally clear any stored Telegram session data if implemented
  };

  return (
    <Box className="landing-page" sx={{ maxWidth: '800px', mx: 'auto', py: 3 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 }, borderRadius: 'var(--border-radius-large)' }}>
        <Typography variant="h4" component="h1" className="page-title" gutterBottom sx={{ textAlign: 'center', fontWeight: 700 }}>
          Интеграция с Telegram
        </Typography>

        {isLoading && <CircularProgress sx={{ display: 'block', margin: '20px auto' }} />}

        {!telegramUser && !isLoading && (
          <>
            <Typography variant="body1" paragraph sx={{ textAlign: 'center', mb: 2 }}>
              Для использования функций управления через Telegram, пожалуйста, авторизуйтесь с помощью вашего Telegram аккаунта.
            </Typography>
            <Alert severity="info" sx={{ mb: 3, textAlign: 'center' }}>
              Нажимая кнопку ниже, вы будете перенаправлены на сайт Telegram для авторизации.
              <br />
              Убедитесь, что бот <MuiLink href={botLink} target="_blank" rel="noopener noreferrer">{`@${TELEGRAM_BOT_USERNAME}`}</MuiLink> уже добавлен в ваш канал с правами администратора.
            </Alert>
            <Box ref={telegramLoginContainerRef} sx={{ display: 'flex', justifyContent: 'center', my: 3 }} />
            <Typography variant="caption" display="block" sx={{ textAlign: 'center', mt: 1, color: 'text.secondary' }}>
              Мы не храним ваш Telegram пароль. Авторизация происходит на стороне Telegram.
            </Typography>
          </>
        )}

        {telegramUser && !isLoading && (
          <>
            <Typography variant="h6" component="p" sx={{ textAlign: 'center', mb: 1 }}>
              Вы авторизованы как: <strong>{telegramUser.first_name}{telegramUser.last_name ? ` ${telegramUser.last_name}`: ''} {telegramUser.username ? `(@${telegramUser.username})` : ''}</strong>
            </Typography>
            {telegramUser.photo_url && (
                <Box sx={{display: 'flex', justifyContent: 'center', mb: 2}}>
                    <img src={telegramUser.photo_url} alt="User Avatar" style={{ borderRadius: '50%', width: '80px', height: '80px' }} />
                </Box>
            )}
            <Alert severity="warning" sx={{ mb: 2 }}>
              <strong>Внимание:</strong> Безопасность данных, полученных от Telegram (особенно `hash`), должна проверяться на вашем сервере. Текущая реализация не включает серверную проверку `hash` и не безопасна для производственного использования без неё.
            </Alert>

            <Typography variant="body1" paragraph sx={{ textAlign: 'center', my: 3 }}>
              Теперь, когда вы авторизованы, убедитесь, что бот <MuiLink href={botLink} target="_blank" rel="noopener noreferrer">{`@${TELEGRAM_BOT_USERNAME}`}</MuiLink> добавлен в администраторы вашего Telegram-канала с необходимыми правами для публикации сообщений и других действий.
            </Typography>
            
            <Typography variant="h5" component="h2" sx={{ textAlign: 'center', mb: 3, fontWeight: 500 }}>
              Доступные действия:
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<EmojiEventsIcon />}
                onClick={handleCreateContest}
                size="large"
                sx={{ textTransform: 'none' }}
              >
                Создать конкурс
              </Button>
              <Button
                variant="outlined"
                startIcon={<AddToQueueIcon />}
                onClick={handleScheduledPosts}
                size="large"
                sx={{ textTransform: 'none' }}
              >
                Отложенные публикации
              </Button>
              <Button
                variant="outlined"
                startIcon={<BarChartIcon />}
                onClick={handleChannelStats}
                size="large"
                sx={{ textTransform: 'none' }}
              >
                Статистика канала
              </Button>
            </Stack>
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Button variant="text" color="secondary" onClick={handleLogoutTelegram}>
                Выйти из Telegram
              </Button>
            </Box>
             {/* Сюда будет добавлена логика выбора канала и т.д. на следующих этапах */}
          </>
        )}
      </Paper>
    </Box>
  );
};
