import React from 'react';
import { Box, Typography, Link } from '@mui/material';
import { APP_NAME } from '../../config/constants';

interface AppFooterProps {
  onOpenLegalModal: () => void;
  onNavigateToVersionHistory: () => void; // Added
}

export const AppFooter: React.FC<AppFooterProps> = ({ onOpenLegalModal, onNavigateToVersionHistory }) => (
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
      {' '}
      <Link component="button" onClick={onNavigateToVersionHistory} sx={{ color: 'text.secondary', textDecoration: 'underline', cursor: 'pointer' }}>
        Версия: 3.165
      </Link>
    </Typography>
  </Box>
);