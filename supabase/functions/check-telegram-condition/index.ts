
// @ts-ignore
/// <reference types="npm:@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

declare var Deno: any;

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// Supabase client not needed for this specific function if it's self-contained,
// unless you need to log to a Supabase table or something similar.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function checkTelegramMembership(botToken: string, chatId: string, userId: number): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${userId}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.ok) {
      const status = data.result.status;
      // 'member', 'administrator', 'creator' are considered as being in the chat.
      // 'left', 'kicked' mean not in the chat.
      return ['member', 'administrator', 'creator'].includes(status);
    } else {
      console.warn(`Telegram API error checking membership for user ${userId} in chat ${chatId}: ${data.description}`);
      // If bot can't access chat (e.g., not a member/admin itself, or chat is private and bot is not invited)
      // it will return an error. In this case, we can't confirm membership.
      return false; 
    }
  } catch (error) {
    console.error(`Network error checking Telegram membership for user ${userId} in chat ${chatId}:`, error);
    return false; // Assume not a member on network or other errors
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!telegramBotToken) {
      console.error('TELEGRAM_BOT_TOKEN is not set in function environment.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing Telegram Bot Token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }

    const body = await req.json();
    const { conditionType, targetLink, telegramUserId } = body;

    if (!conditionType || !targetLink || typeof telegramUserId !== 'number') {
      return new Response(JSON.stringify({ error: 'conditionType, targetLink, and telegramUserId (number) are required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    if (conditionType !== 'subscribe' && conditionType !== 'join') {
         return new Response(JSON.stringify({ error: 'Invalid conditionType. Must be "subscribe" or "join".' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
        });
    }
    
    // Normalize targetLink: if it's a full URL, extract username/ID. If it's @username, use as is.
    let chatIdToCheck = targetLink.trim();
    if (chatIdToCheck.includes('t.me/')) {
        chatIdToCheck = '@' + chatIdToCheck.split('t.me/')[1].split('/')[0];
    }
    if (!chatIdToCheck.startsWith('@') && !chatIdToCheck.startsWith('-100')) { // Basic check for public username or channel/group ID
        // If it's a join link like t.me/+xxxx, this simple extraction won't work directly with getChatMember.
        // getChatMember typically needs @channelusername or numeric chat_id.
        // For simplicity, we assume targetLink is either @username or a direct numeric ID for now.
        // Proper handling of invite links (t.me/+...) to get chat_id is more complex.
    }


    const isMet = await checkTelegramMembership(telegramBotToken, chatIdToCheck, telegramUserId);

    return new Response(JSON.stringify({ met: isMet }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error) {
    console.error('Function error in check-telegram-condition:', error);
    if (error instanceof SyntaxError) {
        return new Response(JSON.stringify({ error: 'Invalid JSON in request body.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
        });
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal server error.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
