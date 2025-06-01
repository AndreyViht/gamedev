
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { UserProfile, AdminSupportTicket, AdminChatMessage } from '../../../types';
import { supabase } from '../../../api/clients';
import { formatDate } from '../../../utils/helpers';
import { APP_NAME } from '../../../config/constants';
import { CodeBlock } from '../../common/CodeBlock';

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

    const fetchAllTickets = useCallback(async () => {
        if (!supabase) { setError("Supabase не инициализирован."); setIsLoadingTickets(false); return; }
        setIsLoadingTickets(true); setError(null);
        try {
            let query = supabase.from('admin_support_tickets').select('*');
            if (filterStatus !== 'all') {
                query = query.eq('status', filterStatus);
            }
            // For 'all' or any other active filter, we might want to hide very old 'closed' tickets
            // However, without a reliable 'deleted_at' or similar, this is complex client-side.
            // The current sorting prioritizes unread by admin, then most recent.
            query = query.order('admin_has_unread', { ascending: false }) 
                         .order('last_message_at', { ascending: false, nullsFirst: false }) // tickets with recent messages first
                         .order('updated_at', { ascending: false }); // then by overall update time

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

    const handleSelectTicket = (ticket: AdminSupportTicket) => setActiveTicket(ticket);


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
                user_has_unread: true, // Notify user of new admin message
                admin_has_unread: false, // Admin just sent it, so it's read for admin
                status: activeTicket.status === 'closed' ? 'closed' : 'pending_user', // If admin replies, it's now pending user
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
            // Refetch or smartly update list
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
            // It's generally better to use an RPC function for cascading deletes or ensure RLS allows this.
            // For simplicity, deleting messages first, then ticket.
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
    
    return (
        <div className="admin-support-section vk-style"> {/* Apply vk-style for consistent layout */}
            <aside className="chat-sessions-sidebar support-tickets-sidebar">
                <h3>Обращения Пользователей</h3>
                 <div className="form-group">
                    <label htmlFor="ticket-status-filter">Фильтр статуса:</label>
                    <select 
                        id="ticket-status-filter" 
                        value={filterStatus} 
                        onChange={(e) => setFilterStatus(e.target.value as TicketStatusFilter)}
                        disabled={isLoadingTickets || isProcessing}
                    >
                        {filterOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                {isLoadingTickets && <div className="loading-indicator small" style={{padding: '10px'}}><div className="spinner"></div>Загрузка обращений...</div>}
                {error && !isLoadingTickets && allTickets.length === 0 && <p className="error-message" style={{padding: '10px'}}>{error}</p>}
                {!isLoadingTickets && allTickets.length === 0 && <p style={{padding: '10px'}}>Нет обращений по текущему фильтру.</p>}
                <ul className="chat-sessions-list">
                    {allTickets.map(ticket => (
                        <li key={ticket.id} className={activeTicket?.id === ticket.id ? 'active' : ''}>
                            <button 
                                className="chat-session-button chat-interactive-button" 
                                onClick={() => handleSelectTicket(ticket)} 
                                title={`${ticket.subject || 'Тикет'} от ${ticket.user_display_name || ticket.user_viht_id || 'Пользователь'}`}
                            >
                                <span className={`ticket-status-indicator ${ticket.status}`}></span>
                                <span className="ticket-subject">
                                    {ticket.subject || `Обращение #${ticket.id.substring(0,6)}...`}
                                     <small style={{display: 'block', opacity: 0.7}}>
                                        От: {ticket.user_display_name || ticket.user_viht_id || 'N/A'}
                                     </small>
                                </span>
                                <span className="ticket-date">{formatDate(ticket.last_message_at || ticket.updated_at, true)}</span>
                                {ticket.admin_has_unread && <span className="unread-indicator user-unread" title="Новое сообщение от пользователя">!</span>}
                            </button>
                        </li>
                    ))}
                </ul>
            </aside>

            <div className="chat-main-area support-chat-main-area">
                {!activeTicket && !isLoadingTickets && (
                    <div className="no-active-ticket-placeholder">
                        <h2>Панель Поддержки {APP_NAME}</h2>
                        <p>Выберите обращение из списка слева для просмотра и ответа.</p>
                         {error && <p className="error-message">{error}</p>}
                    </div>
                )}
                {activeTicket && (
                    <>
                        <header className="chat-header" style={{alignItems: 'flex-start', flexDirection: 'column', gap: '5px'}}>
                            <div>
                                <h2 className="sub-page-title chat-page-title" style={{fontSize: '1.4em', marginBottom: '5px'}}>
                                    {activeTicket.subject || `Обращение #${activeTicket.id.substring(0,6)}`}
                                </h2>
                                <p style={{fontSize:'0.8em', color:'var(--subtle-text-color)', margin: '0 0 5px 0'}}>
                                    Пользователь: {activeTicket.user_display_name || activeTicket.user_viht_id || 'N/A'} (ID: {activeTicket.user_id.substring(0,8)}...)
                                </p>
                                 <p style={{fontSize:'0.8em', color:'var(--subtle-text-color)', margin: '0'}}>
                                    Статус: <strong>{activeTicket.status}</strong>
                                </p>
                            </div>
                            <div className="chat-controls" style={{width: '100%', justifyContent: 'flex-start', marginTop: '5px', flexWrap: 'wrap'}}>
                                {activeTicket.status !== 'closed' && (
                                    <button 
                                        onClick={() => handleChangeTicketStatus(activeTicket.id, 'closed')} 
                                        className="modal-button secondary" 
                                        disabled={isProcessing}
                                        style={{padding: '6px 10px', fontSize: '0.85em'}}
                                    >
                                        Закрыть обращение
                                    </button>
                                )}
                                {activeTicket.status === 'closed' && (
                                    <button 
                                        onClick={() => handleChangeTicketStatus(activeTicket.id, 'pending_admin')} 
                                        className="modal-button tertiary" 
                                        disabled={isProcessing}
                                        style={{padding: '6px 10px', fontSize: '0.85em'}}
                                    >
                                        Переоткрыть (Админ)
                                    </button>
                                )}
                                 <button 
                                    onClick={() => handleDeleteTicket(activeTicket.id)} 
                                    className="modal-button tertiary" 
                                    style={{backgroundColor: 'var(--error-color)', color: 'white', padding: '6px 10px', fontSize: '0.85em', marginLeft: 'auto'}}
                                    disabled={isProcessing}
                                >
                                    Удалить тикет
                                </button>
                            </div>
                        </header>
                        <div className="chat-messages-container support-messages-container" role="log">
                            {isLoadingMessages && <div className="loading-indicator"><div className="spinner"></div>Загрузка сообщений...</div>}
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
                        </div>
                        {error && <p className="error-message chat-error">{error}</p>}
                        {activeTicket.status !== 'closed' ? (
                            <div className="chat-input-area support-input-area" role="form">
                                <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Введите ваш ответ..." rows={1} disabled={isProcessing} aria-multiline="true" />
                                <button onClick={handleSendMessage} disabled={isProcessing || !newMessage.trim()} className="chat-send-button chat-interactive-button" aria-label="Отправить">
                                    <span className="send-button-icon">{isProcessing ? <div className="spinner small"></div> : '➤'}</span>
                                </button>
                            </div>
                        ) : (
                            <p className="info-message chat-info ticket-closed-message" style={{textAlign: 'center'}}>Это обращение закрыто.</p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
