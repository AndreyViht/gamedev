import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { USER_AI_REQUEST_LIMIT, PREMIUM_USER_AI_REQUEST_LIMIT } from '../../config/constants';
import { formatDate, calculateNextResetDate } from '../../utils/helpers';
import { aiModels, AIModelConfig, DEFAULT_AI_MODEL_ID } from '../../config/aiModels'; 
import { DashboardSection } from '../../enums/appEnums';
import { TopUsersModal } from '../common/TopUsersModal';
import { Achievement, achievementsList } from '../../config/achievements'; 
import { DailyTaskDefinition, dailyTasksList } from '../../config/dailyTasks'; 
import { Box, Typography, Paper, Grid, Button, List, ListItem, ListItemText, LinearProgress, Tooltip } from '@mui/material'; // MUI imports
import DiamondIcon from '@mui/icons-material/Diamond';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

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
  const [isClaimingTask, setIsClaimingTask] = useState<string | null>(null);


  let premiumStatusText = "Неактивен";
  if (isPremium) {
    premiumStatusText = metadata.premium_expires_at 
      ? `Активен до ${formatDate(metadata.premium_expires_at)}`
      : "Активен (без срока)";
  }

  const nextReset = calculateNextResetDate(metadata.last_request_reset_at);
  const nextResetText = nextReset ? formatDate(nextReset) : 'Скоро';

  const getLevelColor = (level?: 'bronze' | 'silver' | 'gold' | 'platinum'): string => {
    switch (level) {
      case 'bronze': return 'var(--achievement-bronze-color)';
      case 'silver': return 'var(--achievement-silver-color)';
      case 'gold': return 'var(--achievement-gold-color)';
      case 'platinum': return 'var(--achievement-platinum-color)';
      default: return 'var(--border-color)';
    }
  };

  const handleClaimTaskReward = async (taskDef: DailyTaskDefinition) => {
    if (!user || !metadata.daily_task_progress) return;
    setIsClaimingTask(taskDef.id);

    const taskProgress = metadata.daily_task_progress.find(tp => tp.task_id === taskDef.id);
    if (taskProgress && taskProgress.completed_today && !taskProgress.claimed_today) {
        const updatedActivityPoints = (metadata.activity_points || 0) + taskDef.points;
        const updatedDailyTaskProgress = metadata.daily_task_progress.map(tp =>
            tp.task_id === taskDef.id ? { ...tp, claimed_today: true } : tp
        );

        try {
            await onUserProfileUpdate({
                activity_points: updatedActivityPoints,
                daily_task_progress: updatedDailyTaskProgress,
            });
            showToast(`Награда за "${taskDef.name}" получена! +${taskDef.points} ✨`, 'success');
        } catch (error) {
            showToast(`Ошибка получения награды за "${taskDef.name}".`, 'error');
            console.error("Error claiming task reward:", error);
        }
    }
    setIsClaimingTask(null);
  };
  
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
            <Typography variant="h6" gutterBottom>Статус и Лимиты</Typography>
            <Typography><strong>Статус Премиум:</strong> {premiumStatusText}</Typography>
            <Typography><strong>Запросы к Viht AI:</strong> {aiRequestsMade} / {aiRequestsLimit}</Typography>
            <Typography><strong>Следующий сброс:</strong> {nextResetText}</Typography>
          </Paper>
        </Grid>
        <Grid xs={12} md={6} lg={4}>
          <Paper className="account-info-card" sx={{p:2.5, height: '100%'}}>
            <Typography variant="h6" gutterBottom>Доступные AI Модели</Typography>
            <List dense sx={{py:0}}>
                {Object.values(aiModels).map((model: AIModelConfig) => {
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
                            />
                        </ListItem>
                    );
                })}
            </List>
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
            <Paper className="account-info-card user-points-card" sx={{p:2.5, height: '100%', textAlign: 'center'}}>
                <Typography variant="h6" gutterBottom>Баллы Активности</Typography>
                <Typography className="points-display" sx={{fontSize: '2.8rem', fontWeight: 'bold', color: 'primary.main', my:1}}>{activityPoints.toLocaleString()} ✨</Typography>
                <Typography className="coming-soon-text" variant="caption">Магазин наград и способы потратить баллы скоро появятся!</Typography>
            </Paper>
        </Grid>
      </Grid>

      <Paper className="achievements-card account-info-card" sx={{p:2.5, mt: 3}}> 
          <Typography variant="h6" gutterBottom>🏆 Достижения ({achievementsList.filter(ach => ach.isEarned(user)).length}/{achievementsList.length})</Typography>
          {achievementsList.length > 0 ? (
              <ul className="achievements-list">
                  {achievementsList.map(ach => {
                      const earned = ach.isEarned(user);
                      const pointsAwardedForThis = metadata.awarded_achievement_points_log?.[ach.id] === true;

                      if (ach.isSecret && !earned) {
                          return (
                            <Tooltip key={ach.id} title="Секретное достижение. Продолжайте исследовать!">
                              <Paper component="li" variant="outlined" className={`achievement-item secret locked`} sx={{borderColor: 'var(--subtle-text-color)', p: 2}}>
                                  <span className="achievement-icon secret-icon" role="img" aria-hidden="true" style={{fontSize: '2em', filter: 'grayscale(1) blur(1px)'}}>❓</span>
                                  <Typography className="achievement-name" sx={{fontWeight: 500, fontStyle: 'italic'}}>Секретное Достижение</Typography>
                                  <Typography variant="caption" className="achievement-description">Описание скрыто...</Typography>
                                  {ach.level && <Typography variant="caption" className="achievement-level" sx={{ borderColor: getLevelColor(ach.level), mt:1, p:'2px 6px', borderRadius:1, border: '1px solid' }}>{ach.level.charAt(0).toUpperCase() + ach.level.slice(1)}</Typography>}
                              </Paper>
                            </Tooltip>
                          );
                      }
                      return (
                        <Tooltip key={ach.id} title={ach.description}>
                          <Paper 
                            component="li" 
                            variant="outlined"
                            className={`achievement-item ${earned ? 'earned' : 'locked'} ${ach.level ? `level-${ach.level}` : ''} ${ach.isSecret ? 'secret' : ''}`}
                            sx={{ borderLeftColor: earned ? getLevelColor(ach.level) : 'var(--subtle-text-color)', borderLeftWidth: 5, p: 2 }}
                          >
                              <span className="achievement-icon" role="img" aria-hidden="true" style={{fontSize: '2em'}}>{ach.icon}</span>
                              <Typography className="achievement-name" sx={{fontWeight: 600}}>{ach.name}</Typography>
                              <Typography variant="caption" className="achievement-description">{ach.description}</Typography>
                              {ach.level && <Typography variant="caption" className="achievement-level" sx={{ backgroundColor: getLevelColor(ach.level), color: (ach.level === 'platinum' || ach.level === 'silver') ? 'var(--text-color)' : 'white', mt:1, p:'2px 6px', borderRadius:1, fontWeight:'bold' }}>{ach.level.charAt(0).toUpperCase() + ach.level.slice(1)}</Typography>}
                              {earned && pointsAwardedForThis && ach.pointsAwarded > 0 && <Typography variant="caption" className="achievement-points" sx={{color: 'success.main'}}>+{ach.pointsAwarded} ✨ (получено)</Typography>}
                          </Paper>
                        </Tooltip>
                      );
                  })}
              </ul>
          ) : (
              <Typography>Система достижений скоро будет доступна!</Typography>
          )}
          <Button 
              onClick={() => setIsTopUsersModalOpen(true)}
              variant="contained" startIcon={<EmojiEventsIcon />}
              sx={{ mt: 2, textTransform: 'none' }}
              title="Просмотреть рейтинг активных пользователей"
          >
              Топ Пользователей
          </Button>
      </Paper>
      
      <Paper className="daily-tasks-card account-info-card" sx={{p:2.5, mt: 3, borderStyle: 'solid', borderColor: 'divider'}}>
          <Typography variant="h6" gutterBottom>Ежедневные Задания</Typography>
          {dailyTasksList.length > 0 && metadata.daily_task_progress ? (
            <List className="daily-tasks-list" sx={{p:0}}>
                {dailyTasksList.map(taskDef => {
                    const taskProgress = metadata.daily_task_progress?.find(tp => tp.task_id === taskDef.id);
                    if (!taskProgress) return null;

                    const progressPercent = Math.min(100, (taskProgress.current_value / taskDef.target_value) * 100);
                    const canClaim = taskProgress.completed_today && !taskProgress.claimed_today;

                    return (
                        <Paper component="li" key={taskDef.id} variant="outlined" className={`daily-task-item ${taskProgress.completed_today ? 'earned' : 'locked'}`} sx={{p:2, mb:1.5, borderRadius: 'var(--border-radius)'}}>
                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 1 }}>
                                <Typography component="span" sx={{fontSize: '1.8em', mr: 1.5}} role="img" aria-hidden="true">🎯</Typography>
                                <Box sx={{flexGrow: 1}}>
                                    <Typography variant="subtitle1" sx={{fontWeight: 500}}>{taskDef.name}</Typography>
                                    <Typography variant="body2" color="text.secondary">{taskDef.description}</Typography>
                                </Box>
                                {canClaim && <Typography sx={{color: 'primary.main', fontWeight: 'bold'}}>+{taskDef.points} ✨</Typography>}
                            </Box>
                            <LinearProgress variant="determinate" value={progressPercent} sx={{height: 8, borderRadius: 'var(--border-radius-small)', mb:1}} />
                            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                                <Typography variant="caption">Прогресс: {taskProgress.current_value} / {taskDef.target_value}</Typography>
                                {canClaim && (
                                    <Button 
                                        variant="contained" size="small"
                                        onClick={() => handleClaimTaskReward(taskDef)}
                                        disabled={isClaimingTask === taskDef.id}
                                        sx={{textTransform: 'none'}}
                                    >
                                        {isClaimingTask === taskDef.id ? 'Забираем...' : 'Забрать награду'}
                                    </Button>
                                )}
                                {taskProgress.completed_today && taskProgress.claimed_today && <Typography variant="caption" sx={{color: 'success.main', display:'flex', alignItems:'center'}}><CheckCircleIcon fontSize="small" sx={{mr:0.5}}/>Награда получена!</Typography>}
                                {!taskProgress.completed_today && <Typography variant="caption" color="text.secondary">В процессе...</Typography>}
                            </Box>
                        </Paper>
                    );
                })}
            </List>
          ) : (
            <Typography className="coming-soon-text">Ежедневные задания скоро появятся! Следите за обновлениями.</Typography>
          )}
      </Paper>
      
      <TopUsersModal
        isOpen={isTopUsersModalOpen}
        onClose={() => setIsTopUsersModalOpen(false)}
        currentUserVihtId={userVihtId} 
      />
    </Box>
  );
};
