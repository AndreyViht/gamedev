// api/admin/users.js
import { kv } from '@vercel/kv';
import { KV_USERS_KEY } from '../../../shared-utils'; // Adjust path

const ADMIN_API_KEY = process.env.VIHT_ADMIN_API_KEY;

export default async function handler(request, response) {
    const clientApiKey = request.headers['x-admin-api-key'];

    if (!ADMIN_API_KEY) {
        console.error('[VIHT API Admin] VIHT_ADMIN_API_KEY is not set on the server.');
        return response.status(500).json({ error: 'Server configuration error: Admin API Key not set.' });
    }
    if (clientApiKey !== ADMIN_API_KEY) {
        return response.status(401).json({ error: 'Unauthorized. Invalid or missing admin API key.' });
    }

    let users = await kv.get(KV_USERS_KEY);
    if (!Array.isArray(users)) {
        users = [];
    }

    if (request.method === 'GET') {
        try {
            // Return all users, excluding passwordHash for security
            const usersToReturn = users.map(u => {
                const { passwordHash, ...userProfile } = u;
                return userProfile;
            });
            response.status(200).json({ users: usersToReturn });
        } catch (error) {
            console.error('Error fetching users for admin:', error);
            response.status(500).json({ error: 'Failed to fetch users', details: error.message });
        }
    } else if (request.method === 'POST') {
        try {
            const { action, userId, isPremium } = request.body;

            if (action === 'togglePremium') {
                if (!userId || typeof isPremium !== 'boolean') {
                    return response.status(400).json({ error: 'User ID and premium status are required.' });
                }
                const userIndex = users.findIndex(u => u.id === userId);
                if (userIndex === -1) {
                    return response.status(404).json({ error: 'User not found.' });
                }
                users[userIndex].isPremium = isPremium;
                await kv.set(KV_USERS_KEY, users);
                
                // Also update current user in localStorage if admin is modifying self (edge case)
                // This part is tricky as API doesn't know who the current logged-in user on client is.
                // Client-side should handle updating its own CURRENT_USER_KEY if the modified user is self.

                const { passwordHash, ...updatedUserProfile } = users[userIndex];
                response.status(200).json({ message: 'Premium status updated.', user: updatedUserProfile });
            } else {
                response.status(400).json({ error: 'Invalid action.' });
            }
        } catch (error) {
            console.error('Error updating user for admin:', error);
            response.status(500).json({ error: 'Failed to update user', details: error.message });
        }
    } else {
        response.status(405).json({ error: 'Method Not Allowed' });
    }
}