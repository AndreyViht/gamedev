import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { APP_NAME } from '../../../config/constants';

interface OrderSectionProps {
  onNavigateToHelpChat: () => void;
}

type OrderCategory = 'unity' | 'webgames' | 'bots' | 'websites';

interface OrderCategoryDetail {
  id: OrderCategory;
  title: string;
  icon: string;
  pageTitle: string;
  processDescription: string; // Markdown
  communicationEmphasis: string; // Markdown
  initialInfoNeeded: string[]; // Array of strings (list items)
}

const orderCategoriesData: OrderCategoryDetail[] = [
  {
    id: 'unity',
    title: 'Игры на Unity',
    icon: '🎮',
    pageTitle: 'Разработка Игр на Unity: От Концепта до Релиза',
    processDescription: `Создание игр на Unity — это комплексный и увлекательный процесс, который мы делим на ключевые этапы для достижения наилучшего результата:
1.  **Концептуализация и Дизайн-документ (GDD):** Обсуждаем вашу идею, определяем жанр, целевую аудиторию, ключевые особенности. Формируем детальный GDD.
2.  **Прототипирование:** Создаем базовый прототип для проверки основных механик и ощущений от игры.
3.  **Разработка Основной Механики:** Реализуем ядро геймплея, управление, AI противников (если есть).
4.  **Графика и Арт:** Дизайн и создание 2D/3D моделей, текстур, анимаций, UI/UX.
5.  **Звуковое Оформление:** Подбор или создание музыки, звуковых эффектов.
6.  **Тестирование (QA):** Многоэтапное тестирование для выявления и исправления багов.
7.  **Оптимизация:** Обеспечение плавной работы игры на целевых платформах.
8.  **Релиз и Поддержка:** Помощь с публикацией в сторах, дальнейшая поддержка и обновления.`,
    communicationEmphasis: `Ключ к успешному проекту — это **тесное сотрудничество и четкое взаимопонимание** между вами и нашей командой. Мы ценим регулярную обратную связь, совместные обсуждения и прозрачность на каждом этапе. Ваше видение и наши технические возможности вместе создадут уникальный продукт!`,
    initialInfoNeeded: [
      "**Ваше видение игры:** Детально опишите основную концепцию, уникальные особенности, жанр (RPG, стратегия, шутер и т.д.) и целевую аудиторию. Какую атмосферу и эмоции должна вызывать игра?",
      "**Игровой процесс (Gameplay Loop):** Опишите ключевые действия игрока. Что он будет делать большую часть времени? Каковы основные цели и задачи в игре? Есть ли цикл прогрессии?",
      "**Визуальный стиль и Арт:** Предоставьте референсы (примеры других игр, арты, скриншоты), которые отражают желаемый визуальный стиль, дизайн персонажей, окружения, UI/UX. Есть ли у вас готовые ассеты или брендбук?",
      "**Технические требования и Платформы:** На каких платформах планируется релиз (PC, Mobile, WebGL, VR, консоли)? Есть ли особые технические требования (сетевая игра, интеграция с сервисами, VR-специфика)?",
      "**Монетизация (если применимо):** Как игра будет зарабатывать? (Premium, Free-to-Play с внутриигровыми покупками, реклама, подписка).",
      "**Объем проекта и Контент:** Примерное количество уровней, персонажей, предметов, квестов. Наличие сюжета, диалогов. Предполагаемая длительность игрового опыта.",
      "**Бюджет и Сроки (ориентировочно):** Любая информация о предполагаемом бюджете или желаемых сроках поможет нам составить реалистичное предложение и план разработки."
    ],
  },
  {
    id: 'webgames',
    title: 'Веб-игры (HTML5)',
    icon: '🌐',
    pageTitle: 'Создание Веб-Игр: Интерактивность в Браузере',
    processDescription: `Веб-игры (HTML5, JavaScript, WebGL) открывают доступ к широкой аудитории прямо в браузере. Процесс их создания включает:
1.  **Идея и Дизайн:** Определяем механики, стиль, сложность и монетизацию (если применимо).
2.  **Выбор Технологий:** Phaser, PixiJS, Three.js или нативный JS в зависимости от задачи.
3.  **Разработка:** Кодирование логики игры, графическая интеграция, анимации.
4.  **Адаптивность:** Обеспечение корректной работы на различных устройствах и браузерах.
5.  **Тестирование:** Проверка производительности, совместимости, геймплея.
6.  **Развертывание:** Публикация на вашем веб-ресурсе или игровых платформах.`,
    communicationEmphasis: `Для веб-проектов особенно важна **быстрая итерация и обратная связь**. Мы будем регулярно демонстрировать вам прогресс и вносить корректировки, чтобы игра максимально соответствовала вашим ожиданиям и техническим требованиям платформы.`,
    initialInfoNeeded: [
      "**Концепция и Механика:** Каков основной игровой цикл веб-игры? Это аркада, головоломка, обучающая игра, промо-игра или что-то иное? Какие ключевые механики взаимодействия?",
      "**Целевая аудитория и Устройства:** Для кого эта игра? На каких устройствах и браузерах она должна идеально работать (десктоп, мобильные)? Важна ли оффлайн-доступность (PWA)?",
      "**Визуальный дизайн и Интерактивность:** Примеры желаемого стиля (пиксель-арт, вектор, 2D-анимация). Какой уровень интерактивности и анимаций ожидается? Нужны ли сложные визуальные эффекты?",
      "**Технологический стек (предпочтения):** Есть ли предпочтения по фреймворкам (Phaser, PixiJS, PlayCanvas, Three.js) или технологиям (WebGL, WebAssembly)?",
      "**Интеграция с Бэкендом:** Требуется ли сохранение прогресса, таблицы лидеров, многопользовательский режим, авторизация, аналитика? Нужна ли интеграция с существующим сайтом/сервисом?",
      "**Производительность и Оптимизация:** Какие ожидания по скорости загрузки и производительности, особенно на мобильных устройствах? Есть ли ограничения по размеру игры?",
      "**Монетизация и Распространение (если применимо):** Планируется ли показ рекламы, встроенные покупки, или это часть маркетинговой кампании? Где будет размещена игра?"
    ],
  },
  {
    id: 'bots',
    title: 'Telegram Боты',
    icon: '🤖',
    pageTitle: 'Разработка Telegram Ботов: Автоматизация и Вовлечение',
    processDescription: `Telegram боты могут решать множество задач, от автоматизации рутинных операций до создания интерактивных сервисов. Наш процесс:
1.  **Определение Целей:** Какие задачи должен выполнять бот? Какую пользу он принесет?
2.  **Проектирование Логики:** Схема диалогов, команды, интеграции с API.
3.  **Разработка:** Написание кода бота (часто на Python, Node.js), настройка сервера.
4.  **Интеграция:** Подключение к базам данных, внешним сервисам, платежным системам.
5.  **Тестирование:** Проверка всех сценариев работы, обработка ошибок.
6.  **Развертывание и Поддержка:** Запуск бота и его дальнейшее сопровождение.`,
    communicationEmphasis: `Четкое ТЗ (техническое задание) и **постоянный диалог** — основа для создания эффективного бота. Мы поможем вам сформулировать требования и будем держать вас в курсе процесса разработки, чтобы бот точно соответствовал вашим бизнес-целям.`,
    initialInfoNeeded: [
      "**Основная задача и Цель Бота:** Какую проблему решает бот или какую ценность он предоставляет пользователям? Автоматизация, информация, развлечение, сервис?",
      "**Функционал и Команды:** Подробный список функций, которые должен выполнять бот. Какие команды будут доступны пользователям? Как будет выглядеть структура диалогов?",
      "**Интеграции со Сторонними Сервисами:** Нужна ли боту интеграция с вашим сайтом, CRM, базой данных, платежной системой, Google Sheets, или другими API?",
      "**Администрирование и Управление Ботом:** Какие инструменты нужны для управления ботом (рассылки, просмотр статистики, управление пользователями, модерация контента)?",
      "**Типы Данных и Хранение Информации:** Какую информацию бот будет получать от пользователей и какую хранить? Требуется ли персонализация или история взаимодействия?",
      "**Дизайн Взаимодействия (UX):** Как пользователи будут взаимодействовать с ботом? Только текст, кнопки, inline-клавиатуры, веб-приложения внутри Telegram? Есть ли предпочтения по тону общения бота?",
      "**Нагрузка и Масштабируемость:** Предполагаемое количество пользователей и интенсивность использования бота. Требования к скорости ответа и надежности."
    ],
  },
  {
    id: 'websites',
    title: 'Сайты и Веб-приложения',
    icon: '🖥️',
    pageTitle: 'Веб-Разработка: От Лендинга до Сложного Портала',
    processDescription: `Мы создаем широкий спектр веб-решений, от простых сайтов-визиток до сложных веб-приложений и порталов:
1.  **Анализ и Проектирование:** Изучаем ваши цели, аудиторию, конкурентов. Составляем ТЗ, прототипы.
2.  **Дизайн (UI/UX):** Разрабатываем привлекательный и удобный интерфейс.
3.  **Frontend Разработка:** Верстка макетов, создание интерактивных элементов (HTML, CSS, JavaScript, React/Vue/Angular).
4.  **Backend Разработка (при необходимости):** Создание серверной логики, баз данных, API (Node.js, Python, PHP, etc.).
5.  **Интеграции:** Подключение сторонних сервисов, платежных систем.
6.  **Тестирование и Оптимизация:** Проверка функциональности, скорости загрузки, безопасности.
7.  **Развертывание и Сопровождение:** Публикация сайта, обучение, техническая поддержка.`,
    communicationEmphasis: `Для веб-проектов важна **гибкость и адаптивность**. Мы используем современные методологии разработки, чтобы вы могли видеть результат на ранних этапах и вносить изменения. Ваше активное участие в процессе гарантирует, что конечный продукт будет полностью соответствовать вашим ожиданиям.`,
    initialInfoNeeded: [
      "**Цель и Тип Ресурса:** Какова главная цель вашего веб-проекта (продажи, информация, сервис, сообщество)? Это лендинг, корпоративный сайт, блог, интернет-магазин, SaaS-платформа, сложный портал?",
      "**Целевая Аудитория и Пользовательские Сценарии:** Кто ваши пользователи? Какие задачи они будут решать с помощью вашего сайта/приложения? Опишите основные пользовательские пути.",
      "**Структура и Контент:** Примерная структура сайта (основные разделы, страницы). Есть ли готовый контент (тексты, изображения, видео) или нужна помощь в его создании/подборе?",
      "**Дизайн и Брендинг:** Есть ли у вас брендбук, логотип, фирменные цвета? Примеры сайтов, которые нравятся по дизайну и удобству. Требования к адаптивности и доступности (Accessibility, WCAG).",
      "**Технический Функционал:** Необходим ли личный кабинет, система управления контентом (CMS), каталог товаров, корзина, онлайн-оплата, формы обратной связи, калькуляторы, интеграция с картами, API сторонних сервисов?",
      "**Технологические Предпочтения (если есть):** Предпочтения по CMS (WordPress, Tilda, etc.), фреймворкам (React, Vue, Angular для фронтенда; Node.js, Python, PHP для бэкенда), базам данных.",
      "**Хостинг, Домен и Дальнейшая Поддержка:** Есть ли у вас хостинг и домен? Нужна ли помощь в их выборе и настройке? Какие ожидания по дальнейшей поддержке и развитию проекта?"
    ],
  },
];


