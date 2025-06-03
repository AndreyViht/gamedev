
import React, { useState } from 'react';
import { View } from '../../enums/appEnums';
import { supabase } from '../../api/clients';
import { APP_NAME, USER_AI_REQUEST_LIMIT, REQUEST_RESET_INTERVAL_DAYS } from '../../config/constants';
import { generateVihtId, generateClientKey } from '../../utils/helpers';
import { Box, TextField, Button, Typography, Paper, Link as MuiLink, CircularProgress, Alert, Divider, IconButton } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import TelegramIcon from '@mui/icons-material/Telegram'; // Added


interface RegisterPageProps {
  onNavigate: (view: View) => void;
  // showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const REGISTRATION_COOLDOWN_MS = REQUEST_RESET_INTERVAL_DAYS * 24 * 60 * 60 * 1000; 
const DEVICE_REGISTERED_KEY = 'deviceRegisteredTimestamp_gdf_v1';


export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false); // Added

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const lastRegisteredTimestamp = localStorage.getItem(DEVICE_REGISTERED_KEY);
    if (lastRegisteredTimestamp) {
      const timeSinceLastRegistration = Date.now() - parseInt(lastRegisteredTimestamp, 10);
      if (timeSinceLastRegistration < REGISTRATION_COOLDOWN_MS) {
        setError(`С этого устройства недавно была произведена регистрация (менее ${REQUEST_RESET_INTERVAL_DAYS} дней назад). Пожалуйста, войдите в существующий аккаунт или попробуйте зарегистрироваться позже.`);
        setLoading(false);
        return;
      }
    }

    if (!supabase) {
      setError("Клиент Supabase не инициализирован.");
      setLoading(false);
      return;
    }
    if (!displayName.trim()) {
      setError("Пожалуйста, введите ваш Логин (Имя).");
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("Пароль должен содержать не менее 6 символов.");
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError("Пароли не совпадают.");
      setLoading(false);
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { 
          data: { display_name: displayName.trim() } 
        }
      });

      if (signUpError) throw signUpError;

      if (data.user && data.user.identities && data.user.identities.length === 0) {
         setMessage("Пользователь с таким email уже может существовать. Если вы регистрировались, проверьте почту для входа или подтверждения.");
      } else if (data.session === null && data.user) {
         localStorage.setItem(DEVICE_REGISTERED_KEY, Date.now().toString());
         setMessage("Регистрация почти завершена! Проверьте почту (включая \"Спам\") и перейдите по ссылке для подтверждения email. Мы запомнили это устройство.");
      } else if (data.session && data.user) {
         localStorage.setItem(DEVICE_REGISTERED_KEY, Date.now().toString());
         setMessage("Регистрация успешна! Вы вошли. Мы запомнили это устройство.");
      } else { 
         setMessage("Запрос на регистрацию отправлен. Проверьте почту.");
      }
      setEmail(''); setPassword(''); setConfirmPassword(''); setDisplayName('');
    } catch (err: any) {
      const errMsg = err.message?.toLowerCase() || "";
      if (errMsg.includes("user already registered")) setError("Пользователь с таким email уже зарегистрирован.");
      else if (errMsg.includes("rate limit exceeded")) setError("Слишком много запросов. Попробуйте позже.");
      else setError(err.message || "Ошибка регистрации.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setMessage('');
    setGoogleLoading(true);
    if (!supabase) {
      setError("Клиент Supabase не инициализирован.");
      setGoogleLoading(false);
      return;
    }
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (googleError) {
        setError(googleError.message || "Ошибка регистрации через Google.");
      }
    } catch (err: any) {
      setError(err.message || "Непредвиденная ошибка при регистрации через Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleTelegramSignUp = () => {
    // Placeholder for Telegram sign-up logic
    setError('');
    setMessage('');
    setTelegramLoading(true);
    setTimeout(() => {
      // showToast("Регистрация через Telegram скоро будет доступна!", "info");
      setError("Регистрация через Telegram скоро будет доступна!");
      setTelegramLoading(false);
    }, 1500);
  };

  return (
    <Box className="auth-page">
      <Paper component="section" className="auth-container" elevation={3} sx={{p: {xs: 2, sm: 4}}}>
        <Typography variant="h4" component="h1" className="page-title" gutterBottom sx={{textAlign: 'center', fontWeight: 700, fontSize: {xs: '1.8rem', sm: '2.2rem'}}}>
          Регистрация в {APP_NAME}
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 'var(--border-radius-small)' }} role="alert">{error}</Alert>}
          {message && <Alert severity="info" sx={{ mb: 2, borderRadius: 'var(--border-radius-small)' }} role="status">{message}</Alert>}
          <TextField
            margin="normal" required fullWidth autoFocus
            id="register-displayname" label="Логин (Имя)" name="displayname"
            autoComplete="username" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            disabled={loading || googleLoading || telegramLoading} aria-required="true"
          />
          <TextField
            margin="normal" required fullWidth
            id="register-email" label="Email адрес" name="email"
            autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            disabled={loading || googleLoading || telegramLoading} aria-required="true"
          />
          <TextField
            margin="normal" required fullWidth name="password" label="Пароль (мин. 6 симв.)"
            type="password" id="register-password" autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            disabled={loading || googleLoading || telegramLoading} inputProps={{ minLength: 6 }} aria-required="true"
          />
          <TextField
            margin="normal" required fullWidth name="confirmPassword" label="Подтвердите пароль"
            type="password" id="register-confirm-password" autoComplete="new-password"
            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading || googleLoading || telegramLoading} inputProps={{ minLength: 6 }} aria-required="true"
          />
          <Button
            type="submit" fullWidth variant="contained"
            sx={{ mt: 3, mb: 1.5, py: 1.5, borderRadius: 'var(--border-radius-large)', fontWeight: 600 }}
            disabled={loading || googleLoading || telegramLoading}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Зарегистрироваться'}
          </Button>

          <Divider sx={{ my: 2.5 }}>
            <Typography variant="caption" color="text.secondary">ИЛИ</Typography>
          </Divider>

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2 }}>
            <IconButton
              aria-label="Зарегистрироваться с Google"
              onClick={handleGoogleSignUp}
              disabled={loading || googleLoading || telegramLoading}
              sx={{ 
                border: '1px solid var(--border-color)', 
                color: 'text.primary',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                p: 1.5 
              }}
              title="Зарегистрироваться с Google"
            >
              {googleLoading ? <CircularProgress size={24} /> : <GoogleIcon />}
            </IconButton>
            <IconButton // New Telegram Register Button
              aria-label="Зарегистрироваться с Telegram"
              onClick={handleTelegramSignUp}
              disabled={loading || googleLoading || telegramLoading}
              sx={{ 
                border: '1px solid var(--border-color)', 
                color: 'text.primary',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                p: 1.5 
              }}
              title="Зарегистрироваться с Telegram"
            >
              {telegramLoading ? <CircularProgress size={24} /> : <TelegramIcon />}
            </IconButton>
          </Box>

          <Typography variant="body2" align="center" className="auth-switch">
            Уже есть аккаунт?{' '}
            <MuiLink component="button" variant="body2" onClick={() => onNavigate(View.Login)} disabled={loading || googleLoading || telegramLoading} sx={{fontWeight: 500}}>
              Войти
            </MuiLink>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};
