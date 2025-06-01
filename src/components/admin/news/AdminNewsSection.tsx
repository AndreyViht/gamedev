
import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, NewsItemDB } from '../../../types';
import { supabase } from '../../../api/clients';
import { NewsEditorModal } from './NewsEditorModal';

interface AdminNewsSectionProps {
    user: UserProfile | null;
    onDataChange?: () => Promise<void>;
}

export const AdminNewsSection: React.FC<AdminNewsSectionProps> = ({ user, onDataChange }) => {
    const [newsList, setNewsList] = useState<NewsItemDB[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNewsItem, setEditingNewsItem] = useState<NewsItemDB | null>(null);

    const fetchNews = useCallback(async () => {
        if (!supabase) {
            setError("Supabase не инициализирован.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('news_articles')
                .select('*')
                .order('created_at', { ascending: false });
            if (fetchError) throw fetchError;
            setNewsList(data || []);
        } catch (err: any) {
            setError(err.message || "Ошибка загрузки новостей.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNews();
    }, [fetchNews]);

    const handleOpenModal = (newsItem: NewsItemDB | null = null) => {
        setEditingNewsItem(newsItem);
        setIsModalOpen(true);
    };

    const handleSaveNews = async (newsDataToSave: Partial<NewsItemDB>) => {
        if (!supabase || !user) {
            throw new Error("Supabase или пользователь не инициализированы.");
        }
        
        let operationError = null;
        const dataWithUserId = { 
            ...newsDataToSave, 
            user_id: editingNewsItem?.user_id || user.id 
        };


        if (editingNewsItem?.id) { 
            const { error: updateError } = await supabase
                .from('news_articles')
                .update(dataWithUserId) 
                .eq('id', editingNewsItem.id);
            operationError = updateError;
        } else { 
             if (!dataWithUserId.user_id) dataWithUserId.user_id = user.id; 
            const { error: insertError } = await supabase
                .from('news_articles')
                .insert([dataWithUserId]); 
            operationError = insertError;
        }

        if (operationError) {
            throw operationError;
        }
        await fetchNews(); 
        if (onDataChange) await onDataChange(); 
    };
    
    const handleDeleteNews = async (newsId: string) => {
        if (!supabase) {
            setError("Supabase не инициализирован.");
            return;
        }
        if (!window.confirm("Вы уверены, что хотите удалить эту новость?")) return;
        setIsLoading(true);
        try {
            const { error: deleteError } = await supabase.from('news_articles').delete().eq('id', newsId);
            if (deleteError) throw deleteError;
            await fetchNews(); 
            if (onDataChange) await onDataChange();
        } catch (err: any) {
            setError(err.message || "Ошибка удаления новости.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <div className="admin-section-header">
                <h2 id="admin-content-title" className="sub-page-title">Управление Новостями</h2>
                <button onClick={() => handleOpenModal(null)} className="admin-add-button primary-button">Добавить новость</button>
            </div>
            {isLoading && <div className="loading-indicator">Загрузка новостей... <div className="spinner"></div></div>}
            {error && <p className="error-message" role="alert">{error}</p>}
            {!isLoading && !error && newsList.length === 0 && <p>Новостей пока нет. Добавьте первую!</p>}
            {!isLoading && !error && newsList.length > 0 && (
                <ul className="admin-item-list news-item-list">
                    {newsList.map(item => (
                        <li key={item.id} className="admin-item news-item">
                            <div className="admin-item-info">
                                <h3>{item.title}</h3>
                                <p>Статус: {item.is_published ? 'Опубликовано' : 'Черновик'}</p>
                                <p>Дата: {new Date(item.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="admin-item-actions">
                                <button onClick={() => handleOpenModal(item)} className="admin-action-button edit-button">Редактировать</button>
                                <button onClick={() => handleDeleteNews(item.id)} className="admin-action-button delete-button">Удалить</button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <NewsEditorModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveNews}
                newsItem={editingNewsItem}
                currentUserId={user?.id}
            />
        </div>
    );
};
