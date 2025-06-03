import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile } from '../../types';
import { USER_AI_REQUEST_LIMIT, PREMIUM_USER_AI_REQUEST_LIMIT } from '../../config/constants';
import { formatDate, calculateNextResetDate } from '../../utils/helpers';
import { aiModels as allAiModelsConfig, AIModelConfig } from '../../config/aiModels'; 
import { DashboardSection } from '../../enums/appEnums';
import { TopUsersModal } from '../common/TopUsersModal';
import { Achievement, achievementsList } from '../../config/achievements'; 
import { DailyTaskDefinition, dailyTasksList } from '../../config/dailyTasks'; 
import { genAI } from '../../api/clients'; // Import genAI client
import { GoogleGenAI, GenerateContentResponse } from '@google/genai'; // Import types

import { Box, Typography, Paper, Grid, Button, List, ListItem, ListItemText, LinearProgress, Tooltip, CircularProgress } from '@mui/material'; // MUI imports
import DiamondIcon from '@mui/icons-material/Diamond';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TaskAltIcon from '@mui/icons-material/TaskAlt'; // For task icon
import AutorenewIcon from '@mui/icons-material/Autorenew'; // For AI refresh indicator

interface AccountSectionProps {
  user: UserProfile;
  onNavigateSection: (section: DashboardSection) => void;
  onUserProfileUpdate: (updates: Partial<UserProfile['user_metadata']>) => Promise<void>;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const VIHT_IMAGE_GEN_ID = 'viht-generate-002'; 

// Helper to format time left
const formatTimeLeft = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return "00:00:00";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};


