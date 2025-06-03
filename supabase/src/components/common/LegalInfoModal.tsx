
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Checkbox, FormControlLabel, Alert, Divider } from '@mui/material';
import { APP_NAME } from '../../config/constants';
import { formatDate } from '../../utils/helpers';

interface LegalInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
  hasAgreed: boolean;
  agreementDate: Date | null;
  isUserLoggedIn: boolean;
}

const PLACEHOLDER_LEGAL_TEXT = `
### Условия использования ${APP_NAME}

**Дата последнего обновления:** 01.06.2025

Добро пожаловать в ${APP_NAME}! Используя наш сайт и сервисы, вы соглашаетесь с настоящими Условиями использования.

1.  **Общие положения:**
    *   Сервис предоставляется "как есть". Мы не несем ответственности за возможные ошибки или перерывы в работе.
    *   Вы обязуетесь не использовать сервис в незаконных целях.
2.  **Контент пользователя:**
    *   Вы несете ответственность за любой контент, который вы создаете или загружаете.
    *   Мы оставляем за собой право удалять контент, нарушающий наши правила.
3.  **Интеллектуальная собственность:**
    *   Весь контент на сайте, за исключением пользовательского, является нашей собственностью.
4.  **Ограничение ответственности:**
    *   Мы не несем ответственности за косвенные убытки, возникшие в результате использования сервиса.
5.  **Изменения Условий:**
    *   Мы можем изменять эти Условия. Уведомления об изменениях будут опубликованы на сайте.

---

### Политика конфиденциальности ${APP_NAME}

**Дата последнего обновления:** 01.06.2025

Мы ценим вашу конфиденциальность и стремимся защищать ваши личные данные.

1.  **Собираемая информация:**
    *   Мы собираем информацию, которую вы предоставляете при регистрации (например, email, имя пользователя).
    *   Мы можем собирать данные об использовании сервиса (например, IP-адрес, тип браузера, логи чатов с AI для улучшения сервиса).
2.  **Использование информации:**
    *   Для предоставления и улучшения наших сервисов.
    *   Для связи с вами по вопросам поддержки и обновлений.
    *   Для анализа использования сервиса с целью его оптимизации.
3.  **Передача данных третьим лицам:**
    *   Мы не продаем ваши личные данные третьим лицам.
    *   Данные могут быть переданы только в случаях, предусмотренных законодательством, или доверенным партнерам для обеспечения работы сервиса (например, хостинг-провайдерам, AI API провайдерам на условиях конфиденциальности).
4.  **Безопасность данных:**
    *   Мы принимаем разумные меры для защиты ваших данных.
5.  **Ваши права:**
    *   Вы имеете право на доступ, исправление или удаление ваших личных данных. Свяжитесь с нами для этого.
6.  **Файлы Cookie:**
    *   Мы используем файлы cookie для улучшения работы сайта. Вы можете настроить свой браузер для отказа от cookie.
7.  **Изменения Политики:**
    *   Мы можем обновлять эту Политику. Изменения вступают в силу с момента публикации.

**Контактная информация:** anviht@yandex.ru
`;


