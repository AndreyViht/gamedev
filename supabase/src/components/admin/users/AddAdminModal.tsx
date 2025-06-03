
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControlLabel, Checkbox, CircularProgress, Alert, Typography, Box } from '@mui/material';

interface AddAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAdmin: (email: string, vihtId: string) => Promise<{success: boolean, message: string}>;
}

export const AddAdminModal: React.FC<AddAdminModalProps> = ({ isOpen, onClose, onAddAdmin }) => {
  const [email, setEmail] = useState('');
  const [vihtId, setVihtId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setVihtId('');
      setConfirmed(false);
      setError('');
      setSuccessMessage('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Пожалуйста, введите корректный email.');
      return;
    }
    if (!vihtId.trim() || !vihtId.startsWith('viht-')) {
      setError('Viht ID должен начинаться с "viht-" и не быть пустым.');
      return;
    }
    if (!confirmed) {
      setError('Пожалуйста, подтвердите ваше намерение назначить администратора.');
      return;
    }

    setIsLoading(true);
    const result = await onAddAdmin(email, vihtId);
    setIsLoading(false);

    if (result.success) {
      setSuccessMessage(result.message);
      // Optionally close after a delay or keep open to show success
      // onClose(); 
    } else {
      setError(result.message);
    }
  };

  return (
    <Dialog 
        open={isOpen} 
        onClose={onClose} 
        PaperProps={{ ref: modalRef, sx: { borderRadius: 'var(--border-radius-large)', width: '100%', maxWidth: '500px' } }}
        aria-labelledby="add-admin-modal-title"
    >
      <DialogTitle id="add-admin-modal-title" sx={{textAlign: 'center', fontWeight: 600}}>Добавление нового администратора</DialogTitle>
      <DialogContent dividers>
        {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        {!successMessage && (
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              id="admin-email"
              label="Email нового администратора"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="admin-vihtid"
              label="Viht ID нового администратора"
              name="vihtid"
              value={vihtId}
              onChange={(e) => setVihtId(e.target.value)}
              placeholder="viht-xxxxxxxx"
              disabled={isLoading}
            />
            <FormControlLabel
              control={<Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} name="confirmed" color="primary" disabled={isLoading} />}
              label="Я подтверждаю, что хочу назначить этого пользователя администратором и понимаю, что для завершения процесса потребуется ручное обновление файла конфигурации и перезапуск приложения."
              sx={{ mt: 1, mb: 2 }}
            />
            <Typography variant="caption" display="block" color="textSecondary" sx={{mb:2}}>
                <strong>Важно:</strong> Указанный пользователь должен уже существовать в системе. Это действие только свяжет Viht ID с его email.
                Для предоставления полных прав администратора, после успешного выполнения этой операции, **необходимо вручную добавить email и Viht ID нового администратора в массив `ADMIN_USERS` в файле `src/config/constants.ts` и перезапустить приложение.**
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: '16px 24px' }}>
        <Button onClick={onClose} color="inherit" disabled={isLoading}>Отмена</Button>
        {!successMessage && (
          <Button 
            type="submit" 
            onClick={handleSubmit} // Ensure form submit is triggered
            variant="contained" 
            disabled={isLoading || !confirmed || !email || !vihtId.startsWith('viht-')}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Назначить Viht ID'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
