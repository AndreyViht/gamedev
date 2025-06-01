
export type AIModelId = 'viht-brain' | 'viht-codemaster' | 'viht-sobesednik' | 'viht-generate-002';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'model';
  text: string;
  filePreview?: string;
  fileName?: string;
  fileType?: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: Date;
  customInstruction: string;
  systemInstructionSnapshot?: string;
  selectedModelId: AIModelId; // ID выбранной AI модели для этого чата
  modelDisplayName?: string; // Отображаемое имя модели (для истории, если нужно)
  modelVersion?: string; // Версия модели (для истории, если нужно)
}