

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { UserProfile, AdminSupportTicket, AdminChatMessage } from '../../../types';
import { supabase } from '../../../api/clients';
import { formatDate } from '../../../utils/helpers';
import { APP_NAME } from '../../../config/constants';
import { NameInputModal } from '../../common/NameInputModal'; 
import { CodeBlock } from '../../common/CodeBlock'; 

import { Box, TextField, Button, IconButton, Typography, Paper, List, ListItem, ListItemButton, ListItemText, CircularProgress, Alert, useMediaQuery, Fab, Drawer, Chip } from '@mui/material';
import { useTheme, Theme } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import MenuIcon from '@mui/icons-material/Menu';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CloseIcon from '@mui/icons-material/Close';


interface HelpChatSectionProps {
  user: UserProfile;
  onUserProfileUpdate: (updates: Partial<UserProfile['user_metadata']>) => Promise<void>; 
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type CustomCodeProps = React.ComponentPropsWithoutRef<'code'> & {
  node?: any; 
  inline?: boolean;
  children: React.ReactNode;
};

export const HelpChatSection: React.FC<HelpChatSectionProps> = ({ user, onUserProfileUpdate, showToast }) => {
    const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
    const [activeTicket, setActiveTicket] = useState<AdminSupportTicket | null>(null);
    const [messages, setMessages] = useState<AdminChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoadingTickets, setIsLoadingTickets] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
    
