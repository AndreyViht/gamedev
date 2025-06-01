// api/auth/register.js
import { kv } from '@vercel/kv';
import { simpleHash, KV_USERS_KEY } from '../../../shared-utils'; // Adjust path as necessary

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { username, password } = request.body;

        if (!username || !password) {
            return response.status(400).json({ error: 'Username and password are required.' });
        }
        if (password.length < 6) {
            return response.status(400).json({ error: 'Password must be at least 6 characters long.' });
        }

        let users = await kv.get(KV_USERS_KEY);
        if (!Array.isArray(users)) {
            users = [];
        }

        if (users.find(u => u.username === username)) {
            return response.status(409).json({ error: 'Username already exists.' });
        }

        const passwordHash = simpleHash(password);
        const newUser = {
            id: Date.now().toString(), // Simple unique ID
            username,
            passwordHash,
            email: '',
            isEmailVerified: false,
            aiChatStats: { messagesSentThisWeek: 0, weekStartDate: Date.now() },
            isPremium: false,
            registrationDate: Date.now(),
        };

        users.push(newUser);
        await kv.set(KV_USERS_KEY, users);

        response.status(201).json({ message: 'User registered successfully.' });

    } catch (error) {
        console.error('Error in /api/auth/register:', error);
        response.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}