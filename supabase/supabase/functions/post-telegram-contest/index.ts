
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

  // These should match how ADMIN_USERS is defined in your frontend constants
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
    // For admin check, we need service_role if we are checking against user_metadata directly from auth.users
    // Or anon_key if we get user from JWT and trust its metadata (but metadata can be stale).
    // Let's use service_role for a more robust admin check.
    const serviceRoleKey = Deno.env.get('APP_SERVICE_ROLE_KEY');
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const telegramChannelId = Deno.env.get('TELEGRAM_CHANNEL_ID');

    if (!supabaseUrl || !serviceRoleKey || !telegramBotToken || !telegramChannelId) {
      console.error('Missing environment variables for Supabase or Telegram.');
      return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    
    // Admin check
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
    const { title, description, prize, imageUrl, buttonText, buttonUrl } = body;

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
      chat_id: telegramChannelId,
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
      console.error('Telegram API error:', responseData);
      return new Response(JSON.stringify({ error: `Telegram API error: ${responseData.description || 'Unknown error'}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Конкурс опубликован!', telegramResponse: responseData }), {
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
