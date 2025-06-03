
import React, { useState, useEffect, useRef } from 'react';
import { NewsItemDB, NewsActionButton, NewsActionButtonClient } from '../../../types';
import { generateClientSideId } from '../../../utils/helpers';

interface NewsEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newsData: Partial<NewsItemDB>) => Promise<void>;
    newsItem: NewsItemDB | null;
    currentUserId: string | undefined;
}

export const NewsEditorModal: React.FC<NewsEditorModalProps> = ({ isOpen, onClose, onSave, newsItem, currentUserId }) => {
    const [title, setTitle] = useState('');
    const [content, setContentState] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isPublished, setIsPublished] = useState(true);
    const [actionButtons, setActionButtons] = useState<NewsActionButtonClient[]>([]);
    const [currentActionButtonText, setCurrentActionButtonText] = useState('');
    const [currentActionButtonUrl, setCurrentActionButtonUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const modalRef = useRef<HTMLDivElement>(null);
    const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (newsItem) {
            setTitle(newsItem.title || '');
            setContentState(newsItem.content || '');
            setImageUrl(newsItem.image_url || '');
            setIsPublished(newsItem.is_published !== undefined ? newsItem.is_published : true);
            setActionButtons(newsItem.action_buttons?.map(ab => ({ ...ab, id: generateClientSideId() })) || []);
        } else {
            setTitle(''); setContentState(''); setImageUrl(''); setIsPublished(true); setActionButtons([]);
        }
        setCurrentActionButtonText(''); setCurrentActionButtonUrl(''); setError('');
    }, [newsItem, isOpen]);

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

    const applyMarkdownSyntax = (syntaxStart: string, syntaxEnd: string = syntaxStart) => {
        const textarea = contentTextareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        const beforeText = textarea.value.substring(0, start);
        const afterText = textarea.value.substring(end);
        const newText = selectedText ? `${syntaxStart}${selectedText}${syntaxEnd}` : `${syntaxStart}${syntaxEnd}`;
        setContentState(beforeText + newText + afterText);
        textarea.focus();
        if (selectedText) {
            textarea.setSelectionRange(start + syntaxStart.length, start + syntaxStart.length + selectedText.length);
        } else {
            textarea.setSelectionRange(start + syntaxStart.length, start + syntaxStart.length);
        }
    };

    const applyListSyntax = () => {
        const textarea = contentTextareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const selectedText = textarea.value.substring(start, textarea.selectionEnd);
        if (selectedText) {
            const newSelectedText = selectedText.split('\n').map(line => line.trim() ? `- ${line}` : line).join('\n');
            setContentState(textarea.value.substring(0, start) + newSelectedText + textarea.value.substring(textarea.selectionEnd));
            textarea.setSelectionRange(start, start + newSelectedText.length);
        } else {
            const currentLineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
            const newText = `${textarea.value.substring(0, currentLineStart)}- ${textarea.value.substring(currentLineStart)}`;
            setContentState(newText);
            setTimeout(() => { textarea.focus(); textarea.setSelectionRange(currentLineStart + 2, currentLineStart + 2); }, 0);
        }
    };
    
    const applyHeadingSyntax = () => {
        const textarea = contentTextareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const currentLineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
        const newText = `${textarea.value.substring(0, currentLineStart)}## ${textarea.value.substring(currentLineStart)}`;
        setContentState(newText);
        setTimeout(() => { textarea.focus(); textarea.setSelectionRange(currentLineStart + 3, currentLineStart + 3); }, 0);
    };

    const insertLinkSyntax = (isButton: boolean) => {
        const promptText = isButton ? "Введите текст для кнопки:" : "Введите текст для ссылки:";
        const defaultText = isButton ? "Текст кнопки" : "Пример текста";
        const linkText = prompt(promptText, defaultText);
        if (!linkText) return;
        const url = prompt("Введите URL (например, https://example.com):", "https://");
        if (!url) return;
        applyMarkdownSyntax(`[${linkText}](${url})`, '');
    };
    
    const handleAddActionButton = () => {
        if (!currentActionButtonText.trim() || !currentActionButtonUrl.trim()) {
            setError("Текст и URL для кнопки действия не могут быть пустыми.");
            return;
        }
        try { // Validate URL (basic check)
            new URL(currentActionButtonUrl.trim());
        } catch (_) {
            setError("URL для кнопки действия недействителен.");
            return;
        }
        setActionButtons(prev => [...prev, { id: generateClientSideId(), text: currentActionButtonText.trim(), url: currentActionButtonUrl.trim() }]);
        setCurrentActionButtonText('');
        setCurrentActionButtonUrl('');
        setError('');
    };

    const handleRemoveActionButton = (idToRemove: string) => {
        setActionButtons(prev => prev.filter(btn => btn.id !== idToRemove));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setError("Заголовок не может быть пустым.");
            return;
        }
        setIsLoading(true);
        setError('');
        const finalActionButtons: NewsActionButton[] = actionButtons.map(({ id, ...rest }) => rest);

        const dataToSave: Partial<NewsItemDB> = {
            title: title.trim(),
            content: content.trim(),
            image_url: imageUrl.trim() || null,
            is_published: isPublished,
            action_buttons: finalActionButtons.length > 0 ? finalActionButtons : null,
        };
        if (!newsItem?.id) { // If it's a new item
            dataToSave.user_id = currentUserId;
        }
        
        try {
            await onSave(dataToSave);
            onClose(); 
        } catch (err: any) {
            setError(err.message || "Ошибка сохранения новости.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content news-editor-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="news-editor-modal-title">
                <h2 id="news-editor-modal-title">{newsItem ? 'Редактировать новость' : 'Добавить новость'}</h2>
                {error && <p className="error-message" role="alert">{error}</p>}
                <form onSubmit={handleSubmit} className="settings-form" noValidate>
                    <div className="form-group">
                        <label htmlFor="news-title">Заголовок:</label>
                        <input type="text" id="news-title" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isLoading} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="news-content">Содержимое (Markdown поддерживается):</label>
                        <div className="rte-toolbar">
                            <button type="button" onClick={() => applyMarkdownSyntax('**')} className="rte-button" title="Жирный" aria-label="Жирный текст"><b>Ж</b></button>
                            <button type="button" onClick={() => applyMarkdownSyntax('*')} className="rte-button" title="Курсив" aria-label="Курсивный текст"><i>К</i></button>
                            <button type="button" onClick={applyHeadingSyntax} className="rte-button" title="Заголовок (H2)" aria-label="Заголовок второго уровня">H</button>
                            <button type="button" onClick={applyListSyntax} className="rte-button" title="Маркированный список" aria-label="Маркированный список">- Список</button>
                            <button type="button" onClick={() => insertLinkSyntax(false)} className="rte-button" title="Вставить ссылку" aria-label="Вставить ссылку">🔗 Ссылка</button>
                            <button type="button" onClick={() => insertLinkSyntax(true)} className="rte-button" title="Вставить MD кнопку" aria-label="Вставить Markdown кнопку">🔘 MD Кнопка</button>
                        </div>
                        <textarea id="news-content" ref={contentTextareaRef} value={content} onChange={(e) => setContentState(e.target.value)} rows={10} disabled={isLoading} placeholder="Введите текст новости..."></textarea>
                    </div>
                    <div className="form-group">
                        <label htmlFor="news-image-url">URL изображения (необязательно):</label>
                        <input type="url" id="news-image-url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} disabled={isLoading} placeholder="https://example.com/image.jpg" />
                    </div>

                    <div className="form-group action-buttons-group">
                        <label>Кнопки Действий (под новостью):</label>
                        {actionButtons.map(btn => (
                            <div key={btn.id} className="action-button-item">
                                <span>{btn.text} ({btn.url})</span>
                                <button type="button" onClick={() => handleRemoveActionButton(btn.id)} className="remove-action-button" aria-label="Удалить кнопку действия" disabled={isLoading}>🗑️</button>
                            </div>
                        ))}
                         <div className="add-action-button-form">
                            <input type="text" placeholder="Текст кнопки" value={currentActionButtonText} onChange={(e) => setCurrentActionButtonText(e.target.value)} disabled={isLoading} />
                            <input type="url" placeholder="URL кнопки" value={currentActionButtonUrl} onChange={(e) => setCurrentActionButtonUrl(e.target.value)} disabled={isLoading} />
                            <button type="button" onClick={handleAddActionButton} className="modal-button tertiary" disabled={isLoading}>Добавить кнопку</button>
                        </div>
                    </div>

                    <div className="form-group form-group-checkbox">
                        <input type="checkbox" id="news-is-published" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} disabled={isLoading} />
                        <label htmlFor="news-is-published">Опубликовать</label>
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
