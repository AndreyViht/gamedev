
// @ts-ignore
/// <reference types="npm:@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

declare var Deno: any;

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

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
      return ['member', 'administrator', 'creator'].includes(status);
    } else {
      console.warn(`Telegram API error (getChatMember) for user ${userId} in chat ${chatId}: ${data.description}`);
      return false; 
    }
  } catch (error) {
    console.error(`Network error checking Telegram membership for user ${userId} in chat ${chatId}:`, error);
    return false;
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
      return new Response(JSON.stringify({ error: 'conditionType (string), targetLink (string), and telegramUserId (number) are required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    if (conditionType !== 'subscribe' && conditionType !== 'join') {
         return new Response(JSON.stringify({ error: 'Invalid conditionType. Must be "subscribe" or "join".' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
        });
    }
    
    let chatIdToCheck = targetLink.trim();
    // Простая нормализация: если ссылка t.me, извлекаем юзернейм/ID. Если уже @юзернейм, используем как есть.
    // Для публичных каналов/групп @username предпочтительнее. Для приватных может потребоваться ID.
    if (chatIdToCheck.includes('t.me/')) {
        const parts = chatIdToCheck.split('t.me/');
        if (parts.length > 1) {
            const potentialId = parts[1].split('/')[0]; // Удаляем возможные / постфикы
            if (!potentialId.startsWith('+')) { // Избегаем join-ссылок типа t.me/+xxxx
                 chatIdToCheck = '@' + potentialId;
            } // если это приватная ссылка t.me/+xxxx, getChatMember может не сработать без join'a бота
        }
    } else if (!chatIdToCheck.startsWith('@') && !chatIdToCheck.startsWith('-100') && !/^\d+$/.test(chatIdToCheck)) {
         // Если не @username и не числовой ID, предполагаем, что это просто публичное имя без @
         chatIdToCheck = '@' + chatIdToCheck;
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
