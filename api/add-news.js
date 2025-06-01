// api/add-news.js
import { kv } from '@vercel/kv';

const NEWS_STORAGE_KEY_KV = 'viht-news-data-v2';
const ADMIN_API_KEY = process.env.VIHT_ADMIN_API_KEY;

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const clientApiKey = request.headers['x-admin-api-key'];

    if (!ADMIN_API_KEY) {
        console.error('[VIHT API] VIHT_ADMIN_API_KEY is not set on the server.');
        return response.status(500).json({ error: 'Server configuration error: Admin API Key not set.' });
    }
    if (clientApiKey !== ADMIN_API_KEY) {
        console.warn('[VIHT API] Unauthorized attempt to add news. Client Key:', clientApiKey ? 'Provided' : 'Missing');
        return response.status(401).json({ error: 'Unauthorized. Invalid or missing admin API key.' });
    }

    try {
        const newsData = request.body;
        if (!Array.isArray(newsData)) {
            return response.status(400).json({ error: 'Invalid news data format. Expected array.' });
        }
        const isValidData = newsData.every(item =>
            typeof item.id === 'string' &&
            typeof item.title === 'string' &&
            typeof item.description === 'string'
        );
        if (!isValidData) {
            return response.status(400).json({ error: 'Invalid news item structure.' });
        }

        await kv.set(NEWS_STORAGE_KEY_KV, newsData);
        response.status(200).json({ message: 'News updated successfully' });
    } catch (error) {
        console.error('Error saving news to KV:', error);
        response.status(500).json({ error: 'Failed to save news', details: error.message });
    }
}