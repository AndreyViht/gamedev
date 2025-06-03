
import React, { useState } from 'react';
import { View } from '../../enums/appEnums';
import { supabase } from '../../api/clients';
import { APP_NAME } from '../../config/constants';
import { Box, TextField, Button, Typography, Paper, Link as MuiLink, CircularProgress, Alert, Divider } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google'; // Import Google icon

interface LoginPageProps {
  onNavigate: (view: View) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!supabase) {
      setError("Клиент Supabase не инициализирован.");
      setLoading(false);
      return;
    }
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        const msg = signInError.message.toLowerCase();
        if (msg.includes('email not confirmed') || msg.includes('unconfirmed') || msg.includes('waiting for verification')) {
          setError("Ваш email еще не подтвержден. Проверьте почту (включая \"Спам\") и перейдите по ссылке.");
        } else if (msg.includes('invalid login credentials')) {
          setError("Неверный email или пароль.");
        } else {
          setError(signInError.message || "Ошибка входа.");
        }
      }
      // Successful login is handled by onAuthStateChange in App.tsx
    } catch (err: any) {
      if (!error) setError(err.message || "Непредвиденная ошибка.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
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
        setError(googleError.message || "Ошибка входа через Google.");
      }
      // Supabase handles redirection. If successful, onAuthStateChange in App.tsx will manage session.
    } catch (err: any) {
      setError(err.message || "Непредвиденная ошибка при входе через Google.");
    } finally {
      // Google loading might not stop here if redirection happens,
      // but good to have for direct errors.
      setGoogleLoading(false);
    }
  };

  return (
    <Box className="auth-page">
      <Paper component="section" className="auth-container" elevation={3} sx={{p: {xs: 2, sm: 4}}}>
        <Typography variant="h4" component="h1" className="page-title" gutterBottom sx={{textAlign: 'center', fontWeight: 700, fontSize: {xs: '1.8rem', sm: '2.2rem'}}}>
          Вход в {APP_NAME}
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 'var(--border-radius-small)' }} role="alert">{error}</Alert>}
          <TextField
            margin="normal"
            required
            fullWidth
            id="login-email"
            label="Email адрес"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || googleLoading}
            aria-required="true"
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Пароль"
            type="password"
            id="login-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || googleLoading}
            aria-required="true"
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 1.5, py: 1.5, borderRadius: 'var(--border-radius-large)', fontWeight: 600 }}
            disabled={loading || googleLoading}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Войти'}
          </Button>
          
          <Divider sx={{ my: 2 }}>ИЛИ</Divider>

          <Button
            fullWidth
            variant="outlined"
            startIcon={<GoogleIcon />}
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            sx={{ mb: 2, py: 1.5, borderRadius: 'var(--border-radius-large)', fontWeight: 500, borderColor: 'var(--border-color)', color: 'text.primary' }}
          >
            {googleLoading ? <CircularProgress size={24} /> : 'Войти с Google'}
          </Button>

          <Typography variant="body2" align="center" className="auth-switch">
            Нет аккаунта?{' '}
            <MuiLink component="button" variant="body2" onClick={() => onNavigate(View.Register)} disabled={loading || googleLoading} sx={{fontWeight: 500}}>
              Зарегистрироваться
            </MuiLink>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};
