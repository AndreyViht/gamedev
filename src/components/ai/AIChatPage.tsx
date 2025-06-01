import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GoogleGenAI, GenerateContentResponse, Part } from '@google/genai';
import { UserProfile, ChatMessage, ChatSession, AIModelId } from '../../types';
import { View } from '../../enums/appEnums';
import { CodeBlock } from '../common/CodeBlock';
import { AISettingsModal } from './AISettingsModal';
import { NameInputModal } from '../common/NameInputModal';
import { APP_NAME, MAX_SAVED_CHATS, USER_AI_REQUEST_LIMIT, PREMIUM_USER_AI_REQUEST_LIMIT } from '../../config/constants';
import { aiModels, DEFAULT_AI_MODEL_ID, AIModelConfig } from '../../config/aiModels';

import { Box, TextField, Button, IconButton, Typography, Paper, List, ListItem, ListItemButton, ListItemText, ListItemSecondaryAction, CircularProgress, Alert } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SettingsIcon from '@mui/icons-material/Settings';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';


interface AIChatPageProps {
  genAI: GoogleGenAI;
  user: UserProfile | null;
  onAiRequestMade: () => void;
  onNavigate: (view: View) => void;
  isInsideDashboard?: boolean;
  globalAiRequestsMade: number;
  globalAiRequestsLimit: number;
}

type CustomCodeProps = React.ComponentPropsWithoutRef<'code'> & {
  node?: any; inline?: boolean; children: React.ReactNode;
};

const VIHT_IMAGE_GEN_ID: AIModelId = 'viht-generate-002';

