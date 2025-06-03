import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import { supabase } from '../../api/clients';
import { Box, TextField, Button, Typography, Paper, Alert, CircularProgress } from '@mui/material';

interface AppSettingsSectionProps {
  user: UserProfile;
}

export const AppSettingsSection: React.FC<AppSettingsSectionProps> = ({ user }) => {
  const [newDisplayName, setNewDisplayName] = useState(user.user_metadata?.display_name || '');
  const [newEmail, setNewEmail] = useState(user.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadingName, setLoadingName] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  useEffect(() => {
    setNewEmail(user.email || '');
    setNewDisplayName(user.user_metadata?.display_name || '');
  }, [user]);

  const clearMessages = () => {
    setMessage('');
    setError('');
  };

  const handleChangeDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoadingName(true);
    if (!supabase) {
      setError("Клиент Supabase не инициализирован.");
      setLoadingName(false);
      return;
    }
    if (!newDisplayName.trim()) {
      setError("Логин не может быть пустым.");
      setLoadingName(false);
      return;
    }
    if (newDisplayName.trim() === user.user_metadata?.display_name) {
      setError("Новый логин совпадает с текущим.");
      setLoadingName(false);
      return;
    }
    try {
      const { error: updateError } = await supabase.auth.updateUser({ data: { ...user.user_metadata, display_name: newDisplayName.trim() } });
      if (updateError) throw updateError;
      setMessage("Логин успешно изменен.");
      // User object in App.tsx will be updated via onAuthStateChange
    } catch (err: any) {
      setError(err.message || "Ошибка при смене логина.");
    } finally {
      setLoadingName(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoadingEmail(true);
    if (!supabase) {
      setError("Клиент Supabase не инициализирован.");
      setLoadingEmail(false);
      return;
    }
    if (!newEmail || newEmail === user.email) {
      setError(newEmail === user.email ? "Новый email совпадает с текущим." : "Введите новый email.");
      setLoadingEmail(false);
      return;
    }
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email: newEmail });
      if (updateError) throw updateError;
      setMessage(`Запрос на смену email на ${newEmail} отправлен. Проверьте старую и новую почту для подтверждения.`);
    } catch (err: any) {
      setError(err.message || "Ошибка при смене email.");
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoadingPassword(true);
    if (!supabase) {
      setError("Клиент Supabase не инициализирован.");
      setLoadingPassword(false);
      return;
    }
    if (newPassword.length < 6) {
      setError("Новый пароль должен содержать не менее 6 символов.");
      setLoadingPassword(false);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Новые пароли не совпадают.");
      setLoadingPassword(false);
      return;
    }
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setMessage("Пароль успешно изменен.");
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setError(err.message || "Ошибка при смене пароля.");
    } finally {
      setLoadingPassword(false);
    }
  };

  return (
    <Box className="app-settings-section">
      <Typography variant="h5" component="h2" id="dashboard-content-title" className="sub-page-title" gutterBottom>Настройки Аккаунта</Typography>
      {message && <Alert severity="success" sx={{ mb: 2, borderRadius: 'var(--border-radius-small)'}} role="status">{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 'var(--border-radius-small)' }} role="alert">{error}</Alert>}
      
      <Paper component="section" className="settings-block" sx={{p:2.5, mb:3}} aria-labelledby="change-displayname-heading">
        <Typography variant="h6" component="h3" id="change-displayname-heading" gutterBottom>Сменить Логин (Имя)</Typography>
        <Box component="form" onSubmit={handleChangeDisplayName} noValidate sx={{mt:1}}>
          <TextField
            margin="normal" required fullWidth
            id="new-displayname" label="Новый Логин" name="new-displayname"
            autoComplete="username" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)}
            disabled={loadingName} aria-required="true"
          />
          <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={loadingName}>
            {loadingName ? <CircularProgress size={24} color="inherit"/> : 'Сменить Логин'}
          </Button>
        </Box>
      </Paper>

      <Paper component="section" className="settings-block" sx={{p:2.5, mb:3}} aria-labelledby="change-email-heading">
        <Typography variant="h6" component="h3" id="change-email-heading" gutterBottom>Сменить Email</Typography>
        <Box component="form" onSubmit={handleChangeEmail} noValidate sx={{mt:1}}>
          <Typography variant="body1" gutterBottom>Текущий Email: <strong>{user.email || 'Не указан'}</strong></Typography>
          <TextField
            margin="normal" required fullWidth
            id="new-email" label="Новый Email" name="new-email" type="email"
            autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
            disabled={loadingEmail} aria-required="true"
          />
          <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={loadingEmail}>
            {loadingEmail ? <CircularProgress size={24} color="inherit"/> : 'Сменить Email'}
          </Button>
        </Box>
      </Paper>

      <Paper component="section" className="settings-block" sx={{p:2.5}} aria-labelledby="change-password-heading">
        <Typography variant="h6" component="h3" id="change-password-heading" gutterBottom>Сменить пароль</Typography>
        <Box component="form" onSubmit={handleChangePassword} noValidate sx={{mt:1}}>
          <TextField
            margin="normal" required fullWidth name="newPassword" label="Новый пароль (мин. 6 симв.)"
            type="password" id="new-password" autoComplete="new-password"
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            disabled={loadingPassword} inputProps={{ minLength: 6 }} aria-required="true"
          />
          <TextField
            margin="normal" required fullWidth name="confirmNewPassword" label="Подтвердите новый пароль"
            type="password" id="confirm-new-password" autoComplete="new-password"
            value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)}
            disabled={loadingPassword} inputProps={{ minLength: 6 }} aria-required="true"
          />
          <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={loadingPassword}>
            {loadingPassword ? <CircularProgress size={24} color="inherit"/> : 'Сменить пароль'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};
