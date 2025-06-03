
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../api/clients';
import { UserProfile } from '../../../types';
import {
    ONSITE_AD_TITLE_KEY,
    ONSITE_AD_DESCRIPTION_KEY,
    ONSITE_AD_URL_KEY,
    ONSITE_AD_ACTIVE_KEY,
    ALL_ONSITE_AD_CONTENT_KEYS,
    DEFAULT_ONSITE_AD_CONTENT,
    ONSITE_AD_CONTENT_LABELS
} from '../../../config/settingsKeys';

interface AdminOnSiteAdManagementSectionProps {
    currentUser: UserProfile | null;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type OnSiteAdContentState = Record<string, string>;

export const AdminOnSiteAdManagementSection: React.FC<AdminOnSiteAdManagementSectionProps> = ({ currentUser, showToast }) => {
    const [adContent, setAdContent] = useState<OnSiteAdContentState>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchAdContent = useCallback(async () => {
        if (!supabase) {
            showToast("Supabase не инициализирован.", "error");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('key, value')
                .in('key', ALL_ONSITE_AD_CONTENT_KEYS);

            if (error) throw error;

            const fetchedContent: OnSiteAdContentState = {};
            for (const key of ALL_ONSITE_AD_CONTENT_KEYS) {
                const foundSetting = data?.find(s => s.key === key);
                fetchedContent[key] = foundSetting?.value ?? DEFAULT_ONSITE_AD_CONTENT[key] ?? "";
            }
            setAdContent(fetchedContent);
        } catch (err: any) {
            showToast("Ошибка загрузки контента рекламы: " + err.message, "error");
            const defaultContent: OnSiteAdContentState = {};
            for (const key of ALL_ONSITE_AD_CONTENT_KEYS) {
                defaultContent[key] = DEFAULT_ONSITE_AD_CONTENT[key] || "";
            }
            setAdContent(defaultContent);
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchAdContent();
    }, [fetchAdContent]);

    const handleInputChange = (key: string, value: string) => {
        setAdContent(prev => ({ ...prev, [key]: value }));
    };

    const handleCheckboxChange = (key: string, checked: boolean) => {
        setAdContent(prev => ({ ...prev, [key]: checked ? 'true' : 'false' }));
    };

    const handleSaveContent = async () => {
        if (!supabase) {
            showToast("Supabase не инициализирован.", "error");
            return;
        }
         if (!currentUser || !currentUser.user_metadata?.user_viht_id) { 
             showToast("Ошибка: Не удалось определить администратора.", "error");
             return;
        }

        setIsSaving(true);
        try {
            const settingsToUpdate = ALL_ONSITE_AD_CONTENT_KEYS.map(key => ({
                key,
                value: adContent[key] ?? DEFAULT_ONSITE_AD_CONTENT[key] ?? "",
            }));

            const { error: rpcError } = await supabase.rpc('admin_upsert_app_settings', {
                settings_array: settingsToUpdate
            });

            if (rpcError) {
                 if (rpcError.message.includes("ACCESS_DENIED")) {
                    throw new Error("Доступ запрещен. Убедитесь, что вы вошли как администратор и SQL функция настроена верно.");
                 }
                throw rpcError;
            }

            showToast("Контент рекламы на сайте успешно сохранен!", "success");
        } catch (err: any) {
            showToast("Ошибка сохранения контента рекламы: " + err.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="loading-indicator">Загрузка контента рекламы на сайте... <div className="spinner"></div></div>;
    }

    return (
        <div className="admin-onsite-ad-management-section">
            <h2 id="admin-content-title" className="sub-page-title">Управление Рекламой на Сайте (Контент)</h2>
            <div className="app-settings-section" style={{ maxWidth: '700px' }}>
                <div className="settings-block">
                    <h3>Содержимое рекламного блока в боковой панели</h3>
                    <form onSubmit={(e) => { e.preventDefault(); handleSaveContent(); }} className="settings-form">
                        <div className="form-group">
                            <label htmlFor={`setting-${ONSITE_AD_TITLE_KEY}`}>{ONSITE_AD_CONTENT_LABELS[ONSITE_AD_TITLE_KEY]}</label>
                            <input
                                type="text"
                                id={`setting-${ONSITE_AD_TITLE_KEY}`}
                                value={adContent[ONSITE_AD_TITLE_KEY] || ''}
                                onChange={(e) => handleInputChange(ONSITE_AD_TITLE_KEY, e.target.value)}
                                placeholder={DEFAULT_ONSITE_AD_CONTENT[ONSITE_AD_TITLE_KEY]}
                                disabled={isSaving}
                                maxLength={50}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor={`setting-${ONSITE_AD_DESCRIPTION_KEY}`}>{ONSITE_AD_CONTENT_LABELS[ONSITE_AD_DESCRIPTION_KEY]}</label>
                            <textarea
                                id={`setting-${ONSITE_AD_DESCRIPTION_KEY}`}
                                value={adContent[ONSITE_AD_DESCRIPTION_KEY] || ''}
                                onChange={(e) => handleInputChange(ONSITE_AD_DESCRIPTION_KEY, e.target.value)}
                                placeholder={DEFAULT_ONSITE_AD_CONTENT[ONSITE_AD_DESCRIPTION_KEY]}
                                disabled={isSaving}
                                rows={3}
                                maxLength={150}
                            />
                        </div>
                         <div className="form-group">
                            <label htmlFor={`setting-${ONSITE_AD_URL_KEY}`}>{ONSITE_AD_CONTENT_LABELS[ONSITE_AD_URL_KEY]}</label>
                            <input
                                type="url"
                                id={`setting-${ONSITE_AD_URL_KEY}`}
                                value={adContent[ONSITE_AD_URL_KEY] || ''}
                                onChange={(e) => handleInputChange(ONSITE_AD_URL_KEY, e.target.value)}
                                placeholder={DEFAULT_ONSITE_AD_CONTENT[ONSITE_AD_URL_KEY]}
                                disabled={isSaving}
                            />
                        </div>
                        <div className="form-group form-group-checkbox">
                            <input
                                type="checkbox"
                                id={`setting-${ONSITE_AD_ACTIVE_KEY}`}
                                checked={adContent[ONSITE_AD_ACTIVE_KEY] === 'true'}
                                onChange={(e) => handleCheckboxChange(ONSITE_AD_ACTIVE_KEY, e.target.checked)}
                                disabled={isSaving}
                            />
                            <label htmlFor={`setting-${ONSITE_AD_ACTIVE_KEY}`}>{ONSITE_AD_CONTENT_LABELS[ONSITE_AD_ACTIVE_KEY]}</label>
                        </div>
                        <button type="submit" className="settings-button primary-button" disabled={isSaving}>
                            {isSaving ? 'Сохранение...' : 'Сохранить контент'}
                        </button>
                    </form>
                     <div className="admin-note" style={{marginTop: '20px'}}>
                        <p>Этот контент будет отображаться в рекламном блоке в боковой панели личного кабинета пользователей.</p>
                        <p>Убедитесь, что RPC функция `admin_upsert_app_settings` настроена корректно для сохранения этих данных.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
