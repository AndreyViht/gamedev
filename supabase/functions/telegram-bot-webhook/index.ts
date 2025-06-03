
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
  update_id: number;
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
  // Log method and attempt to get raw body text as early as possible
  console.log(`[telegram-bot-webhook] Function called. Method: ${req.method}`);
  let rawBodyTextForDebug = "Could not read raw body.";
  try {
    // Create a clone of the request to read its body, as body can only be read once.
    const reqCloneForBody = req.clone();
    rawBodyTextForDebug = await reqCloneForBody.text();
    // Log only a snippet if it's too long to avoid flooding logs
    const bodySnippet = rawBodyTextForDebug.length > 1000 ? rawBodyTextForDebug.substring(0, 1000) + "..." : rawBodyTextForDebug;
    console.log(`[telegram-bot-webhook] Raw request body (text snippet): ${bodySnippet}`);
  } catch (e) {
    console.error(`[telegram-bot-webhook] Error reading raw request body: ${e.message}`);
    rawBodyTextForDebug = `Error reading body: ${e.message}`;
  }


  if (req.method === 'OPTIONS') {
    console.log('[telegram-bot-webhook] Handling OPTIONS request.');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const projectDomain = Deno.env.get('YOUR_PROJECT_DOMAIN'); // e.g., my-app.netlify.app

    if (!telegramBotToken || !projectDomain) {
      console.error('[telegram-bot-webhook] Missing TELEGRAM_BOT_TOKEN or YOUR_PROJECT_DOMAIN in function environment.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing critical credentials for bot webhook.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }

    let update: TelegramUpdate;
    try {
        update = await req.json();
    } catch (jsonParseError) {
        console.error(`[telegram-bot-webhook] Failed to parse JSON from request body. Raw body was (snippet): ${rawBodyTextForDebug.substring(0,1000)}`, jsonParseError);
        return new Response(JSON.stringify({ error: 'Invalid JSON in request body.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
        });
    }
    console.log(`[telegram-bot-webhook] Parsed update ID: ${update.update_id}`);


    if (update.message && update.message.text && update.message.text.startsWith('/start ')) {
      const commandText = update.message.text;
      const chatId = update.message.chat.id; // User's chat ID
      console.log(`[telegram-bot-webhook] Received /start command: "${commandText}" from chat ID: ${chatId}`);

      const parts = commandText.split(' ');
      if (parts.length === 2 && parts[1].startsWith('contest_')) {
        const contestIdWithPrefix = parts[1];
        const contestId = contestIdWithPrefix.substring('contest_'.length);
        console.log(`[telegram-bot-webhook] Extracted contestId: ${contestId}`);

        if (contestId) {
          const webAppUrl = `https://${projectDomain}/telegram-webapp/contest-participation?contestId=${contestId}`;
          console.log(`[telegram-bot-webhook] Generated Web App URL: ${webAppUrl}`);
          
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
          console.log(`[telegram-bot-webhook] Sending message to Telegram API: ${sendMessageUrl} with payload: ${JSON.stringify(replyMessage)}`);
          const tgResponse = await fetch(sendMessageUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(replyMessage),
          });

          const tgResponseData = await tgResponse.json();
          console.log(`[telegram-bot-webhook] Telegram API response: ${JSON.stringify(tgResponseData)}`);
          if (!tgResponse.ok || !tgResponseData.ok) {
            console.error(`[telegram-bot-webhook] Telegram API error sending Web App button to chat ${chatId}:`, tgResponseData);
          }
          
          // Telegram expects a 200 OK response to the webhook, even if sending the message fails.
          // The actual content of the response to Telegram webhook doesn't usually matter unless you're using specific reply methods.
          return new Response(JSON.stringify({ success: true, message_sent_to_user: tgResponseData.ok }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
          });
        } else {
           console.log('[telegram-bot-webhook] Contest ID was empty after parsing.');
        }
      } else {
         console.log('[telegram-bot-webhook] /start command payload did not match "contest_XXX" format.');
      }
    } else {
       console.log('[telegram-bot-webhook] Update did not contain a relevant /start message or message text.');
    }

    // Default response if not the specific /start contest_ command
    // Always return 200 OK to Telegram to acknowledge receipt of the webhook.
    return new Response(JSON.stringify({ message: 'Update received, but no specific action taken for this command.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error) {
    console.error('[telegram-bot-webhook] Main try-catch error:', error);
    // Acknowledge receipt to Telegram even in case of server error to prevent retries.
    return new Response(JSON.stringify({ error: 'Internal server error processing update. Check function logs.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200, 
    });
  }
});
