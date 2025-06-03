import React, { useEffect } from 'react';

export interface ToastConfig {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

interface ToastNotificationProps extends ToastConfig {
  onClose: (id: string) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  id,
  message,
  type,
  duration = 5000,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [id, duration, onClose]);

  return (
    <div className={`toast-notification ${type}`} role="alert" aria-live="assertive">
      <span className="toast-message">{message}</span>
      <button onClick={() => onClose(id)} className="toast-close-button" aria-label="Закрыть уведомление">
        &times;
      </button>
    </div>
  );
};
