import React, { useState } from 'react';
import { View } from '../../enums/appEnums';
import { supabase } from '../../api/clients';
import { APP_NAME, USER_AI_REQUEST_LIMIT, REQUEST_RESET_INTERVAL_DAYS } from '../../config/constants';
import { generateVihtId, generateClientKey } from '../../utils/helpers';
import { Box, TextField, Button, Typography, Paper, Link as MuiLink, CircularProgress, Alert } from '@mui/material';


interface RegisterPageProps {
  onNavigate: (view: View) => void;
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
      const vihtId = generateVihtId();
      const clientKey = generateClientKey();
      const initialMetadata = {
        display_name: displayName.trim(),
        user_viht_id: vihtId,
        client_key: clientKey,
        ai_requests_made: 0,
        ai_requests_limit: USER_AI_REQUEST_LIMIT,
        is_premium: false,
        premium_expires_at: null,
        last_request_reset_at: new Date().toISOString(),
        activity_points: 0, 
        completed_secret_achievements: [], 
      };

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: initialMetadata }
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
         // Navigation to dashboard will be handled by onAuthStateChange in App.tsx
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
            disabled={loading} aria-required="true"
          />
          <TextField
            margin="normal" required fullWidth
            id="register-email" label="Email адрес" name="email"
            autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            disabled={loading} aria-required="true"
          />
          <TextField
            margin="normal" required fullWidth name="password" label="Пароль (мин. 6 симв.)"
            type="password" id="register-password" autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            disabled={loading} inputProps={{ minLength: 6 }} aria-required="true"
          />
          <TextField
            margin="normal" required fullWidth name="confirmPassword" label="Подтвердите пароль"
            type="password" id="register-confirm-password" autoComplete="new-password"
            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading} inputProps={{ minLength: 6 }} aria-required="true"
          />
          <Button
            type="submit" fullWidth variant="contained"
            sx={{ mt: 3, mb: 2, py: 1.5, borderRadius: 'var(--border-radius-large)', fontWeight: 600 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Зарегистрироваться'}
          </Button>
          <Typography variant="body2" align="center" className="auth-switch">
            Уже есть аккаунт?{' '}
            <MuiLink component="button" variant="body2" onClick={() => onNavigate(View.Login)} disabled={loading} sx={{fontWeight: 500}}>
              Войти
            </MuiLink>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};
