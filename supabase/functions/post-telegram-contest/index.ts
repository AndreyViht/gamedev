// @ts-ignore This directive suppresses the TypeScript error for the next line if the type definition file is not found locally.
/// <reference types="npm:@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

// Declare Deno as a global variable of type 'any' to satisfy TypeScript when Deno types are not fully resolved in the local environment.
declare var Deno: any;

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ContestDetails {
  title: string;
  description: string;
  prize: string;
  imageUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  targetChannelId?: string; // Added to receive dynamic channel ID
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper function to check admin status (simplified)
async function isAdmin(supabaseAdminClient: any, jwt: string): Promise<boolean> {
  const { data: { user }, error: userError } = await supabaseAdminClient.auth.getUser(jwt);
  if (userError || !user) {
    console.error('Admin check: User fetch error or no user', userError);
    return false;
  }

  const adminVihtIdsConfig = Deno.env.get('ADMIN_USER_VIHT_IDS_CONFIG')?.split(',') || [];
  const adminEmailsConfig = Deno.env.get('ADMIN_USER_EMAILS_CONFIG')?.split(',') || [];
  
  const userVihtId = user.user_metadata?.user_viht_id;
  const userEmail = user.email;

  for (let i = 0; i < adminEmailsConfig.length; i++) {
    if (userEmail === adminEmailsConfig[i].trim() && userVihtId === (adminVihtIdsConfig[i]?.trim())) {
      return true;
    }
  }
  console.warn(`Admin check failed for user: ${userEmail} (Viht ID: ${userVihtId})`);
  return false;
}


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('APP_SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('APP_SERVICE_ROLE_KEY');
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    // TELEGRAM_CHANNEL_ID is now a fallback/default
    const defaultTelegramChannelIdFromEnv = Deno.env.get('TELEGRAM_CHANNEL_ID'); 

    if (!supabaseUrl || !serviceRoleKey || !telegramBotToken ) { // defaultTelegramChannelIdFromEnv can be optional if targetChannelId is always provided
      console.error('Missing critical environment variables (Supabase URL, Service Role Key, Telegram Bot Token).');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing critical credentials.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabaseAdminForAuth = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    if (!await isAdmin(supabaseAdminForAuth, token)) {
        return new Response(JSON.stringify({ error: 'Admin privileges required.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
        });
    }

    const body: ContestDetails = await req.json();
    const { title, description, prize, imageUrl, buttonText, buttonUrl, targetChannelId } = body;

    // Determine the channel ID to use
    const effectiveChannelId = targetChannelId && typeof targetChannelId === 'string' && targetChannelId.trim() !== ''
                                ? targetChannelId.trim()
                                : defaultTelegramChannelIdFromEnv;

    if (!effectiveChannelId) {
      console.error('Target channel ID is not specified and no default channel ID is configured.');
      return new Response(JSON.stringify({ error: 'Channel ID for posting is not configured. Please specify targetChannelId or set TELEGRAM_CHANNEL_ID in function env.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }


    if (!title || !description || !prize) {
      return new Response(JSON.stringify({ error: 'Title, description, and prize are required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    let text = `🏆 *${title.trim()}* 🏆\n\n`;
    text += `${description.trim()}\n\n`;
    text += `🎁 *Приз:* ${prize.trim()}\n\n`;
    text += `Подробности и участие как указано в описании. Желаем удачи! ✨`;

    const payload: any = {
      chat_id: effectiveChannelId, // Use the determined channel ID
      parse_mode: 'Markdown',
    };

    if (buttonText && buttonUrl) {
      payload.reply_markup = {
        inline_keyboard: [
          [{ text: buttonText, url: buttonUrl }]
        ]
      };
    }
    
    let telegramApiUrl;
    if (imageUrl) {
        telegramApiUrl = `https://api.telegram.org/bot${telegramBotToken}/sendPhoto`;
        payload.photo = imageUrl;
        payload.caption = text;
    } else {
        telegramApiUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
        payload.text = text;
    }

    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok || !responseData.ok) {
      console.error(`Telegram API error for channel ${effectiveChannelId}:`, responseData);
      return new Response(JSON.stringify({ error: `Telegram API error posting to ${effectiveChannelId}: ${responseData.description || 'Unknown error'}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      });
    }

    return new Response(JSON.stringify({ success: true, message: `Конкурс опубликован в канал ${effectiveChannelId}!`, telegramResponse: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Function error:', error);
     if (error instanceof SyntaxError) {
        return new Response(JSON.stringify({ error: 'Invalid JSON in request body.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
        });
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal server error.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
