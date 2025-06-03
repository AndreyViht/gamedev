import React from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText, Button, Chip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { APP_NAME } from '../../config/constants';

interface VersionHistoryPageProps {
  onNavigateBack: () => void;
}

interface ChangeDetail {
  type: 'feature' | 'fix' | 'improvement' | 'style' | 'refactor' | 'docs' | 'chore';
  description: string;
  component?: string; // Optional: specific component affected
}

interface VersionEntry {
  version: string;
  date: string;
  title?: string;
  changes: ChangeDetail[];
}

// Static data for now. This would ideally come from a CMS or a JSON file.
const versionData: VersionEntry[] = [
  {
    version: '3.167',
    date: 'Текущее Обновление',
    title: 'Редизайн Достижений, Ежедневных Заданий (с AI) и Боковых Панелей, Улучшение Чата',
    changes: [
      { type: 'style', description: 'Блоки достижений сделаны более минималистичными и компактными. Описание удалено из видимой части (осталось в Tooltip).', component: 'AccountSection.tsx, index.css' },
      { type: 'feature', description: 'Блоки ежедневных заданий переделаны для отображения в ряд. После получения награды появляется 24-часовой таймер.', component: 'AccountSection.tsx, index.css' },
      { type: 'feature', description: 'Интегрирован AI (Gemini) для генерации нового названия, описания и количества очков для ежедневных заданий по истечении таймера.', component: 'AccountSection.tsx, types/auth.ts' },
      { type: 'improvement', description: 'При ошибке AI-чата, связанной с региональными ограничениями, теперь отображается сообщение: "Включите пожалуйста VPN (данная проблема будет временно)".', component: 'AIChatPage.tsx' },
      { type: 'style', description: 'Боковые меню в Личном кабинете и Админ-панели сделаны более минималистичными: уменьшена ширина, отступы, размеры шрифтов и иконок.', component: 'DashboardLayout.tsx, AdminDashboardLayout.tsx, index.css' },
      { type: 'refactor', description: 'Обновлены типы для `daily_task_progress` для поддержки AI-генерируемого контента и таймеров.', component: 'types/auth.ts' },
      { type: 'docs', description: 'Обновлена история версий.', component: 'VersionHistoryPage.tsx, AppFooter.tsx' },
    ],
  },
  {
    version: '3.166',
    date: '2024-07-30', // Assuming previous update date
    title: 'Улучшение Отображения Лимитов AI',
    changes: [
      { type: 'improvement', description: "Перемещена информация о лимитах AI-запросов и дате их следующего сброса из карточки 'Статус и Лимиты' в карточку 'Доступные AI Модели' в разделе 'Аккаунт'.", component: 'AccountSection.tsx' },
      { type: 'docs', description: 'Обновлена история версий для отражения последних изменений.', component: 'VersionHistoryPage.tsx, AppFooter.tsx' },
    ],
  },
  {
    version: '3.165',
    date: '2024-07-29', 
    title: 'Мобильный Редизайн Чатов и История Версий',
    changes: [
      { type: 'feature', description: 'Полный редизайн интерфейса чатов (AI, Поддержка) для мобильных устройств (Android) для улучшения UX.', component: 'AIChatPage, HelpChatSection, AdminSupportChatsSection' },
      { type: 'style', description: 'На мобильных устройствах чаты теперь выглядят как полноэкранные приложения с минималистичными кнопками управления.', component: 'index.css, AIChatPage, HelpChatSection' },
      { type: 'feature', description: 'Боковые панели со списком чатов/тикетов на мобильных устройствах сделаны скрываемыми и доступными по кнопке.', component: 'AIChatPage, HelpChatSection, AdminSupportChatsSection' },
      { type: 'feature', description: 'Добавлена информация о версии приложения в футер.', component: 'AppFooter.tsx' },
      { type: 'feature', description: 'Создана страница "История Версий" для отслеживания изменений в приложении.', component: 'VersionHistoryPage.tsx, App.tsx' },
      { type: 'improvement', description: 'Обновлена логика навигации для поддержки новой страницы истории версий.', component: 'App.tsx' },
      { type: 'style', description: 'Улучшены стили для мобильных устройств в глобальном CSS.', component: 'index.css' },
    ],
  },
];

const getChipColor = (type: ChangeDetail['type']): "primary" | "secondary" | "success" | "error" | "info" | "warning" => {
    switch (type) {
        case 'feature': return 'success';
        case 'fix': return 'error';
        case 'improvement': return 'primary';
        case 'style': return 'info';
        case 'refactor': return 'secondary';
        case 'docs': return 'warning';
        default: return 'default' as any; // MUI Chip "default" color
    }
};


export const VersionHistoryPage: React.FC<VersionHistoryPageProps> = ({ onNavigateBack }) => {
  return (
    <Box className="version-history-page">
      <Typography variant="h4" component="h1" className="page-title">
        История Версий {APP_NAME}
      </Typography>

      {versionData.map((versionEntry) => (
        <Paper key={versionEntry.version} className="version-item" elevation={2} component="section" aria-labelledby={`version-heading-${versionEntry.version}`}>
          <Box className="version-item-header">
            <Typography variant="h5" component="h2" className="version-number" id={`version-heading-${versionEntry.version}`}>
              Версия: {versionEntry.version}
            </Typography>
            <Typography className="version-date">{versionEntry.date}</Typography>
          </Box>
          {versionEntry.title && (
            <Typography variant="h6" component="h3" gutterBottom sx={{fontWeight: 500, fontSize: '1.2rem'}}>
              {versionEntry.title}
            </Typography>
          )}
          <List className="version-changes-list" aria-label={`Изменения в версии ${versionEntry.version}`}>
            {versionEntry.changes.map((change, index) => (
              <ListItem key={index} disableGutters sx={{display: 'flex', alignItems: 'flex-start', flexDirection: 'column', mb: 1}}>
                 <Chip 
                    label={change.type.charAt(0).toUpperCase() + change.type.slice(1)} 
                    size="small" 
                    color={getChipColor(change.type)}
                    sx={{ mb: 0.5, fontWeight: 500, fontSize: '0.75rem' }}
                />
                <ListItemText 
                    primary={change.description} 
                    secondary={change.component ? `Компонент: ${change.component}` : null} 
                    primaryTypographyProps={{fontSize: '1rem'}}
                    secondaryTypographyProps={{fontSize: '0.8rem', sx: { opacity: 0.8 } }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      ))}
      
      <Button
        variant="contained"
        startIcon={<ArrowBackIcon />}
        onClick={onNavigateBack}
        className="primary-button"
        aria-label="Назад на главную страницу"
      >
        Назад
      </Button>
    </Box>
  );
};