    const theme = useTheme<Theme>();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);


    const fetchMyTickets = useCallback(async () => {
        if (!supabase) { setError("Supabase не инициализирован."); setIsLoadingTickets(false); return; }
        setIsLoadingTickets(true); setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('admin_support_tickets')
                .select('*')
                .eq('user_id', user.id)
                .order('last_message_at', { ascending: false, nullsFirst: false })
                .order('created_at', { ascending: false });
            if (fetchError) throw fetchError;
            setTickets(data || []);
        } catch (err: any) { setError("Ошибка загрузки ваших обращений: " + err.message); }
        finally { setIsLoadingTickets(false); }
    }, [user.id]);

    useEffect(() => { fetchMyTickets(); }, [fetchMyTickets]);

    const fetchTicketMessages = useCallback(async (ticketId: string) => {
        if (!supabase) { setError("Supabase не инициализирован."); return; }
        setIsLoadingMessages(true); setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('admin_chat_messages')
                .select('*')
                .eq('ticket_id', ticketId)
                .order('created_at', { ascending: true });
            if (fetchError) throw fetchError;
            setMessages(data || []);
        } catch (err: any) { setError("Ошибка загрузки сообщений: " + err.message); }
        finally { setIsLoadingMessages(false); }
    }, []);

    useEffect(() => {
        if (activeTicket) {
            fetchTicketMessages(activeTicket.id);
            if (activeTicket.user_has_unread && supabase) {
                supabase.from('admin_support_tickets').update({ user_has_unread: false }).eq('id', activeTicket.id)
                .then(({ error: updateError}) => {
                    if (!updateError) {
                         setTickets(prev => prev.map(t => t.id === activeTicket.id ? {...t, user_has_unread: false} : t));
                         setActiveTicket(prev => prev ? {...prev, user_has_unread: false} : null);
                    } else {
                        console.error("Error marking ticket as read:", updateError);
                    }
                });
            }
        } else {
            setMessages([]);
        }
    }, [activeTicket, fetchTicketMessages, supabase]);
    
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const handleSelectTicket = (ticket: AdminSupportTicket) => {
        setActiveTicket(ticket);
        if(isMobile) setMobileSidebarOpen(false);
    };

    const handleOpenNewTicketModal = () => {
        setIsNewTicketModalOpen(true);
    };

    const handleSaveNewTicketSubject = async (subject: string) => {
        setIsNewTicketModalOpen(false);
        if (!supabase) { setError("Supabase не инициализирован."); return; }
        setIsSending(true); setError(null);
        
        const finalSubject = subject.trim() || "Новое обращение";

        try {
            const { data, error: insertError } = await supabase
                .from('admin_support_tickets')
                .insert({ 
                    user_id: user.id, 
                    user_viht_id: user.user_metadata.user_viht_id,
                    user_display_name: user.user_metadata.display_name,
                    status: 'open', 
                    subject: finalSubject,
                    admin_has_unread: true, 
                })
                .select()
                .single();

            if (insertError) throw insertError;

            if (data) {
                setTickets(prev => [data as AdminSupportTicket, ...prev]);
                setActiveTicket(data as AdminSupportTicket);
                showToast(`Обращение "${finalSubject}" успешно создано!`, 'success');

                const newSupportTicketsCreated = (user.user_metadata.support_tickets_created || 0) + 1;
                await onUserProfileUpdate({
                    support_tickets_created: newSupportTicketsCreated
                });
            }
            if(isMobile) setMobileSidebarOpen(false);
        } catch (err: any) { 
            setError("Ошибка создания тикета: " + err.message); 
            showToast("Ошибка создания тикета: " + err.message, 'error');
        }
        finally { setIsSending(false); }
    };
    
    const handleSendMessage = async () => {
        if (!supabase || !activeTicket || !newMessage.trim()) { 
            setError("Сообщение не может быть пустым."); 
            return; 
        }
        setIsSending(true); setError(null);

        try {
            const { data, error: insertError } = await supabase
                .from('admin_chat_messages')
                .insert({
                    ticket_id: activeTicket.id,
                    sender_id: user.id,
                    sender_role: 'user',
                    message_text: newMessage.trim() || null,
                })
                .select()
                .single();

            if (insertError) throw insertError;
            if (data) {
                 setMessages(prev => [...prev, data as AdminChatMessage]);
                 setTickets(prevTickets => prevTickets.map(t => {
                    if (activeTicket && t.id === activeTicket.id) {
                        const newStatus: AdminSupportTicket['status'] = activeTicket.status === 'closed' ? 'closed' : 'pending_admin';
                        const updatedTicket: AdminSupportTicket = {
                            ...t,
                            last_message_at: data.created_at,
                            last_message_snippet: data.message_text?.substring(0,50) || "[Сообщение]",
                            admin_has_unread: true,
                            updated_at: new Date().toISOString(),
                            last_message_sender_role: 'user',
                            status: newStatus,
                        };
                        return updatedTicket;
                    }
                    return t;
                 }).sort((a, b) => new Date(b.last_message_at || b.created_at).getTime() - new Date(a.last_message_at || a.created_at).getTime()));
                 
                 if(activeTicket.status !== 'closed') {
                    setActiveTicket(prev => prev ? {...prev, status: 'pending_admin'} : null);
                 }
            }
            setNewMessage('');
           
        } catch (err: any) { setError("Ошибка отправки сообщения: " + err.message); }
        finally { setIsSending(false); }
    };

    const ticketsSidebarContent = (
      <Box 
          className="chat-sessions-sidebar support-tickets-sidebar"
          sx={{
              width: isMobile ? '100%' : 'var(--help-chat-sidebar-width)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRight: isMobile ? 'none' : `1px solid ${theme.palette.divider}`,
              bgcolor: 'background.paper'
          }}
      >
          <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: '15px 18px 10px 18px', borderBottom: `1px solid ${theme.palette.divider}`}}>
              <Typography variant="h6" component="h3">Ваши обращения</Typography>
              {isMobile && <IconButton onClick={() => setMobileSidebarOpen(false)}><CloseIcon /></IconButton>}
          </Box>
          <Button 
              onClick={handleOpenNewTicketModal} 
              className="new-chat-button" 
              startIcon={<AddCircleOutlineIcon />}
              sx={{ m: '15px', textTransform: 'none' }}
              disabled={isSending || isLoadingTickets}
          >
              Новое обращение
          </Button>
          {isLoadingTickets && <Box sx={{p:2, textAlign:'center'}}><CircularProgress size={24} /><Typography variant="caption" display="block">Загрузка...</Typography></Box>}
          {error && !isLoadingTickets && tickets.length === 0 && <Alert severity="error" sx={{m:1}}>{error}</Alert>}
          {!isLoadingTickets && tickets.length === 0 && <Typography sx={{p:2, textAlign:'center'}}>У вас пока нет обращений.</Typography>}
          <List className="chat-sessions-list" sx={{flexGrow: 1, overflowY: 'auto', p:1}}>
              {tickets.map(ticket => (
                  <ListItem key={ticket.id} disablePadding sx={{mb: 0.5}}>
                      <ListItemButton 
                          className="chat-session-button" 
                          onClick={() => handleSelectTicket(ticket)} 
                          selected={activeTicket?.id === ticket.id}
                          title={ticket.subject || `Тикет #${ticket.id.substring(0,8)}`}
                          sx={{
                            borderRadius: 'var(--border-radius-small)',
                            '&.Mui-selected': {bgcolor: 'action.selected'},
                            flexDirection: 'column', alignItems: 'flex-start'
                          }}
                      >
                          <Box sx={{display:'flex', alignItems:'center', width:'100%'}}>
                            <span className={`ticket-status-indicator ${ticket.status}`} style={{marginRight: '8px'}}></span>
                            <ListItemText 
                                primary={ticket.subject || `Обращение #${ticket.id.substring(0,8)}...`} 
                                secondary={formatDate(ticket.last_message_at || ticket.created_at, true)} 
                                primaryTypographyProps={{fontWeight: 500, noWrap: true}}
                                secondaryTypographyProps={{fontSize: '0.8em'}}
                                sx={{flexGrow:1, mr:1}}
                            />
                            {ticket.user_has_unread && <Chip label="!" color="warning" size="small" sx={{ml:'auto', height: '18px', fontSize: '0.7rem'}} title="Новый ответ"/>}
                          </Box>
                      </ListItemButton>
                  </ListItem>
              ))}
          </List>
      </Box>
    );


    return (
        <Box className="help-chat-section vk-style" sx={{ display: 'flex', height: '100%', position: 'relative', overflow: isMobile ? 'hidden' : 'visible' }}>
            <NameInputModal
                isOpen={isNewTicketModalOpen}
                onClose={() => setIsNewTicketModalOpen(false)}
                onSave={handleSaveNewTicketSubject}
                title="Новое обращение в поддержку"
                label="Тема обращения"
                placeholder="Кратко опишите вашу проблему"
                isLoading={isSending}
            />
            {isMobile ? (
                <Drawer
                    anchor="left"
                    open={mobileSidebarOpen}
                    onClose={() => setMobileSidebarOpen(false)}
                    variant="temporary"
                    ModalProps={{ keepMounted: true }}
                    PaperProps={{ sx: { width: '80%', maxWidth: '320px' } }}
                >
                    {ticketsSidebarContent}
                </Drawer>
            ) : (
                ticketsSidebarContent
            )}

            <Box className="chat-main-area support-chat-main-area" sx={{flexGrow: 1, display: 'flex', flexDirection: 'column'}}>
                {!activeTicket && !isLoadingTickets && (
                    <Box className="no-active-ticket-placeholder" sx={{textAlign: 'center', p: {xs:2, sm:5}, m:'auto'}}>
                        <Typography variant={isMobile ? "h6" : "h5"} component="h2" gutterBottom>Центр Помощи {APP_NAME}</Typography>
                        <Typography>Выберите обращение из списка {isMobile ? ' (нажмите ☰)' : 'слева'} или создайте новое.</Typography>
                        <Typography>Мы постараемся ответить вам как можно скорее!</Typography>
                         {error && <Alert severity="error" sx={{mt:2}}>{error}</Alert>}
                          {isMobile && (
                            <Button
                                variant="contained"
                                startIcon={<MenuIcon />}
                                onClick={() => setMobileSidebarOpen(true)}
                                sx={{ mt: 2 }}
                            >
                                Мои обращения
                            </Button>
                        )}
                    </Box>
                )}
                {activeTicket && (
                    <>
                        <Paper square elevation={0} className="chat-header" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: isMobile ? '8px 12px' : 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                            <Box sx={{display: 'flex', alignItems: 'center', overflow:'hidden'}}>
                                {isMobile && (
                                    <IconButton
                                        color="inherit"
                                        aria-label="Открыть список тикетов"
                                        edge="start"
                                        onClick={() => setMobileSidebarOpen(true)}
                                        className="mobile-chat-header-button"
                                        sx={{ mr: 1 }}
                                    >
                                        <MenuIcon />
                                    </IconButton>
                                )}
                                <Box sx={{overflow:'hidden'}}>
                                    <Typography variant={isMobile ? "subtitle1" : "h6"} component="h2" className="chat-page-title" noWrap title={activeTicket.subject || `Обращение...`}>
                                        {activeTicket.subject || `Обращение #${activeTicket.id.substring(0,8)}...`}
                                    </Typography>
                                    {!isMobile && <Typography variant="caption">Статус: {activeTicket.status}</Typography>}
                                </Box>
                            </Box>
                             {/* Mobile could have a "..." menu for actions */}
                        </Paper>
                        <Box className="chat-messages-container support-messages-container" role="log" sx={{flexGrow:1, overflowY: 'auto', p: isMobile ? '12px' : 2, bgcolor: 'background.default'}}>
                             {activeTicket.status === 'closed' && (
                                <Alert severity="info" sx={{m:1, borderRadius:'var(--border-radius)'}}>
                                    Это обращение закрыто. Если у вас остались вопросы, пожалуйста, создайте новое обращение.
                                </Alert>
                            )}
                            {isLoadingMessages && <Box sx={{textAlign:'center', p:2}}><CircularProgress size={24}/></Box>}
                            {messages.map(msg => (
                                <div key={msg.id} className={`message-bubble-wrapper ${msg.sender_role}`}>
                                    <div className={`message-bubble ${msg.sender_role}`}>
                                        {msg.sender_role === 'admin' && <span className="message-sender-name">Администратор</span>}
                                        {msg.message_text && 
                                          <ReactMarkdown 
                                            children={msg.message_text} 
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                code: ({node, inline, className, children, ...props}: CustomCodeProps) => {
                                                    const match = /language-(\w+)/.exec(className || '');
                                                    const codeContent = String(children).replace(/\n$/, '');
                                                    return !inline && match ? (
                                                    <CodeBlock language={match[1]}>{codeContent}</CodeBlock>
                                                    ) : (
                                                    <code className={className} {...props}>{children}</code>
                                                    );
                                                }
                                            }}
                                          />
                                        }
                                        <span className="message-timestamp">{formatDate(msg.created_at, true)}</span>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </Box>
                        {error && <Alert severity="error" sx={{m:1}}>{error}</Alert>}
                        {activeTicket.status !== 'closed' && (
                            <Paper square elevation={0} className="chat-input-area support-input-area" role="form" sx={{p: '10px 15px', borderTop: `1px solid ${theme.palette.divider}`, display:'flex', alignItems:'flex-end'}}>
                                <TextField 
                                    fullWidth multiline maxRows={4} variant="outlined"
                                    value={newMessage} 
                                    onChange={(e) => setNewMessage(e.target.value)} 
                                    placeholder="Введите ваше сообщение..." 
                                    disabled={isSending} 
                                    sx={{ mr: 1, '& .MuiOutlinedInput-root': { borderRadius: '22px', '& fieldset': {border: 'none'}, '&.Mui-focused fieldset': {border: theme=> `1px solid ${theme.palette.primary.main}`} }, input: {py: '12px'} }}
                                />
                                <IconButton color="primary" onClick={handleSendMessage} disabled={isSending || !newMessage.trim()} aria-label="Отправить" sx={{width: '48px', height: '48px'}}>
                                    {isSending ? <CircularProgress size={24} color="inherit"/> : <SendIcon />}
                                </IconButton>
                            </Paper>
                        )}
                    </>
                )}
            </Box>
        </Box>
    );
};