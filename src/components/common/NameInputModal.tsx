import React, { useState, useEffect, useRef } from 'react';

interface NameInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: string) => void;
  title: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  isLoading?: boolean;
}

export const NameInputModal: React.FC<NameInputModalProps> = ({
  isOpen,
  onClose,
  onSave,
  title,
  label,
  placeholder = '',
  initialValue = '',
  isLoading = false,
}) => {
  const [value, setValue] = useState(initialValue);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue); // Reset value when modal opens/initialValue changes
      // Focus the input field when the modal opens
      setTimeout(() => inputRef.current?.focus(), 100); 
    }
  }, [isOpen, initialValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSave(value.trim());
    } else {
        // Optionally, show an error if value is empty, or let onSave handle it
        onSave(''); // Or onClose(); depending on desired behavior for empty input
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content name-input-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="name-input-modal-title">
        <h2 id="name-input-modal-title">{title}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name-input-modal-value">{label}:</label>
            <input
              type="text"
              id="name-input-modal-value"
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              disabled={isLoading}
              required
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="modal-button primary" disabled={isLoading || !value.trim()}>
              {isLoading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button type="button" onClick={onClose} className="modal-button secondary" disabled={isLoading}>
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
