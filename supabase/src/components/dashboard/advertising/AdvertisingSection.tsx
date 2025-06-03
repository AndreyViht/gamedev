
import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '../../../api/clients';
import { APP_NAME } from '../../../config/constants';
import { 
    AD_SMM_POST_PRICE_KEY, 
    AD_SMM_PIN_DAY_PRICE_KEY, 
    AD_ONSITE_WEEK_PRICE_KEY, 
    AD_ONSITE_MONTH_PRICE_KEY,
    DEFAULT_AD_PRICES,
    ALL_AD_PRICE_SETTINGS_KEYS 
} from '../../../config/settingsKeys';

interface AdvertisingSectionProps {
  onNavigateToHelpChat: () => void;
}

type AdCategory = 'smm' | 'on_site';
type FetchedPricesState = Record<string, string>;

export const AdvertisingSection: React.FC<AdvertisingSectionProps> = ({ onNavigateToHelpChat }) => {
  const [activeTab, setActiveTab] = useState<AdCategory>('smm');
  const [prices, setPrices] = useState<FetchedPricesState>(DEFAULT_AD_PRICES);
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);

  const fetchAdPrices = useCallback(async () => {
    setIsLoadingPrices(true);
    if (!supabase) {
        setPrices(DEFAULT_AD_PRICES);
        setIsLoadingPrices(false);
        return;
    }
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('key, value')
            .in('key', ALL_AD_PRICE_SETTINGS_KEYS); 

        if (error) throw error;

        const fetchedPrices: FetchedPricesState = { ...DEFAULT_AD_PRICES }; 
        data?.forEach(setting => {
            if (setting.key && setting.value) {
                fetchedPrices[setting.key] = setting.value;
            }
        });
        setPrices(fetchedPrices);
    } catch (error) {
        setPrices(DEFAULT_AD_PRICES); 
    } finally {
        setIsLoadingPrices(false);
    }
  }, []);

  useEffect(() => {
    fetchAdPrices();
  }, [fetchAdPrices]);


  const smmAdInfo = {
    title: "📢 SMM Реклама и Продвижение",
    description: `Хотите рассказать о своем проекте, канале или продукте широкой аудитории? Мы предлагаем услуги SMM-продвижения через наши ресурсы.
    Это включает размещение постов в наших Telegram-каналах, группах в социальных сетях и на других партнерских площадках.`,
    howItWorks: `**Как это работает?**
1.  Вы связываетесь с нами через **Поддержку** (кнопка ниже) и описываете ваш продукт/канал.
2.  Мы обсуждаем детали, целевую аудиторию и подбираем наиболее подходящие площадки.
3.  Согласовываем рекламные материалы (текст, изображения, видео).
4.  Определяем график публикаций и длительность кампании.
5.  Запускаем рекламу и предоставляем отчеты (при необходимости).`,
    pricing: `**Ориентировочная стоимость:**
*   **Размещение рекламного поста:** от ${prices[AD_SMM_POST_PRICE_KEY]} руб. (зависит от площадки и охвата).
*   **Закрепление поста на 1 день:** от ${prices[AD_SMM_PIN_DAY_PRICE_KEY]} руб.
*   **Пакетные предложения:** обсуждаются индивидуально.
Точная стоимость рассчитывается после анализа вашего запроса.`,
  };

  const onSiteAdInfo = {
    title: "🖥️ Реклама на Сайте " + APP_NAME,
    description: `Разместите ваш рекламный баннер прямо на нашем сайте! Ваш баннер будет отображаться в боковом меню личного кабинета пользователей, обеспечивая видимость среди активной и заинтересованной аудитории.`,
    howItWorks: `**Как это работает?**
1.  Вы предоставляете нам информацию о вашем продукте и желаемый текст/изображение для баннера.
2.  Мы обсуждаем формат (обычно это заголовок, короткое описание до 150 символов и ссылка).
3.  Согласовываем длительность размещения.
4.  После оплаты ваша реклама появляется на сайте.`,
    pricing: `**Ориентировочная стоимость:**
*   **Размещение на 1 неделю:** от ${prices[AD_ONSITE_WEEK_PRICE_KEY]} руб.
*   **Размещение на 1 месяц:** от ${prices[AD_ONSITE_MONTH_PRICE_KEY]} руб.
Гибкие условия для длительного сотрудничества.`,
  };


  return (
    <div className="advertising-section order-section"> 
      <h2 id="dashboard-content-title" className="sub-page-title">Услуги Рекламы и Продвижения</h2>
      <p className="page-intro">
        Увеличьте охват вашего проекта с помощью наших рекламных возможностей. Мы предлагаем как SMM-продвижение, так и размещение рекламы непосредственно на нашем сайте.
      </p>

      <div className="advertising-tabs order-category-buttons"> 
        <button
          className={`order-category-button ${activeTab === 'smm' ? 'active' : ''}`}
          onClick={() => setActiveTab('smm')}
          aria-pressed={activeTab === 'smm'}
        >
          <span className="category-icon" role="img" aria-label="">📢</span> SMM Реклама
        </button>
        <button
          className={`order-category-button ${activeTab === 'on_site' ? 'active' : ''}`}
          onClick={() => setActiveTab('on_site')}
          aria-pressed={activeTab === 'on_site'}
        >
          <span className="category-icon" role="img" aria-label="">🖥️</span> Реклама на Сайте
        </button>
      </div>

      <div className="order-category-details" aria-live="polite">
        {isLoadingPrices && <div className="loading-indicator"><div className="spinner small"></div> Загрузка актуальных цен...</div>}
        {!isLoadingPrices && activeTab === 'smm' && (
          <article>
            <h3>{smmAdInfo.title}</h3>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{smmAdInfo.description}</ReactMarkdown>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{smmAdInfo.howItWorks}</ReactMarkdown>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{smmAdInfo.pricing}</ReactMarkdown>
            <button onClick={onNavigateToHelpChat} className="primary-button">
              Обсудить SMM рекламу в поддержке
            </button>
          </article>
        )}

        {!isLoadingPrices && activeTab === 'on_site' && (
          <article>
            <h3>{onSiteAdInfo.title}</h3>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{onSiteAdInfo.description}</ReactMarkdown>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{onSiteAdInfo.howItWorks}</ReactMarkdown>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{onSiteAdInfo.pricing}</ReactMarkdown>
             <p><strong>Примечание:</strong> Рекламный блок на сайте отображается в левом боковом меню личного кабинета пользователей.</p>
            <button onClick={onNavigateToHelpChat} className="primary-button">
              Обсудить рекламу на сайте в поддержке
            </button>
          </article>
        )}
      </div>
    </div>
  );
};
