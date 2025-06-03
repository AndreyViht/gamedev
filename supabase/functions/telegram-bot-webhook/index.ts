
// @ts-ignore This directive suppresses the TypeScript error for the next line if the type definition file is not found locally.
/// <reference types="npm:@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

// Declare Deno as a global variable of type 'any' to satisfy TypeScript when Deno types are not fully resolved in the local environment.
declare var Deno: any;

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

console.log('[telegram-bot-webhook] SCRIPT LOADED: Top-level log, before serve() is called.');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
}

serve(async (req: Request) => {
  console.log(`[telegram-bot-webhook] HANDLER INVOKED: Method: ${req.method}`);

  let rawBodyTextForDebug = "[telegram-bot-webhook] Raw body not read yet or failed to read.";
  let clonedRequestForBody;
  try {
    clonedRequestForBody = req.clone();
    console.log('[telegram-bot-webhook] Request cloned for body reading.');
  } catch (cloneError) {
    console.error(`[telegram-bot-webhook] CRITICAL: Failed to clone request: ${cloneError.message}`);
  }

  if (clonedRequestForBody) {
    try {
      rawBodyTextForDebug = await clonedRequestForBody.text();
      const bodySnippet = rawBodyTextForDebug.length > 500 ? rawBodyTextForDebug.substring(0, 500) + "..." : rawBodyTextForDebug;
      console.log(`[telegram-bot-webhook] Raw request body (text snippet from clone): ${bodySnippet}`);
    } catch (e) {
      console.error(`[telegram-bot-webhook] Error reading raw request body from clone: ${e.message}`);
      rawBodyTextForDebug = `[telegram-bot-webhook] Error reading body from clone: ${e.message}`;
    }
  } else {
    console.warn('[telegram-bot-webhook] Request was not cloned, cannot safely log raw body text here if JSON parsing is next.');
  }


  if (req.method === 'OPTIONS') {
    console.log('[telegram-bot-webhook] OPTIONS request: Responding with CORS headers.');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[telegram-bot-webhook] Entered main TRY block for non-OPTIONS request.');
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const projectDomain = Deno.env.get('YOUR_PROJECT_DOMAIN');

    if (!telegramBotToken) console.error('[telegram-bot-webhook] CRITICAL ENV VAR MISSING: TELEGRAM_BOT_TOKEN');
    if (!projectDomain) console.error('[telegram-bot-webhook] CRITICAL ENV VAR MISSING: YOUR_PROJECT_DOMAIN');

    if (!telegramBotToken || !projectDomain) {
      console.error('[telegram-bot-webhook] Aborting due to missing critical environment variables.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing critical credentials for bot webhook.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500, // Should be 500 for server misconfig
      });
    }
    console.log('[telegram-bot-webhook] Environment variables (TELEGRAM_BOT_TOKEN, YOUR_PROJECT_DOMAIN) existence checked.');

    let update: TelegramUpdate;
    try {
        // req.json() consumes the body. Use the original req here.
        update = await req.json(); // This is where the original request body is consumed
        console.log(`[telegram-bot-webhook] Successfully parsed JSON from original request. Update ID: ${update.update_id}, Message Text (if any): ${update.message?.text?.substring(0,50)}...`);
    } catch (jsonParseError) {
        console.error(`[telegram-bot-webhook] JSON PARSE ERROR on original request: ${jsonParseError.message}. Raw body logged earlier (from clone attempt): ${rawBodyTextForDebug}`);
        return new Response(JSON.stringify({ error: 'Invalid JSON in request body.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
        });
    }

    if (update.message && update.message.text && update.message.text.startsWith('/start ')) {
      const commandText = update.message.text;
      const chatId = update.message.chat.id;
      console.log(`[telegram-bot-webhook] Processing /start command: "${commandText}" from chat ID: ${chatId}`);

      const parts = commandText.split(' ');
      if (parts.length === 2 && parts[1].startsWith('contest_')) {
        const contestIdWithPrefix = parts[1];
        const contestId = contestIdWithPrefix.substring('contest_'.length);
        
        if (contestId) {
          console.log(`[telegram-bot-webhook] Extracted contestId: ${contestId}`);
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

          console.log(`[telegram-bot-webhook] Sending message to Telegram API. Chat ID: ${chatId}, URL: ${webAppUrl.substring(0,50)}...`);
          const tgResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(replyMessage),
          });

          const tgResponseData = await tgResponse.json();
          console.log(`[telegram-bot-webhook] Telegram API response for sendMessage: Status ${tgResponse.status}, OK: ${tgResponseData.ok}, Description: ${tgResponseData.description}`);
          
          return new Response(JSON.stringify({ success: true, message_sent_to_user: tgResponseData.ok }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
          });
        } else {
           console.log('[telegram-bot-webhook] Contest ID was empty after parsing from /start command.');
        }
      } else {
         console.log('[telegram-bot-webhook] /start command payload did not match "contest_XXX" format or was not a /start command.');
      }
    } else {
       console.log('[telegram-bot-webhook] Update did not contain a relevant /start message or message.text was missing.');
    }
    
    console.log('[telegram-bot-webhook] Reached end of main TRY block for non-matching command. Sending 200 OK.');
    return new Response(JSON.stringify({ message: 'Update received, but no specific action taken for this command.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error) {
    console.error(`[telegram-bot-webhook] CATCH block error (outer try): ${error.message}`, error);
    // It's crucial to return 200 OK to Telegram to prevent webhook retries, even on server error.
    // Telegram considers non-200 responses as failures and will retry.
    return new Response(JSON.stringify({ error: 'Internal server error processing update. Check function logs for details.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200, 
    });
  }
});

console.log('[telegram-bot-webhook] SCRIPT PARSED: End of script, serve() has been called.');
