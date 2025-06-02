import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile } from '../../types';
import { USER_AI_REQUEST_LIMIT, PREMIUM_USER_AI_REQUEST_LIMIT } from '../../config/constants';
import { formatDate, calculateNextResetDate } from '../../utils/helpers';
import { aiModels as allAiModelsConfig, AIModelConfig } from '../../config/aiModels'; 
import { DashboardSection } from '../../enums/appEnums';
import { TopUsersModal } from '../common/TopUsersModal';
import { AchievementsModal } from './achievements/AchievementsModal'; // New
import { DailyTasksModal } from './daily_tasks/DailyTasksModal'; // New
import { achievementsList } from '../../config/achievements';

import { Box, Typography, Paper, Grid, Button, List, ListItem, ListItemText, CircularProgress, IconButton } from '@mui/material';
import DiamondIcon from '@mui/icons-material/Diamond';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import VisibilityIcon from '@mui/icons-material/Visibility'; // For "View" buttons
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'; // For tasks button


interface AccountSectionProps {
  user: UserProfile;
  onNavigateSection: (section: DashboardSection) => void;
  onUserProfileUpdate: (updates: Partial<UserProfile['user_metadata']>) => Promise<void>;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const VIHT_IMAGE_GEN_ID = 'viht-generate-002'; 

export const AccountSection: React.FC<AccountSectionProps> = ({ user, onNavigateSection, onUserProfileUpdate, showToast }) => {
  const metadata = user.user_metadata || {};
  const aiRequestsMade = metadata.ai_requests_made ?? 0;
  const aiRequestsLimit = metadata.ai_requests_limit ?? (metadata.is_premium ? PREMIUM_USER_AI_REQUEST_LIMIT : USER_AI_REQUEST_LIMIT);
  const userVihtId = metadata.user_viht_id || 'Генерируется...';
  const isPremium = metadata.is_premium === true;
  const activityPoints = metadata.activity_points ?? 0;
  
  const [isTopUsersModalOpen, setIsTopUsersModalOpen] = useState(false);
  const [isAchievementsModalOpen, setIsAchievementsModalOpen] = useState(false); // New
  const [isDailyTasksModalOpen, setIsDailyTasksModalOpen] = useState(false); // New

  let premiumStatusText = "Неактивен";
  if (isPremium) {
    premiumStatusText = metadata.premium_expires_at 
      ? `Активен до ${formatDate(metadata.premium_expires_at)}`
      : "Активен (без срока)";
  }

  const nextReset = calculateNextResetDate(metadata.last_request_reset_at);
  const nextResetText = nextReset ? formatDate(nextReset) : 'Скоро';
  
  return (
    <Box className="account-section">
      <Typography variant="h5" component="h2" id="dashboard-content-title" className="sub-page-title" gutterBottom>Информация об аккаунте</Typography>
      <Grid container spacing={2.5} className="account-info-grid">
        <Grid xs={12} md={6} lg={4}>
          <Paper className="account-info-card" sx={{p:2.5, height: '100%'}}>
            <Typography variant="h6" gutterBottom>Основная информация</Typography>
            <Typography><strong>Логин:</strong> {metadata.display_name || 'Не указан'}</Typography>
            <Typography><strong>Email:</strong> {user.email || 'Не указан'}</Typography>
            <Typography><strong>ID Пользователя:</strong> <span className="client-key-display">{userVihtId}</span></Typography>
          </Paper>
        </Grid>
        <Grid xs={12} md={6} lg={4}>
          <Paper className="account-info-card" sx={{p:2.5, height: '100%'}}>
            <Typography variant="h6" gutterBottom>Статус Аккаунта</Typography>
            <Typography><strong>Статус Премиум:</strong> {premiumStatusText}</Typography>
             {!isPremium && (
                <Button
                    onClick={() => onNavigateSection(DashboardSection.HelpChat)} 
                    variant="contained" color="secondary" startIcon={<DiamondIcon />}
                    sx={{ mt: 2, textTransform: 'none' }}
                >
                    Улучшить до Премиум
                </Button>
            )}
          </Paper>
        </Grid>
        <Grid xs={12} md={6} lg={4}>
          <Paper className="account-info-card" sx={{p:2.5, height: '100%'}}>
            <Typography variant="h6" gutterBottom>Доступные AI Модели</Typography>
            <Typography sx={{mb: 0.5}}><strong>Запросы к Viht AI:</strong> {aiRequestsMade} / {aiRequestsLimit}</Typography>
            <Typography sx={{mb: 1.5}}><strong>Следующий сброс:</strong> {nextResetText}</Typography>
            <List dense sx={{py:0}}>
                {Object.values(allAiModelsConfig).map((model: AIModelConfig) => {
                    const available = !model.isPremium || (model.isPremium && isPremium);
                    return (
                        <ListItem key={model.id} disablePadding sx={{ color: available ? 'inherit' : 'text.disabled' }}>
                            <ListItemText 
                                primary={`${model.displayName} (v${model.version})`} 
                                secondary={
                                    <>
                                        {model.isPremium && <Typography component="span" variant="caption" sx={{ color: isPremium ? 'success.main' : 'warning.main', fontStyle: 'italic'}}>Премиум</Typography>}
                                        {model.id === VIHT_IMAGE_GEN_ID && <Typography component="span" variant="caption" sx={{ fontStyle: 'italic', ml: model.isPremium ? 0.5 : 0 }}> (генерация изображений в разработке)</Typography>}
                                        {!available && <Typography component="span" variant="caption" sx={{ fontStyle: 'italic', ml: 0.5 }}>(Недоступно)</Typography>}
                                    </>
                                }
                                primaryTypographyProps={{ fontSize: '0.9rem' }}
                                secondaryTypographyProps={{ fontSize: '0.75rem' }}
                            />
                        </ListItem>
                    );
                })}
            </List>
          </Paper>
        </Grid>

        <Grid xs={12} md={6} lg={4}>
            <Paper className="account-info-card user-points-card" sx={{p:2.5, height: '100%', textAlign: 'center'}}>
                <Typography variant="h6" gutterBottom>Баллы Активности</Typography>
                <Typography className="points-display" sx={{fontSize: '2.8rem', fontWeight: 'bold', color: 'primary.main', my:1}}>{activityPoints.toLocaleString()} ✨</Typography>
                <Typography className="coming-soon-text" variant="caption">Магазин наград и способы потратить баллы скоро появятся!</Typography>
            </Paper>
        </Grid>
      </Grid>

      <Paper className="account-info-card" sx={{p:2.5, mt: 3}}> 
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb:1.5}}>
                <Typography variant="h6" component="h3">🏆 Достижения ({achievementsList.filter(ach => ach.isEarned(user)).length}/{achievementsList.length})</Typography>
                <Box>
                    <Button 
                        onClick={() => setIsAchievementsModalOpen(true)}
                        variant="outlined" size="small" startIcon={<VisibilityIcon />}
                        sx={{ textTransform: 'none', mr: 1 }}
                        title="Просмотреть все достижения"
                    >
                        Все Достижения
                    </Button>
                    <Button 
                        onClick={() => setIsTopUsersModalOpen(true)}
                        variant="contained" size="small" startIcon={<EmojiEventsIcon />}
                        sx={{ textTransform: 'none' }}
                        title="Просмотреть рейтинг активных пользователей"
                    >
                        Топ Пользователей
                    </Button>
                </Box>
            </Box>
            <Typography variant="body2" color="text.secondary">Просматривайте свои успехи и сравнивайте результаты с другими игроками.</Typography>
      </Paper>
      
      <Paper className="account-info-card" sx={{p:2.5, mt: 3}}>
          <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb:1.5}}>
            <Typography variant="h6" component="h3">Ежедневные Задания</Typography>
            <Button 
                onClick={() => setIsDailyTasksModalOpen(true)}
                variant="contained" size="small" startIcon={<AssignmentTurnedInIcon />}
                sx={{ textTransform: 'none' }}
                title="Просмотреть ежедневные задания"
            >
                Посмотреть Задания
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary">Выполняйте ежедневные задания, чтобы зарабатывать баллы активности и получать награды!</Typography>
      </Paper>
      
      <TopUsersModal
        isOpen={isTopUsersModalOpen}
        onClose={() => setIsTopUsersModalOpen(false)}
        currentUserVihtId={userVihtId} 
      />
      <AchievementsModal
        isOpen={isAchievementsModalOpen}
        onClose={() => setIsAchievementsModalOpen(false)}
        user={user}
      />
      <DailyTasksModal
        isOpen={isDailyTasksModalOpen}
        onClose={() => setIsDailyTasksModalOpen(false)}
        user={user}
        onUserProfileUpdate={onUserProfileUpdate}
        showToast={showToast}
      />
    </Box>
  );
};