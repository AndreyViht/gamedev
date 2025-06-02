import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile } from '../../../types';
import { DailyTaskDefinition, dailyTasksList } from '../../../config/dailyTasks';
import { genAI } from '../../../api/clients';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Paper, Box, LinearProgress, CircularProgress, Tooltip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AutorenewIcon from '@mui/icons-material/Autorenew';

interface DailyTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUserProfileUpdate: (updates: Partial<UserProfile['user_metadata']>) => Promise<void>;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

// Helper to format time left (moved here for self-containment)
const formatTimeLeft = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return "00:00:00";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const DailyTasksModal: React.FC<DailyTasksModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserProfileUpdate,
  showToast,
}) => {
  const metadata = user.user_metadata || {};
  const [isClaimingTask, setIsClaimingTask] = useState<string | null>(null);
  const [taskTimers, setTaskTimers] = useState<Record<string, number>>({});
  const timerIntervalsRef = useRef<Record<string, number>>({});
  const [isRefreshingTask, setIsRefreshingTask] = useState<string | null>(null);

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
            model: "gemini-2.5-flash-preview-04-17",
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
        return null;
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
                claimed_at_timestamp: undefined,
                ai_generated_name: aiContent ? aiContent.newName : taskDef.name,
                ai_generated_description: aiContent ? aiContent.newDescription : taskDef.description,
                ai_generated_points: aiContent ? aiContent.newPoints : taskDef.points,
                is_ai_refreshed: !!aiContent,
            };
        }
        return tp;
    });
    await onUserProfileUpdate({ daily_task_progress: updatedDailyTaskProgress });
    setTaskTimers(prev => ({ ...prev, [taskId]: 0 })); // Reset timer display in modal
  }, [user.user_metadata.daily_task_progress, generateNewTaskContentByAI, onUserProfileUpdate]);

  useEffect(() => {
    if (!isOpen) { // Cleanup timers when modal is closed
        Object.values(timerIntervalsRef.current).forEach(clearInterval);
        timerIntervalsRef.current = {};
        return;
    }

    const newTimers: Record<string, number> = {};
    metadata.daily_task_progress?.forEach(tp => {
        if (tp.claimed_today && tp.claimed_at_timestamp) {
            const elapsed = (Date.now() - tp.claimed_at_timestamp) / 1000; // seconds
            const timeLeft = Math.max(0, (24 * 60 * 60) - elapsed); // 24 hours in seconds
            newTimers[tp.task_id] = Math.round(timeLeft);

            if (timeLeft <= 0 && !timerIntervalsRef.current[tp.task_id]) {
                refreshTaskAfterTimer(tp.task_id);
            } else if (timeLeft > 0 && !timerIntervalsRef.current[tp.task_id]) {
                timerIntervalsRef.current[tp.task_id] = window.setInterval(() => {
                    setTaskTimers(prev => {
                        const currentTaskTime = prev[tp.task_id] ?? 0;
                        if (currentTaskTime <= 1) {
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

    return () => { // Cleanup intervals on component unmount or isOpen change
        Object.values(timerIntervalsRef.current).forEach(clearInterval);
        timerIntervalsRef.current = {};
    };
  }, [isOpen, metadata.daily_task_progress, refreshTaskAfterTimer]);

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
    <Dialog open={isOpen} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 'var(--border-radius-large)' } }}>
      <DialogTitle sx={{textAlign: 'center', fontWeight: 600 }}>Ежедневные Задания</DialogTitle>
      <DialogContent dividers sx={{ bgcolor: 'var(--background-color)'}}>
        {dailyTasksList.length > 0 && metadata.daily_task_progress ? (
          <Box className="daily-tasks-list" sx={{maxHeight: '70vh', overflowY: 'auto', p:0.5}}>
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
                      sx={{p:2, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', mb: 2}}
                  >
                      <Box>
                          <Box className="task-header">
                              <Typography className="task-icon" role="img" aria-hidden="true"><TaskAltIcon fontSize="inherit"/></Typography>
                              <Box className="task-info">
                                  <Typography className="task-name">
                                    {taskName} 
                                    {isAiRefreshed && 
                                        <Tooltip title="Задание обновлено AI">
                                            <AutorenewIcon sx={{fontSize: '0.8em', verticalAlign:'middle', color:'info.main', ml: 0.5}}/>
                                        </Tooltip>
                                    }
                                  </Typography>
                                  <Typography className="task-description">{taskDescription}</Typography>
                              </Box>
                              <Typography className="task-reward">+{taskPoints} ✨</Typography>
                          </Box>
                          {!isTimerActive && (
                              <>
                              <LinearProgress variant="determinate" value={progressPercent} className="task-progress-bar" sx={{my:1, height:6, borderRadius:1}}/>
                              <Typography className="task-progress-text">{taskProgress.current_value} / {taskDef.target_value}</Typography>
                              </>
                          )}
                      </Box>
                      <Box className="task-actions" sx={{mt:1}}>
                          {isTimerActive ? (
                              isRefreshingTask === taskDef.id ? 
                              <CircularProgress size={24} title="Обновление задания..."/> :
                              <Typography className="task-timer" title="Следующее обновление задания">{formatTimeLeft(taskTimers[taskDef.id] ?? 0)}</Typography>
                          ) : canClaim ? (
                              <Button 
                                  variant="contained" size="small" className="task-claim-button"
                                  onClick={() => handleClaimTaskReward(taskDef)}
                                  disabled={isClaimingTask === taskDef.id}
                              >
                                  {isClaimingTask === taskDef.id ? <CircularProgress size={20} color="inherit"/> : 'Забрать'}
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
          <Typography className="coming-soon-text" sx={{textAlign: 'center', p:2}}>Ежедневные задания скоро появятся!</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ p: '16px 24px' }}>
        <Button onClick={onClose} color="primary">Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
};
