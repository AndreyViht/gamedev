// api/auth/login.js
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

        let users = await kv.get(KV_USERS_KEY);
        if (!Array.isArray(users)) {
            users = [];
        }

        const user = users.find(u => u.username === username);

        if (!user) {
            return response.status(401).json({ error: 'Invalid username or password.' });
        }

        const enteredPasswordHash = simpleHash(password);
        if (user.passwordHash !== enteredPasswordHash) {
            return response.status(401).json({ error: 'Invalid username or password.' });
        }

        // User authenticated, return user data (excluding passwordHash)
        const { passwordHash, ...userProfile } = user; 
        
        // Ensure aiChatStats and isPremium are initialized if they were missing
        const aiChatStats = userProfile.aiChatStats || { messagesSentThisWeek: 0, weekStartDate: Date.now() };
        const isPremium = typeof userProfile.isPremium === 'boolean' ? userProfile.isPremium : false;
        const email = userProfile.email || '';
        const isEmailVerified = typeof userProfile.isEmailVerified === 'boolean' ? userProfile.isEmailVerified : false;

        const finalUserProfile = {
            ...userProfile,
            email,
            isEmailVerified,
            aiChatStats,
            isPremium
        };
        
        // If any fields were initialized, update the user record in KV
        if (!user.aiChatStats || typeof user.isPremium === 'undefined' || !user.email || typeof user.isEmailVerified === 'undefined') {
            const userIndex = users.findIndex(u => u.id === user.id);
            if (userIndex > -1) {
                users[userIndex] = { ...user, ...finalUserProfile, passwordHash: user.passwordHash }; // ensure passwordHash is kept
                await kv.set(KV_USERS_KEY, users);
            }
        }


        response.status(200).json({ message: 'Login successful.', user: finalUserProfile });

    } catch (error) {
        console.error('Error in /api/auth/login:', error);
        response.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}