export const AIChatPage: React.FC<AIChatPageProps> = ({ genAI: ai, user, onAiRequestMade, onNavigate, isInsideDashboard, globalAiRequestsMade, globalAiRequestsLimit }) => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAiSettingsModalOpen, setIsAiSettingsModalOpen] = useState(false);
  const [isNewChatNameModalOpen, setIsNewChatNameModalOpen] = useState(false);
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
  const [elapsedThinkingTime, setElapsedThinkingTime] = useState<number>(0);
  const thinkingIntervalRef = useRef<number | null>(null);

  const aiRequestsMade = user ? (user.user_metadata?.ai_requests_made ?? 0) : globalAiRequestsMade;
  const aiRequestsLimit = user
    ? (user.user_metadata?.ai_requests_limit ?? (user.user_metadata?.is_premium ? PREMIUM_USER_AI_REQUEST_LIMIT : USER_AI_REQUEST_LIMIT))
    : globalAiRequestsLimit;

  const chatStorageKeyPrefix = user ? `gameDevFactory_chats_vk_style_${user.id}` : 'gameDevFactory_chats_vk_style_guest';
  const activeChatIdStorageKey = user ? `gameDevFactory_activeChatId_vk_style_${user.id}` : 'gameDevFactory_activeChatId_vk_style_guest';
  
  const currentChat = chatSessions.find(cs => cs.id === activeChatId);
  const isUserPremium = user?.user_metadata?.is_premium ?? false;

  const createNewChatSession = (name: string, instruction?: string, modelId: AIModelId = DEFAULT_AI_MODEL_ID): ChatSession => {
    const modelConfig = aiModels[modelId] || aiModels[DEFAULT_AI_MODEL_ID];
    return {
      id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, name, messages: [],
      createdAt: new Date(), customInstruction: instruction || '', selectedModelId: modelId,
      modelDisplayName: modelConfig.displayName, modelVersion: modelConfig.version,
    };
  };

 useEffect(() => {
    const storedSessionsRaw = localStorage.getItem(chatStorageKeyPrefix);
    let loadedSessions: ChatSession[] = [];
    let parseError = false;

    if (storedSessionsRaw) {
      try {
        const parsed = JSON.parse(storedSessionsRaw);
        if (!Array.isArray(parsed)) throw new Error("Stored data is not an array");
        loadedSessions = parsed.map((s: any) => {
          if (!s || typeof s !== 'object' || !s.id || !s.messages || !s.createdAt) return null;
          return {
            ...s, createdAt: new Date(s.createdAt),
            messages: Array.isArray(s.messages) ? s.messages.map((m: any) => {
              if (!m || typeof m !== 'object' || !m.id || !m.timestamp) return null;
              return { ...m, timestamp: new Date(m.timestamp) };
            }).filter(Boolean) as ChatMessage[] : [],
            selectedModelId: s.selectedModelId || DEFAULT_AI_MODEL_ID, 
            customInstruction: s.customInstruction || '',
          };
        }).filter(Boolean) as ChatSession[];
      } catch (e) { parseError = true; console.error("Error parsing chats from localStorage:", e); }
    }

    const storedActiveId = localStorage.getItem(activeChatIdStorageKey);
    if (loadedSessions.length === 0) { 
      const newChatName = "Стартовый Чат" + (parseError ? " (ошибка загрузки)" : "");
      const newChat = createNewChatSession(newChatName);
      setChatSessions([newChat]);
      setActiveChatId(newChat.id);
    } else {
      setChatSessions(loadedSessions);
      if (storedActiveId && loadedSessions.some(s => s.id === storedActiveId)) {
        setActiveChatId(storedActiveId);
      } else if (loadedSessions.length > 0) {
        setActiveChatId(loadedSessions[0].id);
      }
    }
  }, [chatStorageKeyPrefix, activeChatIdStorageKey]); 


  useEffect(() => {
    localStorage.setItem(chatStorageKeyPrefix, JSON.stringify(chatSessions));
  }, [chatSessions, chatStorageKeyPrefix]);

  useEffect(() => {
    if (activeChatId) localStorage.setItem(activeChatIdStorageKey, activeChatId);
    else localStorage.removeItem(activeChatIdStorageKey);
  }, [activeChatId, activeChatIdStorageKey]);

  useEffect(() => {
    if (isLoading && currentChat && aiModels[currentChat.selectedModelId]?.id !== VIHT_IMAGE_GEN_ID) {
      setThinkingStartTime(Date.now());
      setElapsedThinkingTime(0);
      thinkingIntervalRef.current = setInterval(() => {
        setElapsedThinkingTime(prev => prev + 1);
      }, 1000) as unknown as number; // Cast to number for browser compatibility
    } else {
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
        thinkingIntervalRef.current = null;
      }
      setThinkingStartTime(null);
    }
    return () => {
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
      }
    };
  }, [isLoading, currentChat?.selectedModelId]); // Ensure dependencies are correct

  const handleOpenNewChatModal = () => setIsNewChatNameModalOpen(true);
  const handleSaveNewChatName = (name: string) => { 
    setIsNewChatNameModalOpen(false);
    const newChatName = name.trim() || `Чат ${chatSessions.length + 1} - ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
    const newChat = createNewChatSession(newChatName); 
    setChatSessions(prev => {
        const updatedSessions = [newChat, ...prev];
        return updatedSessions.length > MAX_SAVED_CHATS ? updatedSessions.slice(0, MAX_SAVED_CHATS) : updatedSessions;
    });
    setActiveChatId(newChat.id);
  };
  const handleSelectChat = (chatId: string) => setActiveChatId(chatId);
  const handleDeleteChat = (chatIdToDelete: string) => {  
    setChatSessions(prev => {
        const remainingChats = prev.filter(chat => chat.id !== chatIdToDelete);
        if (activeChatId === chatIdToDelete) {
            if (remainingChats.length > 0) {
                setActiveChatId(remainingChats[0].id);
            } else {
                const newChat = createNewChatSession("Новый Чат");
                setActiveChatId(newChat.id);
                return [newChat];
            }
        }
         if (remainingChats.length === 0) {
          const newChat = createNewChatSession("Новый Чат (авто)");
          setActiveChatId(newChat.id);
          return [newChat];
        }
        return remainingChats;
    });
  };
  const handleRenameChat = (chatIdToRename: string, newName: string) => { 
    if (!newName.trim()) return;
    setChatSessions(prev => prev.map(chat =>
      chat.id === chatIdToRename ? { ...chat, name: newName.trim() } : chat
    ));
  };

  const scrollToBottom = useCallback(() => { setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 100); }, []);
  useEffect(scrollToBottom, [currentChat?.messages, isLoading]);

  const handleSendMessage = async () => { 
    if (!currentChat || !input.trim()) return;
    if (!ai) { setError("Клиент Gemini AI не инициализирован."); setIsLoading(false); return; }
    if (aiRequestsMade >= aiRequestsLimit) { setError(user ? "Вы достигли лимита запросов." : "Лимит для гостей. Зарегистрируйтесь/войдите, чтобы продолжить."); return; }

    const selectedModelConfig = aiModels[currentChat.selectedModelId] || aiModels[DEFAULT_AI_MODEL_ID];
    if (selectedModelConfig.isPremium && !isUserPremium) { setError(`Для использования модели "${selectedModelConfig.displayName}" требуется Премиум-статус.`); return; }
    
    const userMessageText = input.trim();
    const userMessage: ChatMessage = { id: `msg_${Date.now()}_user`, sender: 'user', text: userMessageText, timestamp: new Date() };

    setChatSessions(prev => prev.map(cs => cs.id === activeChatId ? {...cs, messages: [...cs.messages, userMessage]} : cs ));
    setInput(''); setIsLoading(true); setError(null);
    const userNameForAI = user?.user_metadata?.display_name;

    try {
      let modelMessage: ChatMessage;
      if (selectedModelConfig.id === VIHT_IMAGE_GEN_ID) {
        modelMessage = { id: `msg_${Date.now()}_model_dev`, sender: 'model', text: `Функция генерации изображений для модели '${selectedModelConfig.displayName}' находится в разработке. Пожалуйста, попробуйте позже или выберите другую модель.`, timestamp: new Date() };
      } else {
        const parts: Part[] = [{ text: userMessageText }];
        const systemInstruction = selectedModelConfig.getSystemInstruction(userNameForAI, currentChat.customInstruction);
        const result: GenerateContentResponse = await ai.models.generateContent({ model: selectedModelConfig.geminiModelName, contents: [{ role: "user", parts }], config: { systemInstruction } });
        modelMessage = { id: `msg_${Date.now()}_model_text`, sender: 'model', text: result.text, timestamp: new Date() };
      }
      setChatSessions(prev => prev.map(cs => cs.id === activeChatId ? { ...cs, messages: [...cs.messages, modelMessage], systemInstructionSnapshot: selectedModelConfig.id !== VIHT_IMAGE_GEN_ID ? selectedModelConfig.getSystemInstruction(userNameForAI, currentChat.customInstruction) : undefined, modelDisplayName: selectedModelConfig.displayName, modelVersion: selectedModelConfig.version, } : cs ));
      onAiRequestMade();
    } catch (e: any) {
      const errorMessage = `Ошибка ${selectedModelConfig.displayName}: ${e.message || "Неизвестная ошибка"}`;
      setError(errorMessage);
      const errorMsgObj: ChatMessage = { id: `msg_${Date.now()}_error`, sender: 'model', text: `Извините, произошла ошибка. (${e.message || 'Попробуйте позже.'})`, timestamp: new Date() };
      setChatSessions(prev => prev.map(cs => cs.id === activeChatId ? {...cs, messages: [...cs.messages, errorMsgObj]} : cs));
    } finally { setIsLoading(false); }
  };

  const handleSaveAISettingsInstruction = (newInstruction: string) => { 
    if (currentChat) {
      setChatSessions(prev => prev.map(cs =>
        cs.id === activeChatId ? {...cs, customInstruction: newInstruction} : cs
      ));
    }
  };
  const handleModelSelectInSettings = (modelId: AIModelId) => { 
      if (currentChat) {
          const modelConfig = aiModels[modelId];
          setChatSessions(prev => prev.map(cs =>
              cs.id === activeChatId ? { ...cs, selectedModelId: modelId, modelDisplayName: modelConfig.displayName, modelVersion: modelConfig.version } : cs
          ));
      }
  };

  const limitReached = aiRequestsMade >= aiRequestsLimit;
  const baseInputAreaDisabled = isLoading || limitReached;
  const sendActionDisabled = baseInputAreaDisabled || !input.trim();

  if (!currentChat && chatSessions.length > 0 && !activeChatId && chatSessions[0]?.id) {
      setActiveChatId(chatSessions[0].id); return <CircularProgress sx={{display: 'block', margin: 'auto', mt: 4}}/>;
  }
  if (!currentChat && chatSessions.length === 0 && activeChatId === null) {
      return <CircularProgress sx={{display: 'block', margin: 'auto', mt: 4}}/>;
  }
  if (!currentChat) {
      if(chatSessions.length > 0 && chatSessions[0]?.id) {
          setActiveChatId(chatSessions[0].id); return <CircularProgress sx={{display: 'block', margin: 'auto', mt: 4}}/>;
      }
      return <Alert severity="error" sx={{m: 2}}>Активный чат не найден. Попробуйте обновить.</Alert>;
  }
  
  const currentModelConfig = aiModels[currentChat.selectedModelId] || aiModels[DEFAULT_AI_MODEL_ID];
  let placeholderText = `Сообщение для ${currentModelConfig.displayName || 'AI'}...`;
  if (currentModelConfig.id === VIHT_IMAGE_GEN_ID) placeholderText = `Запрос для ${currentModelConfig.displayName} (в разработке)...`;
  if (limitReached) placeholderText = "Лимит запросов достигнут";

  return (
    <Box className={`ai-chat-page vk-style ${isInsideDashboard ? 'ai-chat-dashboard' : ''}`} sx={{ display: 'flex', height: '100%'}}>
      <NameInputModal isOpen={isNewChatNameModalOpen} onClose={() => setIsNewChatNameModalOpen(false)} onSave={handleSaveNewChatName} title="Новый AI Чат" label="Название чата" placeholder="Напр., 'Идеи для RPG'" isLoading={isLoading} />
      {isAiSettingsModalOpen && currentChat && <AISettingsModal currentInstruction={currentChat.customInstruction} onSaveInstruction={handleSaveAISettingsInstruction} onClose={() => setIsAiSettingsModalOpen(false)} currentSelectedModelId={currentChat.selectedModelId} onModelSelect={handleModelSelectInSettings} isUserPremium={isUserPremium} />}
      
      <Box className="chat-main-area" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', borderRight: theme => `1px solid ${theme.palette.divider}` }}>
        <Paper square elevation={0} className="chat-header" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: theme => `1px solid ${theme.palette.divider}` }}>
            <Box>
                <Typography variant="h6" className="chat-page-title" noWrap>{currentChat.name}</Typography>
                <Typography variant="caption" className="chat-model-info">Модель: {currentModelConfig.displayName}{currentChat.selectedModelId === VIHT_IMAGE_GEN_ID && ` (генерация изображений в разработке)`}</Typography>
            </Box>
            <Box className="chat-controls" sx={{display: 'flex', alignItems: 'center'}}>
                <IconButton onClick={() => { const newName = prompt("Новое имя чата:", currentChat.name); if (newName !== null) handleRenameChat(currentChat.id, newName); }} aria-label="Переименовать чат" title="Переименовать чат"><EditIcon /></IconButton>
                <IconButton onClick={() => setIsAiSettingsModalOpen(true)} aria-label="Настройки AI" title="Настройки AI"><SettingsIcon /></IconButton>
                <Typography variant="caption" className="ai-request-info" sx={{ml: 1, color: 'text.secondary', display: {xs: 'none', sm: 'inline'}}}>Запросы: {aiRequestsMade}/{aiRequestsLimit}</Typography>
            </Box>
        </Paper>
        <Box className="chat-messages-container" sx={{ flexGrow: 1, overflowY: 'auto', p: 2, bgcolor: 'background.default' }}>
            {currentChat.messages.map(msg => (
            <Box key={msg.id} className={`chat-message ${msg.sender} chat-message-appear`} sx={{ display: 'flex', mb: 1.5, justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                <Paper elevation={1} className="message-bubble" sx={{ p: '10px 15px', borderRadius: '18px', maxWidth: '70%', bgcolor: msg.sender === 'user' ? 'primary.main' : 'background.paper', color: msg.sender === 'user' ? 'primary.contrastText' : 'text.primary', borderBottomRightRadius: msg.sender === 'user' ? '8px' : '18px', borderBottomLeftRadius: msg.sender === 'model' ? '8px' : '18px' }}>
                  <ReactMarkdown children={msg.text} remarkPlugins={[remarkGfm]} components={{ code: ({node, inline, className, children, ...props}: CustomCodeProps) => { const match = /language-(\w+)/.exec(className || ''); return !inline && match ? <CodeBlock language={match[1]}>{String(children).replace(/\n$/, '')}</CodeBlock> : <code className={className} {...props}>{children}</code>; }}} />
                  <Typography variant="caption" display="block" sx={{ textAlign: msg.sender === 'user' ? 'right' : 'left', opacity: 0.7, mt: 0.5 }}>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Typography>
                </Paper>
            </Box>
            ))}
            {isLoading && currentChat.selectedModelId !== VIHT_IMAGE_GEN_ID && (
            <Box className="chat-message model thinking-indicator chat-message-appear" sx={{ display: 'flex', mb: 1.5 }}>
                <Paper elevation={1} className="message-bubble" sx={{ p: '10px 15px', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'background.paper' }}>
                  <div className="spinner-dots"><div></div><div></div><div></div></div>
                  <Typography variant="body2" className="thinking-text" sx={{fontStyle: 'italic', color: 'text.secondary'}}> {`${currentModelConfig.displayName} думает...`} </Typography>
                  {thinkingStartTime !== null && <Typography variant="caption" className="thinking-timer">{elapsedThinkingTime} сек.</Typography>}
                </Paper>
            </Box>
            )}
             {isLoading && currentChat.selectedModelId === VIHT_IMAGE_GEN_ID && ( // Separate indicator for image generation
                <Box className="chat-message model thinking-indicator chat-message-appear" sx={{ display: 'flex', mb: 1.5 }}>
                    <Paper elevation={1} className="message-bubble" sx={{ p: '10px 15px', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'background.paper' }}>
                        <CircularProgress size={20} />
                        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                            {currentModelConfig.displayName} (в разработке) обрабатывает запрос...
                        </Typography>
                    </Paper>
                </Box>
            )}
            <div ref={messagesEndRef} />
        </Box>
        {error && <Alert severity="error" sx={{m:1, borderRadius: 'var(--border-radius)'}}>{error}</Alert>}
        {limitReached && !isLoading && ( <Alert severity="info" sx={{m:1, borderRadius: 'var(--border-radius)'}}>{(!user ? (<>Лимит исчерпан для гостей. <Button onClick={() => onNavigate(View.Register)} size="small">Регистрация</Button> или <Button onClick={() => onNavigate(View.Login)} size="small">Войдите</Button> для увеличения лимита.</>) : ("Лимит запросов на эту неделю исчерпан."))}</Alert>)}
        <Paper square elevation={0} className="chat-input-area" sx={{ p: '10px 15px', borderTop: theme => `1px solid ${theme.palette.divider}`, display: 'flex', alignItems: 'flex-end' }}>
            <TextField fullWidth multiline maxRows={4} variant="outlined" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if(!sendActionDisabled) handleSendMessage(); }}}
              placeholder={placeholderText} disabled={baseInputAreaDisabled}
              sx={{ mr: 1, '& .MuiOutlinedInput-root': { borderRadius: '22px', '& fieldset': {border: 'none'}, '&.Mui-focused fieldset': {border: theme=> `1px solid ${theme.palette.primary.main}`} }, input: {py: '12px'} }}
            />
            <IconButton color="primary" onClick={handleSendMessage} disabled={sendActionDisabled} aria-label="Отправить"> <SendIcon /> </IconButton>
        </Paper>
      </Box>
      <Box className="chat-sessions-sidebar" sx={{ width: {xs: '100%', sm: 'var(--dashboard-sidebar-width)'}, borderRight: {xs: 'none', sm: theme => `1px solid ${theme.palette.divider}`}, p: '10px 0', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
        <Typography variant="h6" sx={{ p: '5px 18px 10px 18px', fontWeight: 600 }}>Чаты ({chatSessions.length}/{MAX_SAVED_CHATS})</Typography>
        <Button variant="outlined" startIcon={<AddCircleOutlineIcon />} onClick={handleOpenNewChatModal} disabled={chatSessions.length >= MAX_SAVED_CHATS || isLoading} sx={{ m: '0 15px 10px 15px', textTransform: 'none' }}>Новый чат</Button>
        <List sx={{ overflowY: 'auto', flexGrow: 1, p: '0 8px' }}>
          {chatSessions.map(cs => (
            <ListItem 
              key={cs.id} 
              disablePadding
              secondaryAction={
                <IconButton edge="end" aria-label="Удалить чат" onClick={() => handleDeleteChat(cs.id)} size="small">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemButton 
                selected={cs.id === activeChatId} 
                onClick={() => handleSelectChat(cs.id)} 
                sx={{
                  borderRadius: 'var(--border-radius-small)', 
                  mb: 0.5, 
                  '&.Mui-selected': {bgcolor: 'action.selected'}
                }}
              >
                <ListItemText 
                  primary={cs.name.length > 25 ? cs.name.substring(0,22) + "..." : cs.name} 
                  secondary={cs.modelDisplayName} 
                  primaryTypographyProps={{noWrap: true}} 
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Box>
  );
};