export const AccountSection: React.FC<AccountSectionProps> = ({ user, onNavigateSection, onUserProfileUpdate, showToast }) => {
  const metadata = user.user_metadata || {};
  const aiRequestsMade = metadata.ai_requests_made ?? 0;
  const aiRequestsLimit = metadata.ai_requests_limit ?? (metadata.is_premium ? PREMIUM_USER_AI_REQUEST_LIMIT : USER_AI_REQUEST_LIMIT);
  const userVihtId = metadata.user_viht_id || 'Генерируется...';
  const isPremium = metadata.is_premium === true;
  const activityPoints = metadata.activity_points ?? 0;
  
  const [isTopUsersModalOpen, setIsTopUsersModalOpen] = useState(false);
  const [isClaimingTask, setIsClaimingTask] = useState<string | null>(null);
  const [taskTimers, setTaskTimers] = useState<Record<string, number>>({}); // Store timeLeft in seconds
  const timerIntervalsRef = useRef<Record<string, number>>({});
  const [isRefreshingTask, setIsRefreshingTask] = useState<string | null>(null);


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

  const generateNewTaskContentByAI = useCallback(async (taskDef: DailyTaskDefinition, currentTaskProgress?: UserProfile['user_metadata']['daily_task_progress'] extends (infer U)[] ? U : never) => {
    if (!genAI) {
        showToast("Клиент AI не инициализирован для обновления задачи.", "error");
        return null;
    }
    setIsRefreshingTask(taskDef.id);
    try {
        const previousTaskName = currentTaskProgress?.ai_generated_name || taskDef.name;
        const previousTaskDesc = currentTaskProgress?.ai_generated_description || taskDef.description;
        const previousPoints = currentTaskProgress?.ai_generated_points || taskDef.points;

        const prompt = `Ты — гейм-мастер, придумывающий ежедневные задания для веб-приложения.
Предыдущее задание называлось "${previousTaskName}", описывалось как "${previousTaskDesc}" и давало ${previousPoints} очков.
Сгенерируй совершенно НОВОЕ, увлекательное ежедневное задание. Оно должно быть выполнимо в течение дня.
Придумай:
1. Новое название (не более 4-5 слов).
2. Новое короткое описание (1-2 предложения, до 100 символов).
3. Новое количество очков награды (целое число от 5 до 25).
Задание должно быть связано с активностью в приложении (например, использование чата, достижение целей, взаимодействие с функциями).
Не повторяй предыдущее задание. Будь креативным.
Верни ответ СТРОГО в формате JSON объекта со следующими ключами: "newName" (string), "newDescription" (string), "newPoints" (number).
Пример: {"newName": "Исследователь Чата", "newDescription": "Задайте 3 вопроса разным AI моделям.", "newPoints": 12}`;

        const response: GenerateContentResponse = await genAI.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17", // Use a capable model for JSON
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        let jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
          jsonStr = match[2].trim();
        }
        const parsedData = JSON.parse(jsonStr) as { newName: string; newDescription: string; newPoints: number };

        if (parsedData.newName && parsedData.newDescription && typeof parsedData.newPoints === 'number') {
            return parsedData;
        } else {
            throw new Error("AI вернул некорректный формат данных для задания.");
        }
    } catch (error: any) {
        console.error(`AI Error generating task for ${taskDef.id}:`, error);
        showToast(`Ошибка AI при обновлении задания "${taskDef.name}". Будет использовано стандартное.`, "error");
        return null; // Fallback to default or keep old if AI fails
    } finally {
        setIsRefreshingTask(null);
    }
  }, [showToast]);


  const refreshTaskAfterTimer = useCallback(async (taskId: string) => {
    const taskDef = dailyTasksList.find(t => t.id === taskId);
    if (!taskDef || !user.user_metadata.daily_task_progress) return;

    const currentTaskProgress = user.user_metadata.daily_task_progress.find(tp => tp.task_id === taskId);
    const aiContent = await generateNewTaskContentByAI(taskDef, currentTaskProgress);

    const updatedDailyTaskProgress = user.user_metadata.daily_task_progress.map(tp => {
        if (tp.task_id === taskId) {
            return {
                ...tp,
                current_value: 0,
                completed_today: false,
                claimed_today: false,
                last_progress_date: new Date().toISOString().split('T')[0],
                claimed_at_timestamp: undefined, // Clear timestamp
                ai_generated_name: aiContent ? aiContent.newName : taskDef.name,
                ai_generated_description: aiContent ? aiContent.newDescription : taskDef.description,
                ai_generated_points: aiContent ? aiContent.newPoints : taskDef.points,
                is_ai_refreshed: !!aiContent,
            };
        }
        return tp;
    });
    await onUserProfileUpdate({ daily_task_progress: updatedDailyTaskProgress });
    setTaskTimers(prev => ({ ...prev, [taskId]: 0 })); // Reset timer display
  }, [user.user_metadata.daily_task_progress, generateNewTaskContentByAI, onUserProfileUpdate]);


  useEffect(() => {
    const newTimers: Record<string, number> = {};
    metadata.daily_task_progress?.forEach(tp => {
        if (tp.claimed_today && tp.claimed_at_timestamp) {
            const elapsed = (Date.now() - tp.claimed_at_timestamp) / 1000; // seconds
            const timeLeft = Math.max(0, (24 * 60 * 60) - elapsed); // 24 hours in seconds
            newTimers[tp.task_id] = Math.round(timeLeft);

            if (timeLeft <= 0 && !timerIntervalsRef.current[tp.task_id]) { // Timer expired and not already handled
                refreshTaskAfterTimer(tp.task_id);
            } else if (timeLeft > 0 && !timerIntervalsRef.current[tp.task_id]) {
                timerIntervalsRef.current[tp.task_id] = window.setInterval(() => {
                    setTaskTimers(prev => {
                        const currentTaskTime = prev[tp.task_id] ?? 0;
                        if (currentTaskTime <= 1) { // Check for 1 or less to handle final tick
                            clearInterval(timerIntervalsRef.current[tp.task_id]);
                            delete timerIntervalsRef.current[tp.task_id];
                            refreshTaskAfterTimer(tp.task_id);
                            return { ...prev, [tp.task_id]: 0 };
                        }
                        return { ...prev, [tp.task_id]: currentTaskTime - 1 };
                    });
                }, 1000);
            }
        }
    });
    setTaskTimers(newTimers);

    return () => { // Cleanup intervals on component unmount or user change
        Object.values(timerIntervalsRef.current).forEach(clearInterval);
        timerIntervalsRef.current = {};
    };
  }, [metadata.daily_task_progress, refreshTaskAfterTimer]);


  const handleClaimTaskReward = async (taskDef: DailyTaskDefinition) => {
    if (!user || !metadata.daily_task_progress) return;
    setIsClaimingTask(taskDef.id);

    const taskProgress = metadata.daily_task_progress.find(tp => tp.task_id === taskDef.id);
    const pointsToAward = taskProgress?.ai_generated_points ?? taskDef.points;

    if (taskProgress && taskProgress.completed_today && !taskProgress.claimed_today) {
        const updatedActivityPoints = (metadata.activity_points || 0) + pointsToAward;
        const updatedDailyTaskProgress = metadata.daily_task_progress.map(tp =>
            tp.task_id === taskDef.id ? { ...tp, claimed_today: true, claimed_at_timestamp: Date.now() } : tp
        );

        try {
            await onUserProfileUpdate({
                activity_points: updatedActivityPoints,
                daily_task_progress: updatedDailyTaskProgress,
            });
            showToast(`Награда за "${taskProgress?.ai_generated_name || taskDef.name}" получена! +${pointsToAward} ✨`, 'success');
        } catch (error) {
            showToast(`Ошибка получения награды.`, 'error');
            console.error("Error claiming task reward:", error);
        }
    }
    setIsClaimingTask(null);
  };
  
  return (
    <Box className="account-section">
      <Typography variant="h5" component="h2" id="dashboard-content-title" className="sub-page-title" gutterBottom>Информация об аккаунте</Typography>
      <Grid container spacing={2.5} className="account-info-grid">
        <Grid item={true} xs={12} md={6} lg={4}>
          <Paper className="account-info-card" sx={{p:2.5, height: '100%'}}>
            <Typography variant="h6" gutterBottom>Основная информация</Typography>
            <Typography><strong>Логин:</strong> {metadata.display_name || 'Не указан'}</Typography>
            <Typography><strong>Email:</strong> {user.email || 'Не указан'}</Typography>
            <Typography><strong>ID Пользователя:</strong> <span className="client-key-display">{userVihtId}</span></Typography>
          </Paper>
        </Grid>
        <Grid item={true} xs={12} md={6} lg={4}>
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
        <Grid item={true} xs={12} md={6} lg={4}>
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

        <Grid item={true} xs={12} md={6} lg={4}>
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
              <Box className="achievements-list"> {/* Changed ul to Box for MUI components */}
                  {achievementsList.map(ach => {
                      const earned = ach.isEarned(user);
                      const pointsAwardedForThis = metadata.awarded_achievement_points_log?.[ach.id] === true;

                      if (ach.isSecret && !earned) {
                          return (
                            <Tooltip key={ach.id} title="Секретное достижение. Продолжайте исследовать!">
                              <Paper component="div" variant="outlined" className={`achievement-item secret locked`} sx={{borderColor: 'var(--subtle-text-color)', p: '12px 10px'}}>
                                  <Typography className="achievement-icon secret-icon" sx={{fontSize: '1.8em', filter: 'grayscale(1) blur(1.5px)', mb:0.5}} role="img" aria-hidden="true">❓</Typography>
                                  <Typography className="achievement-name" sx={{fontWeight: 500, fontStyle: 'italic', fontSize: '0.85em', lineHeight:1.2}}>Секретное Достижение</Typography>
                                  {/* Description removed from here */}
                                  {ach.level && <Typography variant="caption" className="achievement-level" sx={{ borderColor: getLevelColor(ach.level), mt:0.5, p:'2px 6px', borderRadius:1, border: '1px solid', fontSize: '0.7em' }}>{ach.level.charAt(0).toUpperCase() + ach.level.slice(1)}</Typography>}
                              </Paper>
                            </Tooltip>
                          );
                      }
                      return (
                        <Tooltip key={ach.id} title={ach.description}>
                          <Paper 
                            component="div" 
                            variant="outlined"
                            className={`achievement-item ${earned ? 'earned' : 'locked'} ${ach.level ? `level-${ach.level}` : ''} ${ach.isSecret ? 'secret' : ''}`}
                            sx={{ borderLeftColor: earned ? getLevelColor(ach.level) : 'var(--subtle-text-color)', borderLeftWidth: 4, p: '12px 10px' }}
                          >
                              <Typography className="achievement-icon" sx={{fontSize: '2em', mb:1}} role="img" aria-hidden="true">{ach.icon}</Typography>
                              <Typography className="achievement-name" sx={{fontWeight: 500, fontSize:'0.9em', lineHeight:1.3}}>{ach.name}</Typography>
                              {/* Description removed from here */}
                              {ach.level && <Typography variant="caption" className="achievement-level" sx={{ backgroundColor: getLevelColor(ach.level), color: (ach.level === 'platinum' || ach.level === 'silver') ? 'var(--text-color)' : 'white', mt:0.5, p:'2px 6px', borderRadius:1, fontWeight:'bold', fontSize: '0.7em' }}>{ach.level.charAt(0).toUpperCase() + ach.level.slice(1)}</Typography>}
                              {earned && pointsAwardedForThis && ach.pointsAwarded > 0 && <Typography variant="caption" className="achievement-points" sx={{color: 'success.main', fontSize: '0.75em', mt:0.5}}>+{ach.pointsAwarded} ✨</Typography>}
                          </Paper>
                        </Tooltip>
                      );
                  })}
              </Box>
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
      
      <Paper className="daily-tasks-card account-info-card" sx={{p:2.5, mt: 3}}>
          <Typography variant="h6" gutterBottom>Ежедневные Задания</Typography>
          {dailyTasksList.length > 0 && metadata.daily_task_progress ? (
            <Box className="daily-tasks-list">
                {dailyTasksList.map(taskDef => {
                    const taskProgress = metadata.daily_task_progress?.find(tp => tp.task_id === taskDef.id);
                    if (!taskProgress) return null;

                    const taskName = taskProgress.ai_generated_name || taskDef.name;
                    const taskDescription = taskProgress.ai_generated_description || taskDef.description;
                    const taskPoints = taskProgress.ai_generated_points || taskDef.points;
                    const isAiRefreshed = taskProgress.is_ai_refreshed;

                    const progressPercent = Math.min(100, (taskProgress.current_value / taskDef.target_value) * 100);
                    const isTimerActive = taskProgress.claimed_today && taskProgress.claimed_at_timestamp && (taskTimers[taskDef.id] ?? 0) > 0;
                    const canClaim = taskProgress.completed_today && !taskProgress.claimed_today && !isTimerActive;

                    return (
                        <Paper 
                            component="div" 
                            key={taskDef.id} 
                            variant="outlined" 
                            className={`daily-task-item ${taskProgress.claimed_today ? 'claimed' : ''}`} 
                            sx={{p:2, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}
                        >
                            <Box>
                                <Box className="task-header">
                                    <Typography className="task-icon" role="img" aria-hidden="true"><TaskAltIcon fontSize="inherit"/></Typography>
                                    <Box className="task-info">
                                        <Typography className="task-name">{taskName} {isAiRefreshed && <AutorenewIcon sx={{fontSize: '0.8em', verticalAlign:'middle', color:'info.main'}} titleAccess="Задание обновлено AI"/>}</Typography>
                                        <Typography className="task-description">{taskDescription}</Typography>
                                    </Box>
                                    <Typography className="task-reward">+{taskPoints} ✨</Typography>
                                </Box>
                                {!isTimerActive && (
                                    <>
                                    <LinearProgress variant="determinate" value={progressPercent} className="task-progress-bar" sx={{mb:1, height:6, borderRadius:1}}/>
                                    <Typography className="task-progress-text">{taskProgress.current_value} / {taskDef.target_value}</Typography>
                                    </>
                                )}
                            </Box>
                            <Box className="task-actions">
                                {isTimerActive ? (
                                    isRefreshingTask === taskDef.id ? 
                                    <CircularProgress size={24} titleAccess="Обновление задания..."/> :
                                    <Typography className="task-timer" title="Следующее обновление задания">{formatTimeLeft(taskTimers[taskDef.id] ?? 0)}</Typography>
                                ) : canClaim ? (
                                    <Button 
                                        variant="contained" size="small" className="task-claim-button"
                                        onClick={() => handleClaimTaskReward(taskDef)}
                                        disabled={isClaimingTask === taskDef.id}
                                    >
                                        {isClaimingTask === taskDef.id ? 'Забираем...' : 'Забрать'}
                                    </Button>
                                ) : taskProgress.completed_today && taskProgress.claimed_today ? (
                                    <Typography className="task-completed-message"><CheckCircleIcon fontSize="small" sx={{mr:0.5}}/>Получено</Typography>
                                ) : (
                                    <Typography variant="caption" color="text.secondary">В процессе...</Typography>
                                )}
                            </Box>
                        </Paper>
                    );
                })}
            </Box>
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