export const OrderSection: React.FC<OrderSectionProps> = ({ onNavigateToHelpChat }) => {
  const [activeCategory, setActiveCategory] = useState<OrderCategory | null>(null);

  const selectedCategoryDetails = activeCategory ? orderCategoriesData.find(cat => cat.id === activeCategory) : null;

  return (
    <div className="order-section">
      <h2 id="dashboard-content-title" className="sub-page-title">Закажите разработку вашей мечты</h2>
      <p className="page-intro">
        В {APP_NAME} мы готовы воплотить ваши самые смелые идеи в жизнь! Выберите тип проекта, который вас интересует, чтобы узнать больше о нашем подходе, процессе разработки и о том, какая информация потребуется от вас для успешного старта.
      </p>

      <div className="order-category-buttons">
        {orderCategoriesData.map(category => (
          <button
            key={category.id}
            className={`order-category-button ${activeCategory === category.id ? 'active' : ''}`}
            onClick={() => setActiveCategory(category.id)}
            aria-pressed={activeCategory === category.id}
            aria-controls={activeCategory === category.id ? `order-category-details-${category.id}` : undefined}
          >
            <span className="category-icon" role="img" aria-label={category.title}>{category.icon}</span>
            {category.title}
          </button>
        ))}
      </div>

      {selectedCategoryDetails && (
        <article id={`order-category-details-${selectedCategoryDetails.id}`} className="order-category-details" aria-live="polite">
          <h3>{selectedCategoryDetails.pageTitle}</h3>
          
          <h4>🚀 Наш Процесс Разработки</h4>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedCategoryDetails.processDescription}</ReactMarkdown>
          
          <h4>🤝 Важность Взаимопонимания</h4>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedCategoryDetails.communicationEmphasis}</ReactMarkdown>

          <h4>📋 Что нам нужно от вас для старта?</h4>
          <ul>
            {selectedCategoryDetails.initialInfoNeeded.map((item, index) => (
              <li key={index}><ReactMarkdown remarkPlugins={[remarkGfm]}>{item}</ReactMarkdown></li>
            ))}
          </ul>
          <p>Эта информация поможет нам лучше понять ваш проект и подготовить предметное предложение. Не волнуйтесь, если у вас нет ответов на все вопросы – мы поможем их сформулировать!</p>

          <button onClick={onNavigateToHelpChat} className="primary-button">
            Обсудить проект в поддержке
          </button>
        </article>
      )}
    </div>
  );
};