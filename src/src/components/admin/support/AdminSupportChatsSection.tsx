

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { UserProfile, AdminSupportTicket, AdminChatMessage } from '../../../types';
import { supabase } from '../../../api/clients';
import { formatDate } from '../../../utils/helpers';
import { APP_NAME } from '../../../config/constants';
import { CodeBlock } from '../../common/CodeBlock';

import { Box, TextField, Button, IconButton, Typography, Paper, List, ListItem, ListItemButton, ListItemText, CircularProgress, Alert, useMediaQuery, Fab, Drawer, Select, MenuItem, FormControl, InputLabel, Chip } from '@mui/material';
import { useTheme, Theme } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings'; // Example for future actions
import MoreVertIcon from '@mui/icons-material/MoreVert';


type TicketStatusFilter = 'all' | 'open' | 'pending_admin' | 'pending_user' | 'closed';

interface AdminSupportChatsSectionProps {
    currentUser: UserProfile | null;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type AdminCustomCodeProps = React.ComponentPropsWithoutRef<'code'> & {
  node?: any; 
  inline?: boolean;
  children: React.ReactNode;
};


export const AdminSupportChatsSection: React.FC<AdminSupportChatsSectionProps> = ({ currentUser, showToast }) => {
    const [allTickets, setAllTickets] = useState<AdminSupportTicket[]>([]);
    const [activeTicket, setActiveTicket] = useState<AdminSupportTicket | null>(null);
    const [messages, setMessages] = useState<AdminChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    
    const [isLoadingTickets, setIsLoadingTickets] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false); 
    const [error, setError] = useState<string | null>(null);
    
    const [filterStatus, setFilterStatus] = useState<TicketStatusFilter>('pending_admin');
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const theme = useTheme<Theme>();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    const fetchAllTickets = useCallback(async () => {
        if (!supabase) { setError("Supabase не инициализирован."); setIsLoadingTickets(false); return; }
        setIsLoadingTickets(true); setError(null);
        try {
            let query = supabase.from('admin_support_tickets').select('*');
            if (filterStatus !== 'all') {
                query = query.eq('status', filterStatus);
            }
            query = query.order('admin_has_unread', { ascending: false }) 
                         .order('last_message_at', { ascending: false, nullsFirst: false }) 
                         .order('updated_at', { ascending: false });

            const { data, error: fetchError } = await query;
            if (fetchError) throw fetchError;
            setAllTickets(data || []);
        } catch (err: any) { setError("Ошибка загрузки обращений: " + err.message); }
        finally { setIsLoadingTickets(false); }
    }, [filterStatus]);

