// api/user/update.js
import { kv } from '@vercel/kv';
import { simpleHash, KV_USERS_KEY } from '../../../shared-utils'; // Adjust path

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { userId, newUsername, currentPassword, newPassword, newEmail, isEmailVerified } = request.body;

        if (!userId) {
            return response.status(400).json({ error: 'User ID is required.' });
        }

        let users = await kv.get(KV_USERS_KEY);
        if (!Array.isArray(users)) {
            return response.status(500).json({ error: 'User data not found or corrupt on server.' });
        }

        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return response.status(404).json({ error: 'User not found.' });
        }

        let user = users[userIndex];
        let updated = false;

        // Update username
        if (newUsername) {
            if (newUsername === user.username) {
                 // No change, but not an error
            } else if (users.find(u => u.username === newUsername && u.id !== userId)) {
                return response.status(409).json({ error: 'Username already taken.' });
            } else {
                user.username = newUsername;
                updated = true;
            }
        }

        // Update password
        if (newPassword) {
            if (!currentPassword) {
                return response.status(400).json({ error: 'Current password is required to change password.' });
            }
            if (user.passwordHash !== simpleHash(currentPassword)) {
                return response.status(401).json({ error: 'Incorrect current password.' });
            }
            if (newPassword.length < 6) {
                return response.status(400).json({ error: 'New password must be at least 6 characters.' });
            }
            user.passwordHash = simpleHash(newPassword);
            updated = true;
        }

        // Update email and verification status
        if (newEmail !== undefined) { // Allows setting email to empty string
            user.email = newEmail;
            // isEmailVerified is typically updated by a separate verification flow
            // but if client explicitly sends it (e.g. after simulated verification) allow update
            if (isEmailVerified !== undefined) {
                 user.isEmailVerified = isEmailVerified;
            } else {
                 user.isEmailVerified = false; // Reset verification if email changes and no status provided
            }
            updated = true;
        } else if (isEmailVerified !== undefined && user.email) { // Only update verification status if email exists
             user.isEmailVerified = isEmailVerified;
             updated = true;
        }


        if (updated) {
            users[userIndex] = user;
            await kv.set(KV_USERS_KEY, users);
        }

        // Return updated user profile (excluding passwordHash)
        const { passwordHash, ...userProfile } = user;
        response.status(200).json({ message: 'User updated successfully.', user: userProfile });

    } catch (error) {
        console.error('Error in /api/user/update:', error);
        response.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}