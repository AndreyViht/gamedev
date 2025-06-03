
import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, ProjectItemDB } from '../../../types';
import { supabase } from '../../../api/clients';
import { ProjectEditorModal } from './ProjectEditorModal';

interface AdminProjectsSectionProps {
    user: UserProfile | null;
    onDataChange?: () => Promise<void>;
}

export const AdminProjectsSection: React.FC<AdminProjectsSectionProps> = ({ user, onDataChange }) => {
    const [projectsList, setProjectsList] = useState<ProjectItemDB[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProjectItem, setEditingProjectItem] = useState<ProjectItemDB | null>(null);

    const fetchProjects = useCallback(async () => {
        if (!supabase) {
            setError("Supabase не инициализирован.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('projects')
                .select('*')
                .order('created_at', { ascending: false });
            if (fetchError) throw fetchError;
            setProjectsList(data || []);
        } catch (err: any) {
            setError(err.message || "Ошибка загрузки проектов.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const handleOpenModal = (projectItem: ProjectItemDB | null = null) => {
        setEditingProjectItem(projectItem);
        setIsModalOpen(true);
    };

    const handleSaveProject = async (projectDataToSave: Partial<ProjectItemDB>) => {
        if (!supabase || !user) {
            throw new Error("Supabase или пользователь не инициализированы.");
        }
        
        let operationError = null;
        const dataWithUserId = { 
            ...projectDataToSave, 
            user_id: editingProjectItem?.user_id || user.id 
        };

        if (editingProjectItem?.id) { 
            const { error: updateError } = await supabase
                .from('projects')
                .update(dataWithUserId)
                .eq('id', editingProjectItem.id);
            operationError = updateError;
        } else { 
            if (!dataWithUserId.user_id) dataWithUserId.user_id = user.id; 
             const { error: insertError } = await supabase
                .from('projects')
                .insert([dataWithUserId]); 
            operationError = insertError;
        }

        if (operationError) {
            throw operationError;
        }
        await fetchProjects(); 
        if (onDataChange) await onDataChange();
    };
    
    const handleDeleteProject = async (projectId: string) => {
        if (!supabase) {
            setError("Supabase не инициализирован.");
            return;
        }
        if (!window.confirm("Вы уверены, что хотите удалить этот проект?")) return;
        setIsLoading(true);
        try {
            const { error: deleteError } = await supabase.from('projects').delete().eq('id', projectId);
            if (deleteError) throw deleteError;
            await fetchProjects(); 
            if (onDataChange) await onDataChange();
        } catch (err: any) {
            setError(err.message || "Ошибка удаления проекта.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <div className="admin-section-header">
                <h2 id="admin-content-title" className="sub-page-title">Управление Проектами</h2>
                <button onClick={() => handleOpenModal(null)} className="admin-add-button primary-button">Добавить проект</button>
            </div>
            {isLoading && <div className="loading-indicator">Загрузка проектов... <div className="spinner"></div></div>}
            {error && <p className="error-message" role="alert">{error}</p>}
            {!isLoading && !error && projectsList.length === 0 && <p>Проектов пока нет. Добавьте первый!</p>}
            {!isLoading && !error && projectsList.length > 0 && (
                <ul className="admin-item-list project-item-list">
                    {projectsList.map(item => (
                        <li key={item.id} className="admin-item project-item">
                            <div className="admin-item-info">
                                <h3>{item.title}</h3>
                                <p>Статус: {item.is_published ? 'Опубликовано' : 'Черновик'} | {item.status || 'N/A'}</p>
                                <p>Жанр: {item.genre || 'N/A'} | Дата: {new Date(item.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="admin-item-actions">
                                <button onClick={() => handleOpenModal(item)} className="admin-action-button edit-button">Редактировать</button>
                                <button onClick={() => handleDeleteProject(item.id)} className="admin-action-button delete-button">Удалить</button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <ProjectEditorModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveProject}
                projectItem={editingProjectItem}
                currentUserId={user?.id}
            />
        </div>
    );
};
