import React from 'react';
import { Box, Typography, Link } from '@mui/material';
import { APP_NAME } from '../../config/constants';

interface AppFooterProps {
  onOpenLegalModal: () => void;
}

export const AppFooter: React.FC<AppFooterProps> = ({ onOpenLegalModal }) => (
  <Box 
    component="footer" 
    sx={{ 
      py: 2, 
      px: 2, 
      mt: 'auto', 
      textAlign: 'center',
      backgroundColor: 'transparent', 
    }}
    role="contentinfo"
  >
    <Typography variant="body2" color="text.secondary">
      &copy; {new Date().getFullYear()} {APP_NAME}.{' '}
      <Link component="button" onClick={onOpenLegalModal} sx={{ color: 'text.secondary', textDecoration: 'underline', cursor: 'pointer' }}>
        Все права защищены.
      </Link>
    </Typography>
  </Box>
);