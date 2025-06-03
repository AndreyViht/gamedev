
import React, { useState, useEffect, useRef } from 'react';
import { AIModelId } from '../../types/chat';
import { aiModels, AIModelConfig } from '../../config/aiModels';

interface AISettingsModalProps {
  currentInstruction: string;
  onSaveInstruction: (newInstruction: string) => void;
  onClose: () => void;
  currentSelectedModelId: AIModelId;
  onModelSelect: (modelId: AIModelId) => void;
  isUserPremium: boolean;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  currentInstruction,
  onSaveInstruction,
  onClose,
  currentSelectedModelId,
  onModelSelect,
  isUserPremium,
}) => {
  const [instruction, setInstruction] = useState(currentInstruction);
  const [selectedModel, setSelectedModel] = useState<AIModelId>(currentSelectedModelId);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInstruction(currentInstruction);
    setSelectedModel(currentSelectedModelId);
  }, [currentInstruction, currentSelectedModelId, onClose]); // Rerun if modal reopens

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveInstruction(instruction);
    onModelSelect(selectedModel); // Pass selected model ID up
    onClose(); // Close after saving both
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content ai-settings-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="ai-settings-modal-title">
        <h2 id="ai-settings-modal-title">Настройки AI (этот чат)</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="modal-ai-model-select">Модель AI:</label>
            <select
              id="modal-ai-model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as AIModelId)}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)' }}
            >
              {Object.values(aiModels).map((model: AIModelConfig) => (
                <option key={model.id} value={model.id} disabled={model.isPremium && !isUserPremium}>
                  {model.displayName} (v{model.version})
                  {model.isPremium && !isUserPremium ? ' - Премиум' : ''}
                </option>
              ))}
            </select>
            {aiModels[selectedModel] && (
              <p className="instruction-hint" style={{ marginTop: '8px' }}>
                {aiModels[selectedModel].description}
                {aiModels[selectedModel].isPremium && !isUserPremium && (
                  <strong style={{ color: 'var(--accent-color)', display: 'block' }}>
                    Для использования этой модели требуется Премиум-статус.
                  </strong>
                )}
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="modal-custom-ai-instruction">Дополнительные инструкции для AI:</label>
            <textarea
              id="modal-custom-ai-instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={4}
              placeholder="Напр.: 'отвечай кратко', 'будь формальным и официальным'"
            />
            <p className="instruction-hint">Эти инструкции будут добавлены к основным системным указаниям выбранной модели AI для текущего чата.</p>
          </div>

          <div className="modal-actions">
            <button type="submit" className="modal-button primary chat-interactive-button">Сохранить и закрыть</button>
            <button type="button" onClick={onClose} className="modal-button secondary chat-interactive-button">Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
};
