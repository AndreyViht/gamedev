// @ts-ignore This directive suppresses the TypeScript error for the next line if the type definition file is not found locally.
/// <reference types="npm:@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

// Declare Deno as a global variable of type 'any' to satisfy TypeScript when Deno types are not fully resolved in the local environment.
declare var Deno: any;

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let supabaseClient: SupabaseClient | null = null;

  try {
    const supabaseUrl = Deno.env.get('APP_SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('APP_SERVICE_ROLE_KEY');
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

    if (!supabaseUrl || !serviceRoleKey || !telegramBotToken) {
      console.error('Missing Supabase URL, Service Role Key, or Telegram Bot Token.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing critical credentials.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }

    supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Auth check (e.g., secret header if called by trusted backend) can be added here.
    // For now, assuming this function is protected.

    const body = await req.json();
    const { contest_id } = body;

    if (!contest_id) {
      return new Response(JSON.stringify({ error: 'contest_id is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    // 1. Count participants
    const { count: participantsCount, error: countError } = await supabaseClient
      .from('contest_participants')
      .select('*', { count: 'exact', head: true })
      .eq('contest_id', contest_id);

    if (countError) {
      console.error('Error counting participants:', countError);
      return new Response(JSON.stringify({ error: `DB error counting participants: ${countError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }
    const count = participantsCount ?? 0;

    // 2. Fetch contest details needed for updating the message
    const { data: contestData, error: contestFetchError } = await supabaseClient
      .from('contests')
      .select('telegram_message_id, telegram_chat_id, button_text_generated, button_url_generated')
      .eq('id', contest_id)
      .single();

    if (contestFetchError || !contestData) {
      console.error('Error fetching contest details for update:', contestFetchError);
      return new Response(JSON.stringify({ error: `Failed to fetch contest details: ${contestFetchError?.message || 'Not found'}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
      });
    }

    const { telegram_message_id, telegram_chat_id, button_text_generated, button_url_generated } = contestData;

    if (!telegram_message_id || !telegram_chat_id || !button_text_generated || !button_url_generated) {
      console.warn(`Contest ${contest_id} is missing Telegram message details or button URL/text. Cannot update button.`);
      // It's not a fatal error for the caller, but button won't be updated.
      return new Response(JSON.stringify({ success: false, message: 'Contest message details incomplete, cannot update button.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200, // Or 422 if you want to signal an issue
      });
    }
    
    // 3. Update Telegram message reply markup
    const newButtonText = `${button_text_generated} (${count})`;
    const replyMarkup = {
      inline_keyboard: [[{ text: newButtonText, url: button_url_generated }]]
    };

    const telegramApiUrl = `https://api.telegram.org/bot${telegramBotToken}/editMessageReplyMarkup`;
    const payload = {
      chat_id: telegram_chat_id,
      message_id: telegram_message_id,
      reply_markup: JSON.stringify(replyMarkup),
    };

    const tgResponse = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const tgResponseData = await tgResponse.json();

    if (!tgResponse.ok || !tgResponseData.ok) {
      console.error(`Telegram API error updating button for contest ${contest_id}:`, tgResponseData);
      // Common errors: message not found, message can't be edited, chat not found.
      // Not necessarily a server error, could be due to message deletion, etc.
      return new Response(JSON.stringify({ success: false, error: `Telegram API error: ${tgResponseData.description || 'Unknown error'}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: tgResponse.status,
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Participant count updated on button.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error) {
    console.error('Main function error in update-contest-participant-count:', error);
     if (error instanceof SyntaxError) { // JSON parsing error
        return new Response(JSON.stringify({ error: 'Invalid JSON in request body.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
        });
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal server error.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