export const LegalInfoModal: React.FC<LegalInfoModalProps> = ({
  isOpen,
  onClose,
  onAgree,
  hasAgreed,
  agreementDate,
  isUserLoggedIn,
}) => {
  const [isChecked, setIsChecked] = useState(false);
  const descriptionElementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsChecked(false); // Reset checkbox state when modal opens
      const { current: descriptionElement } = descriptionElementRef;
      if (descriptionElement !== null) {
        descriptionElement.focus();
      }
    }
  }, [isOpen]);

  const handleAgreeAndSave = () => {
    if (isUserLoggedIn) {
        onAgree();
    } else {
        // For guests, just close, agreement is implicit for session
        onClose();
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      scroll="paper"
      aria-labelledby="legal-info-modal-title"
      aria-describedby="legal-info-modal-description"
      PaperProps={{ sx: { borderRadius: 'var(--border-radius-large)', maxWidth: '700px' } }}
    >
      <DialogTitle id="legal-info-modal-title" sx={{textAlign: 'center', fontWeight: 600}}>
        Условия использования и Политика конфиденциальности
      </DialogTitle>
      <DialogContent dividers>
        <Box 
            id="legal-info-modal-description" 
            ref={descriptionElementRef} 
            tabIndex={-1} 
            sx={{ 
                fontSize: '0.9rem', 
                lineHeight: 1.6,
                '& h3': { mt: 2, mb: 1, fontSize: '1.1em', fontWeight: 'bold' },
                '& ul': { pl: 2.5, mb: 1.5 },
                '& p, & li': { mb: 1 }
            }}
        >
          {/* Replace with ReactMarkdown or dangerouslySetInnerHTML if content comes from CMS/DB and is trusted HTML */}
          {PLACEHOLDER_LEGAL_TEXT.split('\n\n---').map((section, index) => (
            <React.Fragment key={index}>
              {section.split('\n').map((paragraph, pIndex) => {
                if (paragraph.startsWith('### ')) {
                  return <Typography variant="h6" component="h3" key={pIndex} gutterBottom sx={{mt: index > 0 ? 3 : 1.5, mb: 1.5, fontSize: '1.25rem !important'}}>{paragraph.substring(4)}</Typography>;
                }
                if (paragraph.startsWith('1.  **') || paragraph.match(/^\d+\.\s+\*\*/)) { // Lists with bold items
                  const itemText = paragraph.substring(paragraph.indexOf('**') + 2, paragraph.lastIndexOf('**'));
                  const restOfLine = paragraph.substring(paragraph.lastIndexOf('**') + 2);
                  return <Typography component="div" key={pIndex} sx={{mb: 0.8}}><Typography component="strong" sx={{fontWeight: 'bold'}}>{itemText}</Typography>{restOfLine}</Typography>;
                }
                if (paragraph.startsWith('*   ')) { // Simple list items
                    return <Typography component="li" key={pIndex} sx={{ml:2, mb: 0.5}}>{paragraph.substring(4)}</Typography>
                }
                return <Typography component="p" key={pIndex} sx={{mb:1}}>{paragraph}</Typography>;
              })}
              {index < PLACEHOLDER_LEGAL_TEXT.split('\n\n---').length - 1 && <Divider sx={{my:3}}/>}
            </React.Fragment>
          ))}
        </Box>
        
        {isUserLoggedIn && hasAgreed && agreementDate && (
          <Alert severity="info" sx={{ mt: 2, borderRadius: 'var(--border-radius)'}}>
            Вы приняли эти условия {formatDate(agreementDate.toISOString(), true)}.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ p: '16px 24px', flexDirection: 'column', alignItems: 'stretch' }}>
        {!hasAgreed && (
          <FormControlLabel
            control={
              <Checkbox
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                name="agreeTerms"
                color="primary"
              />
            }
            label={`Я прочитал(а) и согласен(а) с Условиями использования и Политикой конфиденциальности ${APP_NAME}.`}
            sx={{ mb: 1, fontSize: '0.9rem' }}
          />
        )}
        {isUserLoggedIn && !hasAgreed && (
          <Button onClick={handleAgreeAndSave} variant="contained" disabled={!isChecked} fullWidth>
            Сохранить и принять
          </Button>
        )}
        {!isUserLoggedIn && !hasAgreed && (
             <Typography variant="caption" color="text.secondary" sx={{textAlign: 'center', mt:1, mb:1}}>
                Продолжая использовать сайт как гость, вы принимаете Условия использования и Политику конфиденциальности.
            </Typography>
        )}
        <Button onClick={onClose} fullWidth sx={{mt: !hasAgreed ? 1 : 0}}>
          {hasAgreed || !isUserLoggedIn ? 'Закрыть' : 'Закрыть (Принять позже)'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
