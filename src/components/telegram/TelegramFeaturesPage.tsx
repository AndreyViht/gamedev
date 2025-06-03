import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../../types';
import { View } from '../../enums/appEnums';
import { Box, Typography, Button, Paper, Link as MuiLink, Stack, CircularProgress, Alert, TextField, List, ListItem, ListItemText, IconButton } from '@mui/material';
import AddToQueueIcon from '@mui/icons-material/AddToQueue';
import BarChartIcon from '@mui/icons-material/BarChart';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

import { TelegramAuthData } from '../../types/telegram';
import { CreateContestForm } from './CreateContestForm'; // New import

declare global {
  interface Window {
    onTelegramAuthCallback?: (user: TelegramAuthData) => void;
  }
}

interface TelegramFeaturesPageProps {
  user: UserProfile | null;
  onNavigate: (view: View) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void; // Added for toasts
}

const TELEGRAM_BOT_USERNAME = "gamegev_bot";
const MANAGED_CHANNELS_LS_KEY = "telegram_managed_channels_gdf";

export const TelegramFeaturesPage: React.FC<TelegramFeaturesPageProps> = ({ user, onNavigate, showToast }) => {
  const botLink = `https://t.me/${TELEGRAM_BOT_USERNAME}`;
  const [telegramUser, setTelegramUser] = useState<TelegramAuthData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const telegramLoginContainerRef = useRef<HTMLDivElement>(null);

  const [managedChannels, setManagedChannels] = useState<string[]>([]);
  const [channelInput, setChannelInput] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [creatingContestForChannelId, setCreatingContestForChannelId] = useState<string | null>(null);

  useEffect(() => {
    const storedChannels = localStorage.getItem(MANAGED_CHANNELS_LS_KEY);
    if (storedChannels) {
      try {
        const parsedChannels = JSON.parse(storedChannels);
        if (Array.isArray(parsedChannels)) {
          setManagedChannels(parsedChannels);
        }
      } catch (e) {
        console.error("Error parsing managed channels from localStorage:", e);
        localStorage.removeItem(MANAGED_CHANNELS_LS_KEY);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(MANAGED_CHANNELS_LS_KEY, JSON.stringify(managedChannels));
  }, [managedChannels]);


  useEffect(() => {
    window.onTelegramAuthCallback = (authData: TelegramAuthData) => {
      setTelegramUser(authData);
    };

    if (!telegramUser && telegramLoginContainerRef.current) {
      const script = document.createElement('script');
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.async = true;
      script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '8');
      script.setAttribute('data-onauth', 'onTelegramAuthCallback(user)');
      script.setAttribute('data-request-access', 'write');
      
      telegramLoginContainerRef.current.innerHTML = ''; 
      telegramLoginContainerRef.current.appendChild(script);
    }

    return () => {
      delete window.onTelegramAuthCallback;
    };
  }, [telegramUser]);

  const handleAddChannel = () => {
    const newChannelId = channelInput.trim();
    if (!newChannelId) {
      showToast("ID канала не может быть пустым.", "error");
      return;
    }
    if (managedChannels.includes(newChannelId)) {
      showToast("Этот канал уже добавлен.", "info");
      return;
    }
    setManagedChannels(prev => [...prev, newChannelId]);
    setChannelInput('');
    showToast(`Канал ${newChannelId} добавлен.`, "success");
  };

  const handleRemoveChannel = (channelIdToRemove: string) => {
    setManagedChannels(prev => prev.filter(id => id !== channelIdToRemove));
    if (selectedChannelId === channelIdToRemove) {
      setSelectedChannelId(null);
      setCreatingContestForChannelId(null);
    }
    showToast(`Канал ${channelIdToRemove} удален.`, "info");
  };

  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
    setCreatingContestForChannelId(null); // Close contest form if a new channel is selected
  };

  const handleOpenContestForm = () => {
    if (selectedChannelId) {
      setCreatingContestForChannelId(selectedChannelId);
    }
  };
  
  const handleScheduledPosts = () => {
    alert(`Функция 'Создать отложенные публикации' для канала ${selectedChannelId} находится в разработке.`);
  };

  const handleChannelStats = () => {
    alert(`Функция 'Статистика канала' для канала ${selectedChannelId} находится в разработке.`);
  };
  
  const handleLogoutTelegram = () => {
    setTelegramUser(null);
    setSelectedChannelId(null);
    setCreatingContestForChannelId(null);
    // Note: managedChannels are kept in localStorage even on TG logout for UX convenience.
    // To clear them on TG logout, uncomment: setManagedChannels([]);
  };

  if (creatingContestForChannelId && telegramUser) {
    return (
      <CreateContestForm
        channelId={creatingContestForChannelId}
        telegramUserId={telegramUser.id}
        onClose={() => setCreatingContestForChannelId(null)}
        showToast={showToast}
      />
    );
  }

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
            <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}> {/* Adjusted alignment */}
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
              Авторизован как: <strong>{telegramUser.first_name}{telegramUser.last_name ? ` ${telegramUser.last_name}`: ''} {telegramUser.username ? `(@${telegramUser.username})` : ''}</strong>
            </Typography>
            {telegramUser.photo_url && (
                <Box sx={{display: 'flex', justifyContent: 'center', mb: 2}}>
                    <img src={telegramUser.photo_url} alt="User Avatar" style={{ borderRadius: '50%', width: '60px', height: '60px' }} />
                </Box>
            )}
            
            <Typography variant="body1" paragraph sx={{ textAlign: 'center', my: 2 }}>
              Добавьте Telegram-каналы, которыми вы управляете и в которые добавлен бот <MuiLink href={botLink} target="_blank" rel="noopener noreferrer">{`@${TELEGRAM_BOT_USERNAME}`}</MuiLink>.
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
              <TextField
                fullWidth
                label="ID Канала Telegram (напр. @username или -100...)"
                variant="outlined"
                size="small"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
              />
              <Button variant="contained" onClick={handleAddChannel} startIcon={<AddIcon />} sx={{flexShrink: 0}}>
                Добавить
              </Button>
            </Box>

            {managedChannels.length > 0 && (
              <Box sx={{mb: 3}}>
                <Typography variant="subtitle1" gutterBottom sx={{fontWeight: 500}}>Управляемые Каналы:</Typography>
                <List dense>
                  {managedChannels.map(id => (
                    <ListItem
                      key={id}
                      selected={selectedChannelId === id}
                      onClick={() => handleSelectChannel(id)}
                      sx={{ 
                        border: '1px solid var(--border-color)', 
                        borderRadius: 'var(--border-radius-small)', 
                        mb: 1, 
                        bgcolor: selectedChannelId === id ? 'action.selected' : 'transparent',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover'}
                      }}
                      secondaryAction={
                        <IconButton edge="end" aria-label="Удалить канал" onClick={(e) => { e.stopPropagation(); handleRemoveChannel(id); }}>
                          <DeleteIcon />
                        </IconButton>
                      }
                    >
                      <ListItemText primary={id} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {selectedChannelId && (
              <Box sx={{mt: 2, p:2, border: '1px dashed var(--primary-color)', borderRadius: 'var(--border-radius)'}}>
                <Typography variant="h6" component="h2" sx={{ textAlign: 'center', mb: 2, fontWeight: 500 }}>
                  Действия для канала: {selectedChannelId}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                  <Button
                    variant="contained"
                    startIcon={<EmojiEventsIcon />}
                    onClick={handleOpenContestForm}
                    size="medium"
                    sx={{ textTransform: 'none' }}
                  >
                    Создать конкурс
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<AddToQueueIcon />}
                    onClick={handleScheduledPosts}
                    size="medium"
                    sx={{ textTransform: 'none' }}
                  >
                    Отложенные публикации
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<BarChartIcon />}
                    onClick={handleChannelStats}
                    size="medium"
                    sx={{ textTransform: 'none' }}
                  >
                    Статистика канала
                  </Button>
                </Stack>
              </Box>
            )}
            
            <Box sx={{ textAlign: 'center', mt: 4 }}>
              <Button variant="text" color="secondary" onClick={handleLogoutTelegram}>
                Выйти из Telegram
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};
