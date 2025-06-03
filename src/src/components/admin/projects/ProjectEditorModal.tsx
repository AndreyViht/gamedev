
import React, { useState, useEffect, useRef } from 'react';
import { ProjectItemDB } from '../../../types';

interface ProjectEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (projectData: Partial<ProjectItemDB>) => Promise<void>;
    projectItem: ProjectItemDB | null;
    currentUserId: string | undefined;
}

export const ProjectEditorModal: React.FC<ProjectEditorModalProps> = ({ isOpen, onClose, onSave, projectItem, currentUserId }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [status, setStatus] = useState('');
    const [genre, setGenre] = useState('');
    const [projectUrl, setProjectUrl] = useState('');
    const [sourceCodeUrl, setSourceCodeUrl] = useState('');
    const [isPublished, setIsPublished] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (projectItem) {
            setTitle(projectItem.title || '');
            setDescription(projectItem.description || '');
            setImageUrl(projectItem.image_url || '');
            setStatus(projectItem.status || '');
            setGenre(projectItem.genre || '');
            setProjectUrl(projectItem.project_url || '');
            setSourceCodeUrl(projectItem.source_code_url || '');
            setIsPublished(projectItem.is_published !== undefined ? projectItem.is_published : true);
        } else {
            setTitle(''); setDescription(''); setImageUrl(''); setStatus('');
            setGenre(''); setProjectUrl(''); setSourceCodeUrl(''); setIsPublished(true);
        }
        setError('');
    }, [projectItem, isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setError("Заголовок проекта не может быть пустым.");
            return;
        }
        setIsLoading(true);
        setError('');
        const dataToSave: Partial<ProjectItemDB> = {
            title: title.trim(),
            description: description.trim() || null,
            image_url: imageUrl.trim() || null,
            status: status.trim() || null,
            genre: genre.trim() || null,
            project_url: projectUrl.trim() || null,
            source_code_url: sourceCodeUrl.trim() || null,
            is_published: isPublished,
        };
         if (!projectItem?.id) { // If it's a new item
            dataToSave.user_id = currentUserId;
        }
        
        try {
            await onSave(dataToSave);
            onClose();
        } catch (err: any) {
            setError(err.message || "Ошибка сохранения проекта.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content project-editor-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="project-editor-modal-title">
                <h2 id="project-editor-modal-title">{projectItem ? 'Редактировать проект' : 'Добавить проект'}</h2>
                {error && <p className="error-message" role="alert">{error}</p>}
                <form onSubmit={handleSubmit} className="settings-form" noValidate>
                    <div className="form-group">
                        <label htmlFor="project-title">Заголовок:</label>
                        <input type="text" id="project-title" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isLoading} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="project-description">Описание:</label>
                        <textarea id="project-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} disabled={isLoading}></textarea>
                    </div>
                    <div className="form-group">
                        <label htmlFor="project-image-url">URL изображения:</label>
                        <input type="url" id="project-image-url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} disabled={isLoading} placeholder="https://example.com/image.jpg" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="project-status">Статус:</label>
                        <input type="text" id="project-status" value={status} onChange={(e) => setStatus(e.target.value)} disabled={isLoading} placeholder="Напр.: В разработке, Бета, Релиз" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="project-genre">Жанр:</label>
                        <input type="text" id="project-genre" value={genre} onChange={(e) => setGenre(e.target.value)} disabled={isLoading} placeholder="Напр.: RPG, Стратегия, Экшен" />
                    </div>
                     <div className="form-group">
                        <label htmlFor="project-project-url">URL проекта:</label>
                        <input type="url" id="project-project-url" value={projectUrl} onChange={(e) => setProjectUrl(e.target.value)} disabled={isLoading} placeholder="https://example.com/my-project" />
                    </div>
                     <div className="form-group">
                        <label htmlFor="project-source-code-url">URL исходного кода:</label>
                        <input type="url" id="project-source-code-url" value={sourceCodeUrl} onChange={(e) => setSourceCodeUrl(e.target.value)} disabled={isLoading} placeholder="https://github.com/user/repo" />
                    </div>
                    <div className="form-group form-group-checkbox">
                        <input type="checkbox" id="project-is-published" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} disabled={isLoading} />
                        <label htmlFor="project-is-published">Опубликовать</label>
                    </div>
                    <div className="modal-actions">
                        <button type="submit" className="modal-button primary" disabled={isLoading}>{isLoading ? 'Сохранение...' : 'Сохранить'}</button>
                        <button type="button" onClick={onClose} className="modal-button secondary" disabled={isLoading}>Отмена</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
