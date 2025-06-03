
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField, Button, CircularProgress } from '@mui/material';

interface PointsInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (points: number) => Promise<void>;
  userName: string;
  currentPoints: number;
  isLoading?: boolean;
}

export const PointsInputModal: React.FC<PointsInputModalProps> = ({
  isOpen,
  onClose,
  onSave,
  userName,
  currentPoints,
  isLoading = false,
}) => {
  const [pointsToAdd, setPointsToAdd] = useState<string>('0');
  const [error, setError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPointsToAdd('0');
      setError('');
      // Auto-focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handlePointsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty, negative sign, or numbers
    if (value === '' || value === '-' || /^-?\d*$/.test(value)) {
      setPointsToAdd(value);
      setError('');
    } else {
      setError('Только целые числа (можно отрицательные).');
    }
  };

  const handleSubmit = async () => {
    const numPoints = parseInt(pointsToAdd, 10);
    if (isNaN(numPoints)) {
      setError('Пожалуйста, введите корректное число.');
      return;
    }
    if (numPoints === 0) {
      setError('Количество баллов для добавления не может быть равно нулю.');
      return;
    }

    // Confirmation step could be added here if needed, or handled by the parent
    // For now, directly calls onSave
    setError('');
    await onSave(numPoints);
    // onClose(); // Parent should call onClose after save if successful
  };

  return (
    <Dialog open={isOpen} onClose={onClose} PaperProps={{ sx: { borderRadius: 'var(--border-radius-large)' } }}>
      <DialogTitle id="points-input-modal-title">Добавить/Вычесть Баллы</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Пользователь: <strong>{userName}</strong>.
          <br />
          Текущий баланс: <strong>{currentPoints} ✨</strong>.
          <br />
          Введите количество баллов для добавления (положительное число) или вычитания (отрицательное число).
        </DialogContentText>
        <TextField
          autoFocus
          inputRef={inputRef}
          margin="dense"
          id="points-to-add"
          label="Количество баллов (+/-)"
          type="text" // Use text to allow '-' then parse
          fullWidth
          variant="outlined"
          value={pointsToAdd}
          onChange={handlePointsChange}
          error={!!error}
          helperText={error}
          disabled={isLoading}
          inputProps={{ pattern: "-?\\d*" }}
        />
      </DialogContent>
      <DialogActions sx={{ p: '16px 24px' }}>
        <Button onClick={onClose} disabled={isLoading} color="inherit">Отмена</Button>
        <Button onClick={handleSubmit} disabled={isLoading || !!error || pointsToAdd === '' || pointsToAdd === '-'} variant="contained">
          {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
