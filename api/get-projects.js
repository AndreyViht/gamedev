// api/get-projects.js
import { kv } from '@vercel/kv';

const PROJECTS_STORAGE_KEY_KV = 'viht-projects-data-v2';

export default async function handler(request, response) {
    try {
        let projectItems = await kv.get(PROJECTS_STORAGE_KEY_KV);
        if (!projectItems || !Array.isArray(projectItems)) {
            projectItems = [];
        }
        response.status(200).json(projectItems);
    } catch (error) {
        console.error('Error fetching projects from KV:', error);
        response.status(500).json({ error: 'Failed to fetch projects', details: error.message });
    }
}