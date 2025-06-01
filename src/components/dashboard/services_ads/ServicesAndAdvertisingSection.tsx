import React, { useState } from 'react';
import { OrderSection } from '../order/OrderSection';
import { AdvertisingSection } from '../advertising/AdvertisingSection';

interface ServicesAndAdvertisingSectionProps {
  onNavigateToHelpChat: () => void;
}

type SubSection = 'order' | 'advertising';

export const ServicesAndAdvertisingSection: React.FC<ServicesAndAdvertisingSectionProps> = ({ onNavigateToHelpChat }) => {
  const [activeSubSection, setActiveSubSection] = useState<SubSection>('order');

  return (
    <div className="services-ads-section"> {/* Uses .order-section styles from index.css for base layout */}
      <h2 id="dashboard-content-title" className="sub-page-title">Реклама и Услуги</h2>
      <p className="page-intro">
        Выберите интересующий вас раздел: заказ индивидуальной разработки или рекламные возможности.
      </p>
      <div className="order-category-buttons advertising-tabs" style={{ marginBottom: '30px' }}> {/* Re-use existing styles for tabs */}
        <button
          className={`order-category-button ${activeSubSection === 'order' ? 'active' : ''}`}
          onClick={() => setActiveSubSection('order')}
          aria-pressed={activeSubSection === 'order'}
        >
          <span className="category-icon" role="img" aria-label="">🛍️</span>
          Заказать Услугу
        </button>
        <button
          className={`order-category-button ${activeSubSection === 'advertising' ? 'active' : ''}`}
          onClick={() => setActiveSubSection('advertising')}
          aria-pressed={activeSubSection === 'advertising'}
        >
          <span className="category-icon" role="img" aria-label="">📢</span>
          Рекламные Возможности
        </button>
      </div>

      {activeSubSection === 'order' && <OrderSection onNavigateToHelpChat={onNavigateToHelpChat} />}
      {activeSubSection === 'advertising' && <AdvertisingSection onNavigateToHelpChat={onNavigateToHelpChat} />}
    </div>
  );
};
