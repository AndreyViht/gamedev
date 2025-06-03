
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../api/clients';
import { UserProfile } from '../../../types';
import { ALL_AD_PRICE_SETTINGS_KEYS, DEFAULT_AD_PRICES, AD_PRICE_SETTINGS_LABELS } from '../../../config/settingsKeys';

interface AdminAdvertisingSettingsSectionProps {
    currentUser: UserProfile | null;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type SettingsState = Record<string, string>;

export const AdminAdvertisingSettingsSection: React.FC<AdminAdvertisingSettingsSectionProps> = ({ currentUser, showToast }) => {
    const [settings, setSettings] = useState<SettingsState>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchSettings = useCallback(async () => {
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
                .in('key', ALL_AD_PRICE_SETTINGS_KEYS);

            if (error) throw error;

            const fetchedSettings: SettingsState = {};
            for (const key of ALL_AD_PRICE_SETTINGS_KEYS) {
                const foundSetting = data?.find(s => s.key === key);
                fetchedSettings[key] = foundSetting?.value || DEFAULT_AD_PRICES[key] || "";
            }
            setSettings(fetchedSettings);
        } catch (err: any) {
            showToast("Ошибка загрузки настроек: " + err.message, "error");
            const defaultSettings: SettingsState = {};
            for (const key of ALL_AD_PRICE_SETTINGS_KEYS) {
                defaultSettings[key] = DEFAULT_AD_PRICES[key] || "";
            }
            setSettings(defaultSettings);
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleInputChange = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSaveSettings = async () => {
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
            const settingsToUpdate = ALL_AD_PRICE_SETTINGS_KEYS.map(key => ({
                key,
                value: settings[key] || DEFAULT_AD_PRICES[key] || "",
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

            showToast("Тарифы на рекламу успешно сохранены!", "success");
        } catch (err: any) {
            showToast("Ошибка сохранения тарифов: " + err.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="loading-indicator">Загрузка настроек рекламных тарифов... <div className="spinner"></div></div>;
    }

    return (
        <div className="admin-advertising-settings-section">
            <h2 id="admin-content-title" className="sub-page-title">Настройки Рекламных Тарифов</h2>
            <div className="app-settings-section" style={{ maxWidth: '700px' }}> 
                <div className="settings-block">
                    <h3>Тарифы на Рекламные Услуги</h3>
                    <form onSubmit={(e) => { e.preventDefault(); handleSaveSettings(); }} className="settings-form">
                        {ALL_AD_PRICE_SETTINGS_KEYS.map(key => (
                            <div className="form-group" key={key}>
                                <label htmlFor={`setting-${key}`}>{AD_PRICE_SETTINGS_LABELS[key] || key}</label>
                                <input
                                    type="text" 
                                    id={`setting-${key}`}
                                    value={settings[key] || ''}
                                    onChange={(e) => handleInputChange(key, e.target.value)}
                                    placeholder={DEFAULT_AD_PRICES[key] || ""}
                                    disabled={isSaving}
                                />
                            </div>
                        ))}
                        <button type="submit" className="settings-button primary-button" disabled={isSaving}>
                            {isSaving ? 'Сохранение...' : 'Сохранить тарифы'}
                        </button>
                    </form>
                    <div className="admin-note" style={{marginTop: '20px'}}>
                        <p><strong>Важно:</strong> Убедитесь, что таблица `public.app_settings` и RPC функция `admin_upsert_app_settings(settings_array JSONB)` созданы в вашей базе данных Supabase. SQL-скрипт для их создания был предоставлен ранее.</p>
                         <p>RPC функция должна проверять права администратора перед выполнением операции. Если вы видите ошибку "ACCESS_DENIED", проверьте настройки SQL функции и права вашего пользователя.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