    useEffect(() => { fetchAllTickets(); }, [fetchAllTickets]);

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
            if (activeTicket.admin_has_unread && supabase) {
                supabase.from('admin_support_tickets').update({ admin_has_unread: false }).eq('id', activeTicket.id)
                .then(({ error: updateError}) => {
                    if (!updateError) {
                         setAllTickets(prev => prev.map(t => t.id === activeTicket.id ? {...t, admin_has_unread: false} : t));
                         setActiveTicket(prev => prev ? {...prev, admin_has_unread: false} : null); 
                    } else {
                        console.error("Error marking admin ticket as read by admin:", updateError)
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


    const handleSendMessage = async () => {
        if (!supabase || !activeTicket || !currentUser || !newMessage.trim()) { 
            setError("Сообщение не может быть пустым."); 
            return; 
        }
        setIsProcessing(true); setError(null);

        try {
            const { data: newMsgData, error: insertMsgError } = await supabase
                .from('admin_chat_messages')
                .insert({
                    ticket_id: activeTicket.id,
                    sender_id: currentUser.id,
                    sender_role: 'admin',
                    message_text: newMessage.trim() || null,
                })
                .select()
                .single();

            if (insertMsgError) throw insertMsgError;

            if (newMsgData) {
                 setMessages(prev => [...prev, newMsgData as AdminChatMessage]);
            }
            setNewMessage('');

            const updatedTicketData: Partial<AdminSupportTicket> = {
                last_message_at: newMsgData.created_at,
                last_message_snippet: newMsgData.message_text?.substring(0,50) || "[Сообщение от админа]", 
                last_message_sender_role: 'admin',
                user_has_unread: true, 
                admin_has_unread: false, 
                status: activeTicket.status === 'closed' ? 'closed' : 'pending_user', 
                updated_at: new Date().toISOString(),
            };

            const { error: updateTicketError } = await supabase
                .from('admin_support_tickets')
                .update(updatedTicketData)
                .eq('id', activeTicket.id);

            if (updateTicketError) throw updateTicketError;
            
            const updatedActiveTicket = { ...activeTicket, ...updatedTicketData } as AdminSupportTicket;
            setActiveTicket(updatedActiveTicket);
            setAllTickets(prevTickets => prevTickets.map(t => 
                t.id === activeTicket.id ? updatedActiveTicket : t
            ).sort((a, b) => (b.admin_has_unread ? 1 : 0) - (a.admin_has_unread ? 1 : 0) || new Date(b.last_message_at || b.updated_at).getTime() - new Date(a.last_message_at || a.updated_at).getTime()));

        } catch (err: any) { setError("Ошибка отправки сообщения: " + err.message); }
        finally { setIsProcessing(false); }
    };

    const handleChangeTicketStatus = async (ticketId: string, newStatus: AdminSupportTicket['status']) => {
        if (!supabase) { setError("Supabase не инициализирован."); return; }
        if (!window.confirm(`Вы уверены, что хотите изменить статус тикета на "${newStatus}"?`)) return;
        
        setIsProcessing(true); 
        setError(null);
        try {
            const updatePayload: Partial<AdminSupportTicket> = { status: newStatus, updated_at: new Date().toISOString() };
            if (newStatus === 'closed' && activeTicket?.id === ticketId) {
                updatePayload.user_has_unread = false; 
                updatePayload.admin_has_unread = false;
            }

            const { error: updateError } = await supabase
                .from('admin_support_tickets')
                .update(updatePayload)
                .eq('id', ticketId);
            if (updateError) throw updateError;

            const updatedTicket = { ...(allTickets.find(t=>t.id === ticketId) || activeTicket), ...updatePayload } as AdminSupportTicket;

            if(activeTicket?.id === ticketId) {
                setActiveTicket(updatedTicket);
            }
            setAllTickets(prev => prev.map(t => t.id === ticketId ? updatedTicket : t).filter(t => filterStatus === 'all' || t.status === filterStatus));
            showToast(`Статус тикета изменен на "${newStatus}".`, 'success');

            if (newStatus === 'closed') {
                showToast('Обращение закрыто. Оно будет автоматически удалено через некоторое время (зависит от настроек сервера).', 'info');
            }
            
        } catch (err:any) {
            setError("Ошибка изменения статуса тикета: " + err.message);
            showToast("Ошибка изменения статуса: " + err.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleDeleteTicket = async (ticketId: string) => {
        if (!supabase) { setError("Supabase не инициализирован."); return; }
        if (!window.confirm("Вы уверены, что хотите УДАЛИТЬ этот тикет и все его сообщения? Это действие необратимо.")) return;

        setIsProcessing(true);
        setError(null);
        try {
            const { error: msgDeleteError } = await supabase
                .from('admin_chat_messages')
                .delete()
                .eq('ticket_id', ticketId);
            if (msgDeleteError) throw new Error(`Ошибка удаления сообщений тикета: ${msgDeleteError.message}`);

            const { error: ticketDeleteError } = await supabase
                .from('admin_support_tickets')
                .delete()
                .eq('id', ticketId);
            if (ticketDeleteError) throw new Error(`Ошибка удаления тикета: ${ticketDeleteError.message}`);

            showToast("Тикет успешно удален.", 'success');
            setAllTickets(prev => prev.filter(t => t.id !== ticketId));
            if (activeTicket?.id === ticketId) {
                setActiveTicket(null);
                setMessages([]);
            }
        } catch (err: any) {
            setError(err.message);
            showToast(err.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };


    const filterOptions: { value: TicketStatusFilter, label: string }[] = [
        { value: 'pending_admin', label: 'Ждут ответа Админа'},
        { value: 'open', label: 'Открытые (новые)'},
        { value: 'pending_user', label: 'Ждут ответа Пользователя'},
        { value: 'closed', label: 'Закрытые'},
        { value: 'all', label: 'Все тикеты'},
    ];

    const ticketsSidebarContent = (
        <Box 
            className="chat-sessions-sidebar support-tickets-sidebar"
            sx={{
                width: isMobile ? '100%' : 'var(--admin-support-sidebar-width)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRight: isMobile ? 'none' : `1px solid ${theme.palette.divider}`,
                bgcolor: 'background.paper'
            }}
        >
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: '15px 18px 10px 18px', borderBottom: `1px solid ${theme.palette.divider}`}}>
                 <Typography variant="h6" component="h3">Обращения</Typography>
                {isMobile && <IconButton onClick={() => setMobileSidebarOpen(false)}><CloseIcon /></IconButton>}
            </Box>
            <FormControl variant="outlined" sx={{ m: 2, minWidth: 120 }}>
                <InputLabel id="ticket-status-filter-label" sx={{fontSize: '0.9rem'}}>Фильтр</InputLabel>
                <Select
                    labelId="ticket-status-filter-label"
                    id="ticket-status-filter"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as TicketStatusFilter)}
                    label="Фильтр статуса"
                    disabled={isLoadingTickets || isProcessing}
                    size="small"
                    sx={{fontSize: '0.9rem'}}
                >
                    {filterOptions.map(opt => <MenuItem key={opt.value} value={opt.value} sx={{fontSize: '0.9rem'}}>{opt.label}</MenuItem>)}
                </Select>
            </FormControl>
            {isLoadingTickets && <Box sx={{p:2, textAlign:'center'}}><CircularProgress size={24} /><Typography variant="caption" display="block">Загрузка...</Typography></Box>}
            {error && !isLoadingTickets && allTickets.length === 0 && <Alert severity="error" sx={{m:1}}>{error}</Alert>}
            {!isLoadingTickets && allTickets.length === 0 && <Typography sx={{p:2, textAlign:'center'}}>Нет обращений по фильтру.</Typography>}
            <List className="chat-sessions-list" sx={{flexGrow: 1, overflowY: 'auto', p:1}}>
                {allTickets.map(ticket => (
                    <ListItem key={ticket.id} disablePadding sx={{mb: 0.5}}>
                        <ListItemButton 
                            className="chat-session-button" 
                            onClick={() => handleSelectTicket(ticket)} 
                            selected={activeTicket?.id === ticket.id}
                            title={`${ticket.subject || 'Тикет'} от ${ticket.user_display_name || ticket.user_viht_id || 'Пользователь'}`}
                            sx={{
                                borderRadius: 'var(--border-radius-small)',
                                '&.Mui-selected': {bgcolor: 'action.selected'},
                                flexDirection: 'column', alignItems: 'flex-start', p: '10px 12px'
                            }}
                        >
                           <Box sx={{display:'flex', alignItems:'center', width:'100%', mb:0.5}}>
                                <span className={`ticket-status-indicator ${ticket.status}`} style={{marginRight: '8px', flexShrink:0}}></span>
                                <ListItemText 
                                    primary={ticket.subject || `Обращение #${ticket.id.substring(0,6)}...`} 
                                    secondary={`От: ${ticket.user_display_name || ticket.user_viht_id || 'N/A'}`}
                                    primaryTypographyProps={{fontWeight: 500, noWrap: true, fontSize: '0.95rem'}}
                                    secondaryTypographyProps={{fontSize: '0.75rem', noWrap: true, textOverflow: 'ellipsis', overflow: 'hidden'}}
                                    sx={{mr:1, flexGrow:1, overflow:'hidden'}}
                                />
                                {ticket.admin_has_unread && <Chip label="Новое" color="error" size="small" sx={{ml:'auto', height: '18px', fontSize: '0.7rem', fontWeight:'bold'}} title="Новое сообщение"/>}
                            </Box>
                            <Typography variant="caption" sx={{fontSize: '0.7rem', color: 'text.secondary', width:'100%', textAlign:'right'}}>
                                {formatDate(ticket.last_message_at || ticket.updated_at, true)}
                            </Typography>
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Box>
    );
    
    return (
        <Box className="admin-support-section vk-style" sx={{ display: 'flex', height: '100%', position: 'relative', overflow: isMobile ? 'hidden' : 'visible' }}>
             {isMobile ? (
                <Drawer
                    anchor="left"
                    open={mobileSidebarOpen}
                    onClose={() => setMobileSidebarOpen(false)}
                    variant="temporary"
                    ModalProps={{ keepMounted: true }}
                    PaperProps={{ sx: { width: '80%', maxWidth: '340px' } }}
                >
                    {ticketsSidebarContent}
                </Drawer>
            ) : (
                ticketsSidebarContent
            )}

            <Box className="chat-main-area support-chat-main-area" sx={{flexGrow: 1, display: 'flex', flexDirection: 'column'}}>
                {!activeTicket && !isLoadingTickets && (
                    <Box className="no-active-ticket-placeholder" sx={{textAlign: 'center', p: {xs:2, sm:5}, m:'auto'}}>
                        <Typography variant={isMobile ? "h6" : "h5"} component="h2" gutterBottom>Панель Поддержки {APP_NAME}</Typography>
                        <Typography>Выберите обращение из списка {isMobile ? ' (нажмите ☰)' : 'слева'} для просмотра и ответа.</Typography>
                         {error && <Alert severity="error" sx={{mt:2}}>{error}</Alert>}
                         {isMobile && (
                            <Button
                                variant="contained"
                                startIcon={<MenuIcon />}
                                onClick={() => setMobileSidebarOpen(true)}
                                sx={{ mt: 2 }}
                            >
                                Список Обращений
                            </Button>
                        )}
                    </Box>
                )}
                {activeTicket && (
                    <>
                        <Paper square elevation={0} className="chat-header" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: isMobile ? '8px 12px' : 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                            <Box sx={{display: 'flex', alignItems: 'center', overflow:'hidden', flexGrow:1}}>
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
                                <Box sx={{overflow:'hidden', flexGrow:1}}>
                                    <Typography variant={isMobile ? "subtitle1" : "h6"} component="h2" className="chat-page-title" noWrap title={activeTicket.subject || `Обращение...`} sx={{mb:0}}>
                                        {activeTicket.subject || `Обращение #${activeTicket.id.substring(0,6)}`}
                                    </Typography>
                                    <Typography variant="caption" display="block" noWrap title={activeTicket.user_display_name || activeTicket.user_viht_id || 'N/A'}>
                                        Пользователь: {activeTicket.user_display_name || activeTicket.user_viht_id || 'N/A'} (Статус: {activeTicket.status})
                                    </Typography>
                                </Box>
                            </Box>
                            <Box sx={{display: 'flex', alignItems:'center'}}>
                                {activeTicket.status !== 'closed' && (
                                    <Button 
                                        onClick={() => handleChangeTicketStatus(activeTicket.id, 'closed')} 
                                        variant={isMobile ? "outlined" : "contained"}
                                        size="small" 
                                        color="secondary"
                                        disabled={isProcessing}
                                        sx={{textTransform: 'none', mr: isMobile ? 0 : 1, p: isMobile ? '4px 8px' : undefined }}
                                    >
                                        Закрыть
                                    </Button>
                                )}
                                 <IconButton onClick={() => handleDeleteTicket(activeTicket.id)} aria-label="Удалить тикет" disabled={isProcessing} size={isMobile ? "small" : "medium"}>
                                    <DeleteIcon />
                                </IconButton>
                                {/* Add MoreVertIcon for other actions if needed on mobile */}
                            </Box>
                        </Paper>
                        <Box className="chat-messages-container support-messages-container" role="log" sx={{flexGrow:1, overflowY: 'auto', p: isMobile ? '12px' : 2, bgcolor: 'background.default'}}>
                            {isLoadingMessages && <Box sx={{textAlign:'center', p:2}}><CircularProgress size={24}/></Box>}
                            {messages.map(msg => (
                                <div key={msg.id} className={`message-bubble-wrapper ${msg.sender_role}`}>
                                    <div className={`message-bubble ${msg.sender_role}`}>
                                        {msg.sender_role === 'admin' && <span className="message-sender-name">{currentUser?.user_metadata.display_name || 'Администратор'}</span>}
                                        {msg.sender_role === 'user' && <span className="message-sender-name">{activeTicket?.user_display_name || 'Пользователь'}</span>}
                                        {msg.message_text && 
                                            <ReactMarkdown 
                                                children={msg.message_text} 
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    code: ({node, inline, className, children, ...props}: AdminCustomCodeProps) => {
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
                        {activeTicket.status !== 'closed' ? (
                            <Paper square elevation={0} className="chat-input-area support-input-area" role="form" sx={{p: '10px 15px', borderTop: `1px solid ${theme.palette.divider}`, display:'flex', alignItems:'flex-end'}}>
                                <TextField 
                                    fullWidth multiline maxRows={4} variant="outlined"
                                    value={newMessage} 
                                    onChange={(e) => setNewMessage(e.target.value)} 
                                    placeholder="Введите ваш ответ..." 
                                    disabled={isProcessing} 
                                    sx={{ mr: 1, '& .MuiOutlinedInput-root': { borderRadius: '22px', '& fieldset': {border: 'none'}, '&.Mui-focused fieldset': {border: theme=> `1px solid ${theme.palette.primary.main}`} }, input: {py: '12px'} }}
                                />
                                <IconButton color="primary" onClick={handleSendMessage} disabled={isProcessing || !newMessage.trim()} aria-label="Отправить" sx={{width: '48px', height: '48px'}}>
                                     {isProcessing ? <CircularProgress size={24} color="inherit"/> : <SendIcon />}
                                </IconButton>
                            </Paper>
                        ) : (
                            <Alert severity="info" sx={{m:1, textAlign: 'center', borderRadius: 'var(--border-radius)'}}>Это обращение закрыто.</Alert>
                        )}
                    </>
                )}
            </Box>
        </Box>
    );
};