import React from 'react';
import { UserProfile } from '../../../types';
import { achievementsList } from '../../../config/achievements';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Paper, Box, Tooltip } from '@mui/material';

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({ isOpen, onClose, user }) => {
  const metadata = user.user_metadata || {};

  const getLevelColor = (level?: 'bronze' | 'silver' | 'gold' | 'platinum'): string => {
    switch (level) {
      case 'bronze': return 'var(--achievement-bronze-color)';
      case 'silver': return 'var(--achievement-silver-color)';
      case 'gold': return 'var(--achievement-gold-color)';
      case 'platinum': return 'var(--achievement-platinum-color)';
      default: return 'var(--border-color)';
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 'var(--border-radius-large)' } }}>
      <DialogTitle sx={{textAlign: 'center', fontWeight: 600 }}>
        🏆 Ваши Достижения ({achievementsList.filter(ach => ach.isEarned(user)).length}/{achievementsList.length})
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: 'var(--background-color)'}}>
        {achievementsList.length > 0 ? (
          <Box className="achievements-list" sx={{maxHeight: '70vh', overflowY: 'auto', p: 0.5}}>
            {achievementsList.map(ach => {
              const earned = ach.isEarned(user);
              const pointsAwardedForThis = metadata.awarded_achievement_points_log?.[ach.id] === true;

              if (ach.isSecret && !earned) {
                return (
                  <Tooltip key={ach.id} title="Секретное достижение. Продолжайте исследовать!">
                    <Paper component="div" variant="outlined" className="achievement-item secret locked" sx={{borderColor: 'var(--subtle-text-color)', p: '12px 10px', mb: 1.5}}>
                        <Typography className="achievement-icon secret-icon" sx={{fontSize: '1.8em', filter: 'grayscale(1) blur(1.5px)', mb:0.5}} role="img" aria-hidden="true">❓</Typography>
                        <Typography className="achievement-name" sx={{fontWeight: 500, fontStyle: 'italic', fontSize: '0.85em', lineHeight:1.2}}>Секретное Достижение</Typography>
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
                    sx={{ borderLeftColor: earned ? getLevelColor(ach.level) : 'var(--subtle-text-color)', borderLeftWidth: 4, p: '12px 10px', mb: 1.5 }}
                  >
                      <Typography className="achievement-icon" sx={{fontSize: '2em', mb:1}} role="img" aria-hidden="true">{ach.icon}</Typography>
                      <Typography className="achievement-name" sx={{fontWeight: 500, fontSize:'0.9em', lineHeight:1.3}}>{ach.name}</Typography>
                      {ach.level && <Typography variant="caption" className="achievement-level" sx={{ backgroundColor: getLevelColor(ach.level), color: (ach.level === 'platinum' || ach.level === 'silver') ? 'var(--text-color)' : 'white', mt:0.5, p:'2px 6px', borderRadius:1, fontWeight:'bold', fontSize: '0.7em' }}>{ach.level.charAt(0).toUpperCase() + ach.level.slice(1)}</Typography>}
                      {earned && pointsAwardedForThis && ach.pointsAwarded > 0 && <Typography variant="caption" className="achievement-points" sx={{color: 'success.main', fontSize: '0.75em', mt:0.5}}>+{ach.pointsAwarded} ✨</Typography>}
                  </Paper>
                </Tooltip>
              );
            })}
          </Box>
        ) : (
          <Typography sx={{textAlign: 'center', p:2}}>Система достижений скоро будет доступна!</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ p: '16px 24px' }}>
        <Button onClick={onClose} color="primary">Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
};
