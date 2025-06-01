// api/get-news.js
import { kv } from '@vercel/kv';

const NEWS_STORAGE_KEY_KV = 'viht-news-data-v2'; // Versioned key

export default async function handler(request, response) {
    try {
        let newsItems = await kv.get(NEWS_STORAGE_KEY_KV);
        if (!newsItems || !Array.isArray(newsItems)) {
            newsItems = []; 
        }
        response.status(200).json(newsItems);
    } catch (error) {
        console.error('Error fetching news from KV:', error);
        response.status(500).json({ error: 'Failed to fetch news', details: error.message });
    }
}