
import React, { useId, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NewsItem, ProjectItem, LandingPageSection } from '../../types';
import { View } from '../../enums/appEnums'; // Import View
import { APP_NAME } from '../../config/constants';
import { ImageLightbox } from '../common/ImageLightbox';
import { Button, Card, CardContent, CardMedia, Typography, Box, Paper, Link as MuiLink } from '@mui/material'; // MUI imports

interface LandingPageProps {
    news: NewsItem[];
    projects: ProjectItem[];
    onNavigateToSection: (section: LandingPageSection) => void;
    activeSection: LandingPageSection;
    onNavigate: (view: View) => void; // Added for Login button
}

export const LandingPage: React.FC<LandingPageProps> = ({ news, projects, onNavigateToSection, activeSection, onNavigate }) => {
    const newsSectionId = useId();
    const projectsSectionId = useId();
    const aboutSectionId = useId();
    const orderSectionId = useId();

    const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

    const openLightbox = (imageUrl: string | undefined | null) => {
        if (imageUrl) {
            setLightboxImageUrl(imageUrl);
        }
    };

    const closeLightbox = () => {
        setLightboxImageUrl(null);
    };

    const navItems: { section: LandingPageSection, label: string, ariaControls: string }[] = [
      { section: 'news', label: 'Новости', ariaControls: newsSectionId },
      { section: 'projects', label: 'Проекты', ariaControls: projectsSectionId },
      { section: 'about', label: 'О нас', ariaControls: aboutSectionId },
      { section: 'order', label: 'Заказать', ariaControls: orderSectionId },
    ];

    return (
        <Box className="landing-page" sx={{pt: 3}}>
            <Box component="nav" className="landing-page-nav" aria-label="Навигация по главной странице">
                {navItems.map(item => (
                    <Button 
                        key={item.section}
                        onClick={() => onNavigateToSection(item.section)} 
                        variant={activeSection === item.section ? "contained" : "outlined"}
                        aria-controls={item.ariaControls}
                        aria-pressed={activeSection === item.section}
                        sx={{ borderRadius: 'var(--border-radius-large)', textTransform: 'none', fontWeight: 500 }}
                    >
                        {item.label}
                    </Button>
                ))}
            </Box>

            {activeSection === 'news' && (
                <Box component="section" id={newsSectionId} className="landing-content-section active" aria-labelledby="news-heading">
                    <Typography variant="h4" component="h1" id="news-heading" className="page-title" gutterBottom sx={{fontWeight: 700}}>Новости GameDev Индустрии</Typography>
                    {news.length === 0 && <Typography>Пока нет новостей. Загляните позже!</Typography>}
                    <Box className="content-grid news-grid">
                        {news.map((item, index) => (
                            <Card 
                                key={`news-${item.id}`} 
                                raised 
                                className="floating-card"
                                sx={{ 
                                    animation: 'cardEnterAnimation 0.5s ease-out forwards', 
                                    animationDelay: `${index * 0.08}s`,
                                    opacity: 0,
                                    display: 'flex', flexDirection: 'column'
                                }}
                                aria-labelledby={`news-title-${item.id}`}
                            >
                                {item.imageUrl && 
                                    <CardMedia
                                        component="img"
                                        alt="" // Decorative, title provides context
                                        height="220"
                                        image={item.imageUrl}
                                        onClick={() => openLightbox(item.imageUrl)}
                                        sx={{ cursor: 'pointer', '&:hover': { filter: 'brightness(0.9)'} }}
                                        aria-label={`Открыть изображение для новости ${item.title}`}
                                        tabIndex={0}
                                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openLightbox(item.imageUrl)}
                                        role="button"
                                    />
                                }
                                <CardContent sx={{flexGrow: 1}}>
                                    <Typography gutterBottom variant="h6" component="h2" id={`news-title-${item.id}`} sx={{fontWeight: 600}}>{item.title}</Typography>
                                    <Box className="content-card-summary news-summary" sx={{ mb: 1, fontSize: '0.95rem', color: 'text.secondary' }}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content || item.summary || ''}</ReactMarkdown>
                                    </Box>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{mb: 1.5}}>Опубликовано: {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Недавно'}</Typography>
                                    {item.action_buttons && item.action_buttons.length > 0 && (
                                        <Box className="news-action-buttons" sx={{display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                                            {item.action_buttons.map((button, btnIndex) => (
                                                <Button key={btnIndex} href={button.url} target="_blank" rel="noopener noreferrer" variant="contained" size="small" color="secondary">
                                                    {button.text}
                                                </Button>
                                            ))}
                                        </Box>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </Box>
                </Box>
            )}

             {activeSection === 'projects' && (
                <Box component="section" id={projectsSectionId} className="landing-content-section active" aria-labelledby="projects-heading">
                    <Typography variant="h4" component="h2" id="projects-heading" className="page-title" gutterBottom sx={{fontWeight: 700}}>Проекты Сообщества</Typography>
                     {projects.length === 0 && <Typography>Проекты скоро появятся!</Typography>}
                    <Box className="content-grid projects-grid">
                        {projects.map((item, index) => (
                            <Card 
                                key={`project-${item.id}`} 
                                raised
                                className="floating-card"
                                sx={{ 
                                    animation: 'cardEnterAnimation 0.5s ease-out forwards', 
                                    animationDelay: `${index * 0.08}s`,
                                    opacity: 0,
                                    display: 'flex', flexDirection: 'column'
                                }}
                                aria-labelledby={`project-title-${item.id}`}
                            >
                                {item.imageUrl && 
                                    <CardMedia
                                        component="img"
                                        alt={`Обложка проекта ${item.title}`} 
                                        height="220"
                                        image={item.imageUrl}
                                        onClick={() => openLightbox(item.imageUrl)}
                                        sx={{ cursor: 'pointer', '&:hover': { filter: 'brightness(0.9)'} }}
                                        aria-label={`Открыть изображение для проекта ${item.title}`}
                                        tabIndex={0}
                                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openLightbox(item.imageUrl)}
                                        role="button"
                                    />
                                }
                                <CardContent sx={{flexGrow: 1}}>
                                    <Typography gutterBottom variant="h6" component="h3" id={`project-title-${item.id}`} sx={{fontWeight: 600}}>{item.title}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{mb: 0.5}}><strong>Жанр:</strong> {item.genre}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{mb: 1}}><strong>Статус:</strong> {item.status}</Typography>
                                    <Typography variant="body2" className="content-card-summary project-description" sx={{mb: 2}}>{item.description}</Typography>
                                    <Box className="project-links" sx={{display: 'flex', gap: 1.5, flexWrap: 'wrap'}}>
                                        {item.project_url && <Button href={item.project_url} target="_blank" rel="noopener noreferrer" variant="outlined" size="small">Сайт проекта</Button>}
                                        {item.source_code_url && <Button href={item.source_code_url} target="_blank" rel="noopener noreferrer" variant="outlined" size="small">Исходный код</Button>}
                                    </Box>
                                </CardContent>
                            </Card>
                        ))}
                    </Box>
                </Box>
            )}
             {activeSection === 'about' && (
                <Box component="section" id={aboutSectionId} className="landing-content-section active" aria-labelledby="about-heading">
                    <Typography variant="h4" component="h2" id="about-heading" className="page-title" gutterBottom sx={{fontWeight: 700}}>О Нас - {APP_NAME}</Typography>
                    <Paper elevation={3} className="about-us-content-wrapper floating-container" sx={{p: {xs: 3, sm: 4}, backgroundColor: 'background.paper'}}>
                        <Typography variant="body1" paragraph><strong>{APP_NAME}</strong> - это небольшая, но уверенная в себе компания, специализирующаяся на создании инновационных решений. Мы разрабатываем игры, интерактивные платформы, мощные плагины, современные веб-сайты и приложения.</Typography>
                        <Typography variant="body1" paragraph>Наша экспертиза также включает интеграцию Telegram-ботов, разработку API и применение искусственного интеллекта для широкого круга задач, включая кастомные ИИ-решения и их интеграцию в ваши проекты.</Typography>
                        <Typography variant="body1" paragraph>Мы стремимся быть на передовой технологий, чтобы предлагать вам самые эффективные и креативные продукты.</Typography>
                        <Button 
                            href="https://t.me/developmentchannelGAME" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            variant="contained" 
                            color="secondary"
                            startIcon={<span role="img" aria-label="Telegram icon">🚀</span>}
                            sx={{mt: 3, textTransform: 'none'}}
                        >
                            Больше новостей в нашем Telegram-канале!
                        </Button>
                    </Paper>
                </Box>
            )}
            {activeSection === 'order' && (
                <Box component="section" id={orderSectionId} className="landing-content-section active" aria-labelledby="order-heading">
                    <Typography variant="h4" component="h2" id="order-heading" className="page-title" gutterBottom sx={{fontWeight: 700}}>Закажите Решение Вашей Мечты</Typography>
                    <Paper elevation={3} className="order-section-content floating-container" sx={{p: {xs: 3, sm: 4}, backgroundColor: 'background.paper', borderRadius: 'var(--border-radius-large)'}}>
                        <Typography variant="body1" paragraph>В <strong>{APP_NAME}</strong> мы превращаем ваши идеи в реальность! Предлагаем полный спектр услуг по разработке "под ключ":</Typography>
                        <Box component="ul" sx={{pl: 2.5, mb: 2}}>
                            {[
                                "Создание захватывающих игр (любых жанров и платформ)",
                                "Разработка интерактивных платформ и веб-сервисов",
                                "Проектирование и внедрение мощных плагинов",
                                "Создание современных веб-сайтов и приложений",
                                "Интеграция Telegram-ботов и разработка API",
                                "Применение и кастомизация искусственного интеллекта для ваших уникальных задач"
                            ].map(item => <Typography component="li" variant="body1" key={item}>{item}</Typography>)}
                        </Box>
                        <Typography variant="body1" paragraph>Каждый проект для нас – это индивидуальное путешествие, где мы тесно сотрудничаем с вами на всех этапах. Обсудим детали и найдем лучшее решение для вас в вашем личном кабинете!</Typography>
                        <Button 
                            onClick={() => onNavigate(View.Login)} 
                            variant="contained" 
                            size="large"
                            sx={{mt: 2, textTransform: 'none'}}
                        >
                            Войти и Обсудить Проект
                        </Button>
                    </Paper>
                </Box>
            )}
            {lightboxImageUrl && <ImageLightbox imageUrl={lightboxImageUrl} onClose={closeLightbox} />}
        </Box>
    );
};
