// @ts-ignore This directive suppresses the TypeScript error for the next line if the type definition file is not found locally.
/// <reference types="npm:@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

// Declare Deno as a global variable of type 'any' to satisfy TypeScript when Deno types are not fully resolved in the local environment.
declare var Deno: any;

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Telegram sends POST for webhooks
};

// Define a simple type for the expected Telegram update structure (can be expanded)
interface TelegramUpdate {
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number; // This is the user's chat ID for private messages
      type: string; // 'private', 'group', 'supergroup', 'channel'
    };
    date: number;
    text?: string;
  };
  // Add other update types if needed, e.g., callback_query
}


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const projectDomain = Deno.env.get('YOUR_PROJECT_DOMAIN'); // e.g., my-app.netlify.app

    if (!telegramBotToken || !projectDomain) {
      console.error('Missing TELEGRAM_BOT_TOKEN or YOUR_PROJECT_DOMAIN in function environment.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing critical credentials for bot webhook.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }

    const update: TelegramUpdate = await req.json();
    // console.log('Received Telegram Update:', JSON.stringify(update, null, 2)); // For debugging

    if (update.message && update.message.text && update.message.text.startsWith('/start ')) {
      const commandText = update.message.text;
      const chatId = update.message.chat.id; // User's chat ID

      const parts = commandText.split(' ');
      if (parts.length === 2 && parts[1].startsWith('contest_')) {
        const contestIdWithPrefix = parts[1];
        const contestId = contestIdWithPrefix.substring('contest_'.length);

        if (contestId) {
          const webAppUrl = `https://${projectDomain}/telegram-webapp/contest-participation?contestId=${contestId}`;
          
          const replyMessage = {
            chat_id: chatId,
            text: "🎉 Отлично! Нажмите кнопку ниже, чтобы открыть страницу участия и проверить условия:",
            reply_markup: {
              inline_keyboard: [
                [{
                  text: "✨ Открыть страницу участия ✨",
                  web_app: { url: webAppUrl }
                }]
              ]
            }
          };

          const sendMessageUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
          const tgResponse = await fetch(sendMessageUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(replyMessage),
          });

          const tgResponseData = await tgResponse.json();
          if (!tgResponse.ok || !tgResponseData.ok) {
            console.error(`Telegram API error sending Web App button to chat ${chatId}:`, tgResponseData);
            // Don't return error to Telegram webhook here, as it might retry. Log it.
          }
          
          // Always return 200 OK to Telegram webhook to acknowledge receipt
          return new Response(JSON.stringify({ success: true, message_sent: tgResponseData.ok }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
          });
        }
      }
    }

    // Default response if not the specific /start contest_ command
    return new Response(JSON.stringify({ message: 'Update received, but no action taken.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error) {
    console.error('Error in telegram-bot-webhook function:', error);
    if (error instanceof SyntaxError) {
        return new Response(JSON.stringify({ error: 'Invalid JSON in request body from Telegram.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
        });
    }
    // Return 200 OK even on internal errors to prevent Telegram from retrying too much,
    // but log the error for server-side debugging.
    return new Response(JSON.stringify({ error: 'Internal server error processing update.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200, // Acknowledge receipt
    });
  }
});
