
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../api/clients';
import { TopUser } from '../../types';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress, Typography, Box,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material';

interface TopUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserVihtId?: string | null;
}

const TOP_USERS_LIMIT = 10;

export const TopUsersModal: React.FC<TopUsersModalProps> = ({ isOpen, onClose, currentUserVihtId }) => {
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null); // For Material UI Dialog, direct ref might not be needed for click outside

  useEffect(() => {
    const fetchTopUsers = async () => {
      if (!isOpen || !supabase) return;

      setIsLoading(true);
      setError(null);
      setTopUsers([]);

      try {
        const { data, error: rpcError } = await supabase.rpc('get_top_users_by_activity_points', {
          p_limit: TOP_USERS_LIMIT,
        });

        if (rpcError) {
          if (rpcError.message.toLowerCase().includes("function get_top_users_by_activity_points") && rpcError.message.toLowerCase().includes("does not exist")) {
            throw new Error('Функция get_top_users_by_activity_points не найдена в базе данных. Убедитесь, что SQL-скрипт для её создания выполнен.');
          }
          throw rpcError;
        }
        
        const usersData = (Array.isArray(data) ? data : []) as TopUser[];
        setTopUsers(usersData);

      } catch (err: any) {
        setError(err.message || 'Не удалось загрузить список лучших пользователей.');
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) { 
        fetchTopUsers();
    }
  }, [isOpen]); 

  useEffect(() => {
    // Material UI Dialog handles click outside and escape key by default via onClose prop
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Dialog 
        open={isOpen} 
        onClose={onClose} 
        maxWidth="sm" 
        fullWidth 
        PaperProps={{ 
            ref: modalRef, 
            className: "top-users-modal", // For potential global CSS overrides
            sx: { borderRadius: 'var(--border-radius-large)' } 
        }}
        aria-labelledby="top-users-modal-title"
    >
      <DialogTitle id="top-users-modal-title" sx={{textAlign: 'center', fontWeight: 600}}>
        🏅 Топ {TOP_USERS_LIMIT} Пользователей по Баллам Активности
      </DialogTitle>
      <DialogContent dividers>
        {isLoading && (
            <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p:3}}>
                <CircularProgress />
                <Typography sx={{mt:1}}>Загрузка лидеров...</Typography>
            </Box>
        )}
        {error && <Typography color="error" role="alert" sx={{p:2, textAlign: 'center'}}>{error}</Typography>}
        
        {!isLoading && !error && topUsers.length === 0 && (
          <Typography sx={{textAlign: 'center', p: 3}}>
            Пока нет активных пользователей для отображения в топе. Будьте первым!
          </Typography>
        )}

        {!isLoading && !error && topUsers.length > 0 && (
          <TableContainer component={Paper} elevation={0} className="top-users-list">
            <Table stickyHeader aria-label="таблица лучших пользователей">
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{fontWeight: 'bold', width: '15%'}}>Ранг</TableCell>
                  <TableCell sx={{fontWeight: 'bold', width: '55%'}}>Имя</TableCell>
                  <TableCell align="right" sx={{fontWeight: 'bold', width: '30%'}}>Баллы Активности ✨</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topUsers.map((user) => {
                  const pointsDisplay = user.activity_points?.toLocaleString() || 0;
                  return (
                    <TableRow 
                      key={user.rank} 
                      className={currentUserVihtId && user.user_viht_id === currentUserVihtId ? 'current-user-row' : ''}
                      sx={{
                          '&.current-user-row': {
                               backgroundColor: (theme) => theme.palette.action.hover, // MUI theme aware
                          },
                          '&:last-child td, &:last-child th': { border: 0 }
                      }}
                    >
                      <TableCell align="center" className="rank-cell">{user.rank}.</TableCell>
                      <TableCell className="name-cell" sx={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px'}} title={user.display_name}>{user.display_name}</TableCell>
                      <TableCell align="right" className="points-cell">{pointsDisplay}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Typography variant="caption" sx={{fontSize: '0.8em', textAlign: 'center', mt: 2, display: 'block', color: 'text.secondary'}}>
            Рейтинг обновляется периодически. Баллы начисляются за выполнение достижений и ежедневных заданий.
        </Typography>
      </DialogContent>
      <DialogActions sx={{p: '16px 24px'}}>
        <Button onClick={onClose} color="primary">
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  );
};
