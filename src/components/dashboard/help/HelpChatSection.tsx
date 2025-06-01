
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { UserProfile, AdminSupportTicket, AdminChatMessage } from '../../../types';
import { supabase } from '../../../api/clients';
import { formatDate } from '../../../utils/helpers';
import { APP_NAME } from '../../../config/constants';
import { NameInputModal } from '../../common/NameInputModal'; 
import { CodeBlock } from '../../common/CodeBlock'; // Import CodeBlock

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
            
            // Filter out very old closed tickets if they don't have a specific deletion timestamp
            // For now, just sort, the "deleted in 1 hour" message will be shown for closed tickets.
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

    const handleSelectTicket = (ticket: AdminSupportTicket) => setActiveTicket(ticket);

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


    return (
        <div className="help-chat-section vk-style"> {/* Ensure vk-style is applied for layout */}
            <NameInputModal
                isOpen={isNewTicketModalOpen}
                onClose={() => setIsNewTicketModalOpen(false)}
                onSave={handleSaveNewTicketSubject}
                title="Новое обращение в поддержку"
                label="Тема обращения"
                placeholder="Кратко опишите вашу проблему"
                isLoading={isSending}
            />
            <aside className="chat-sessions-sidebar support-tickets-sidebar">
                <h3>Ваши обращения</h3>
                <button onClick={handleOpenNewTicketModal} className="new-chat-button chat-interactive-button" disabled={isSending || isLoadingTickets}>
                    + Новое обращение
                </button>
                {isLoadingTickets && <div className="loading-indicator small" style={{padding: '10px'}}><div className="spinner"></div>Загрузка...</div>}
                {error && !isLoadingTickets && tickets.length === 0 && <p className="error-message" style={{padding: '10px'}}>{error}</p>}
                {!isLoadingTickets && tickets.length === 0 && <p style={{padding: '10px'}}>У вас пока нет обращений.</p>}
                <ul className="chat-sessions-list">
                    {tickets.map(ticket => (
                        <li key={ticket.id} className={activeTicket?.id === ticket.id ? 'active' : ''}>
                            <button className="chat-session-button chat-interactive-button" onClick={() => handleSelectTicket(ticket)} title={ticket.subject || `Тикет #${ticket.id.substring(0,8)}`}>
                                <span className={`ticket-status-indicator ${ticket.status}`}></span>
                                <span className="ticket-subject">{ticket.subject || `Обращение #${ticket.id.substring(0,8)}...`}</span>
                                <span className="ticket-date">{formatDate(ticket.last_message_at || ticket.created_at, true)}</span>
                                {ticket.user_has_unread && <span className="unread-indicator user-unread" title="Новый ответ от администратора">!</span>}
                            </button>
                        </li>
                    ))}
                </ul>
            </aside>

            <div className="chat-main-area support-chat-main-area">
                {!activeTicket && !isLoadingTickets && (
                    <div className="no-active-ticket-placeholder">
                        <h2>Центр Помощи {APP_NAME}</h2>
                        <p>Выберите обращение из списка слева или создайте новое.</p>
                        <p>Мы постараемся ответить вам как можно скорее!</p>
                         {error && <p className="error-message">{error}</p>}
                    </div>
                )}
                {activeTicket && (
                    <>
                        <header className="chat-header">
                            <h2 className="sub-page-title chat-page-title">
                                {activeTicket.subject || `Обращение #${activeTicket.id.substring(0,8)}...`} (Статус: {activeTicket.status})
                            </h2>
                        </header>
                        <div className="chat-messages-container support-messages-container" role="log">
                             {activeTicket.status === 'closed' && (
                                <p className="ticket-closed-message">
                                    Это обращение закрыто. Если у вас остались вопросы, пожалуйста, создайте новое обращение.
                                </p>
                            )}
                            {isLoadingMessages && <div className="loading-indicator"><div className="spinner"></div>Загрузка сообщений...</div>}
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
                        </div>
                        {error && <p className="error-message chat-error">{error}</p>}
                        {activeTicket.status !== 'closed' && (
                            <div className="chat-input-area support-input-area" role="form">
                                <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Введите ваше сообщение..." rows={1} disabled={isSending} aria-multiline="true" />
                                <button onClick={handleSendMessage} disabled={isSending || !newMessage.trim()} className="chat-send-button chat-interactive-button" aria-label="Отправить">
                                    <span className="send-button-icon">{isSending ? <div className="spinner small"></div> : '➤'}</span>
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
