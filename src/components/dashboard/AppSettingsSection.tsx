
import React, { useState, useEffect } from 'react';
import { UserProfile, UserIdentity } from '../../types'; // UserIdentity should come from local types now
import { supabase } from '../../api/clients';
import { Box, TextField, Button, Typography, Paper, Alert, CircularProgress, Grid, Divider } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google'; // For Google Link button
import { APP_NAME } from '../../config/constants'; // Added import for APP_NAME

interface AppSettingsSectionProps {
  user: UserProfile;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void; // Added for feedback
}

export const AppSettingsSection: React.FC<AppSettingsSectionProps> = ({ user, showToast }) => {
  const [newDisplayName, setNewDisplayName] = useState(user.user_metadata?.display_name || '');
  const [newEmail, setNewEmail] = useState(user.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [loadingName, setLoadingName] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);

  useEffect(() => {
    setNewEmail(user.email || '');
    setNewDisplayName(user.user_metadata?.display_name || '');
    setMessage('');
    setError('');
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
      // No change, maybe show a subtle message or do nothing
      // setError("Новый логин совпадает с текущим."); 
      setLoadingName(false);
      return;
    }
    try {
      const { error: updateError } = await supabase.auth.updateUser({ data: { ...user.user_metadata, display_name: newDisplayName.trim() } });
      if (updateError) throw updateError;
      setMessage("Логин успешно изменен.");
      showToast("Логин успешно изменен.", "success");
    } catch (err: any) {
      setError(err.message || "Ошибка при смене логина.");
      showToast(err.message || "Ошибка при смене логина.", "error");
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
      showToast(`Запрос на смену email на ${newEmail} отправлен. Проверьте почту.`, "info");
    } catch (err: any) {
      setError(err.message || "Ошибка при смене email.");
      showToast(err.message || "Ошибка при смене email.", "error");
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
      showToast("Пароль успешно изменен.", "success");
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setError(err.message || "Ошибка при смене пароля.");
      showToast(err.message || "Ошибка при смене пароля.", "error");
    } finally {
      setLoadingPassword(false);
    }
  };

  const getGoogleIdentity = (currentUser: UserProfile): UserIdentity | undefined => {
    return currentUser.identities?.find(id => id.provider === 'google');
  };
  const googleIdentity = getGoogleIdentity(user);
  const isLinkedWithGoogle = !!googleIdentity || user.app_metadata?.provider === 'google';


  const handleLinkGoogleAccount = async () => {
    clearMessages();
    setLinkingGoogle(true);
    if (!supabase) {
        setError("Клиент Supabase не инициализирован.");
        setLinkingGoogle(false);
        return;
    }
    try {
        // Supabase handles the redirect to Google and back.
        // Errors like "Identity already linked" are usually handled by Supabase by not proceeding or by showing an error page.
        // For client-side, if the linkIdentity promise rejects *before* redirect, it's an immediate client/network error.
        const { error: linkError } = await supabase.auth.linkIdentity({ provider: 'google' });
        if (linkError) {
            // This error might occur if Supabase itself has an issue before redirecting,
            // or if the user is trying to link an identity that is already linked to *another* user.
            // "Identity already linked" can mean "This Google account is already in use by another user."
             if (linkError.message.includes('Identity already linked') || linkError.message.includes('already linked')) {
                setError("Этот аккаунт Google уже связан с другим пользователем или с вашим текущим аккаунтом.");
                showToast("Этот аккаунт Google уже связан с другим пользователем или с вашим текущим аккаунтом.", "error");
            } else if (linkError.message.includes('User already has an identity with the same provider')) {
                 setError("Ваш аккаунт уже связан с Google.");
                 showToast("Ваш аккаунт уже связан с Google.", "info");
            }
            else {
                setError(linkError.message || "Ошибка при попытке связать аккаунт Google.");
                showToast(linkError.message || "Ошибка при попытке связать аккаунт Google.", "error");
            }
        }
        // If no error, Supabase will redirect. Success is confirmed by onAuthStateChange updating the user object.
        // No explicit success message here as the UI will update upon user object change.
    } catch (err: any) {
        setError(err.message || "Непредвиденная ошибка при связывании аккаунта Google.");
        showToast(err.message || "Непредвиденная ошибка при связывании аккаунта Google.", "error");
    } finally {
        setLinkingGoogle(false);
    }
  };


  return (
    <Box className="app-settings-section">
      <Typography variant="h5" component="h2" id="dashboard-content-title" className="sub-page-title" gutterBottom>Настройки Аккаунта</Typography>
      {message && <Alert severity="success" sx={{ mb: 2, borderRadius: 'var(--border-radius-small)'}} role="status">{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 'var(--border-radius-small)' }} role="alert">{error}</Alert>}
      
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <Paper component="section" className="settings-block" sx={{p:2, height: '100%'}} aria-labelledby="change-displayname-heading">
            <Typography variant="h6" component="h3" id="change-displayname-heading" gutterBottom sx={{fontSize: '1.1rem', mb: 1.5}}>Сменить Логин (Имя)</Typography>
            <Box component="form" onSubmit={handleChangeDisplayName} noValidate>
              <TextField
                margin="dense" required fullWidth
                id="new-displayname" label="Новый Логин" name="new-displayname"
                autoComplete="username" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)}
                disabled={loadingName} aria-required="true"
              />
              <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={loadingName}>
                {loadingName ? <CircularProgress size={22} color="inherit"/> : 'Сменить Логин'}
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
            <Paper component="section" className="settings-block" sx={{p:2, height: '100%'}} aria-labelledby="change-email-heading">
                <Typography variant="h6" component="h3" id="change-email-heading" gutterBottom sx={{fontSize: '1.1rem', mb: 1.5}}>Сменить Email</Typography>
                <Box component="form" onSubmit={handleChangeEmail} noValidate>
                <Typography variant="body2" gutterBottom>Текущий Email: <strong>{user.email || 'Не указан'}</strong></Typography>
                <TextField
                    margin="dense" required fullWidth
                    id="new-email" label="Новый Email" name="new-email" type="email"
                    autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                    disabled={loadingEmail} aria-required="true"
                />
                <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={loadingEmail}>
                    {loadingEmail ? <CircularProgress size={22} color="inherit"/> : 'Сменить Email'}
                </Button>
                </Box>
            </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
            <Paper component="section" className="settings-block" sx={{p:2, height: '100%'}} aria-labelledby="change-password-heading">
                <Typography variant="h6" component="h3" id="change-password-heading" gutterBottom sx={{fontSize: '1.1rem', mb: 1.5}}>Сменить пароль</Typography>
                <Box component="form" onSubmit={handleChangePassword} noValidate>
                <TextField
                    margin="dense" required fullWidth name="newPassword" label="Новый пароль (мин. 6 симв.)"
                    type="password" id="new-password" autoComplete="new-password"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loadingPassword} inputProps={{ minLength: 6 }} aria-required="true"
                />
                <TextField
                    margin="dense" required fullWidth name="confirmNewPassword" label="Подтвердите новый пароль"
                    type="password" id="confirm-new-password" autoComplete="new-password"
                    value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)}
                    disabled={loadingPassword} inputProps={{ minLength: 6 }} aria-required="true"
                />
                <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={loadingPassword}>
                    {loadingPassword ? <CircularProgress size={22} color="inherit"/> : 'Сменить пароль'}
                </Button>
                </Box>
            </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
            <Paper component="section" className="settings-block" sx={{p:2, height: '100%'}} aria-labelledby="link-google-heading">
                <Typography variant="h6" component="h3" id="link-google-heading" gutterBottom sx={{fontSize: '1.1rem', mb: 1.5}}>Синхронизация с Google</Typography>
                {isLinkedWithGoogle ? (
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                        <GoogleIcon color="success" />
                        <Typography variant="body2">
                            Аккаунт Google связан.
                            {googleIdentity?.identity_data?.email && ` (${googleIdentity.identity_data.email})`}
                        </Typography>
                    </Box>
                ) : (
                    <>
                        <Typography variant="body2" sx={{mb: 1.5}}>
                            Свяжите ваш аккаунт {APP_NAME} с Google для удобного входа через Google.
                        </Typography>
                        <Button 
                            variant="outlined" 
                            startIcon={<GoogleIcon />} 
                            onClick={handleLinkGoogleAccount}
                            disabled={linkingGoogle}
                        >
                            {linkingGoogle ? <CircularProgress size={22} /> : 'Связать аккаунт Google'}
                        </Button>
                    </>
                )}
            </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
