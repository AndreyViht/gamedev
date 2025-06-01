// api/add-project.js
import { kv } from '@vercel/kv';

const PROJECTS_STORAGE_KEY_KV = 'viht-projects-data-v2';
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
        console.warn('[VIHT API] Unauthorized attempt to add project. Client Key:', clientApiKey ? 'Provided' : 'Missing');
        return response.status(401).json({ error: 'Unauthorized. Invalid or missing admin API key.' });
    }

    try {
        const projectData = request.body;
        if (!Array.isArray(projectData)) {
            return response.status(400).json({ error: 'Invalid project data format. Expected array.' });
        }
       const isValidData = projectData.every(item =>
           typeof item.id === 'string' &&
           typeof item.title === 'string' &&
           typeof item.emoji === 'string' &&
           typeof item.description === 'string'
       );
       if (!isValidData) {
           return response.status(400).json({ error: 'Invalid project item structure.' });
       }

        await kv.set(PROJECTS_STORAGE_KEY_KV, projectData);
        response.status(200).json({ message: 'Projects updated successfully' });
    } catch (error) {
        console.error('Error saving projects to KV:', error);
        response.status(500).json({ error: 'Failed to save projects', details: error.message });
    }
}