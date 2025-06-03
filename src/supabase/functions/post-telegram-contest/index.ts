
// @ts-ignore This directive suppresses the TypeScript error for the next line if the type definition file is not found locally.
/// <reference types="npm:@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

// Declare Deno as a global variable of type 'any' to satisfy TypeScript when Deno types are not fully resolved in the local environment.
declare var Deno: any;

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ContestConditionDetails {
  subscribeChannelLink?: string;
  reactToPost?: boolean;
  joinGroupLink?: string;
}
interface ContestDetailsFromClient {
  title: string;
  description: string;
  prize: string;
  imageUrl?: string;
  buttonText?: string; // Текст для кнопки "Участвовать" (может быть кастомным)
  numberOfWinners?: number;
  endDate?: string; 
  conditions?: ContestConditionDetails;
  targetChannelId?: string; // ID канала для публикации, если отличается от дефолтного
}

interface ContestRecordForDB {
    creator_user_id: string; // ID админа, создавшего конкурс
    telegram_message_id?: number;
    telegram_chat_id?: string;
    title: string;
    description: string;
    prize: string;
    image_url?: string;
    number_of_winners: number;
    end_date: string;
    conditions?: ContestConditionDetails;
    status: 'active' | 'ended' | 'cancelled';
    raw_telegram_response?: any;
    button_text_generated?: string;
    button_url_generated?: string;
}


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const formatDisplayDateTime = (isoDateString?: string): string => {
    if (!isoDateString) return 'не указана';
    try {
        const date = new Date(isoDateString);
        const options: Intl.DateTimeFormatOptions = {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' // Убедитесь, что часовой пояс корректен
        };
        const formatter = new Intl.DateTimeFormat('ru-RU', options);
        // Чтобы избежать проблем с разными форматами частей, формируем строку вручную
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
        const year = date.getFullYear();
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        
        return `${hour}:${minute} - ${day}.${month}.${year}`;
    } catch (e) {
        console.error("Error formatting date:", e, "Input was:", isoDateString);
        return 'некорректная дата';
    }
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let supabaseAdminClient: SupabaseClient | null = null;

  try {
    const supabaseUrl = Deno.env.get('APP_SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('APP_SERVICE_ROLE_KEY'); 
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const defaultTelegramChannelIdFromEnv = Deno.env.get('TELEGRAM_CHANNEL_ID'); 
    const telegramBotUsername = Deno.env.get('TELEGRAM_BOT_USERNAME_CONFIG');

    if (!supabaseUrl || !serviceRoleKey || !telegramBotToken || !telegramBotUsername) {
      console.error('Missing critical environment variables (Supabase URL/Service Key, Telegram Bot Token/Username).');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing critical credentials.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    
    supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: userError } = await supabaseAdminClient.auth.getUser(token);

    if (userError || !user) {
      console.error('User authentication error:', userError);
      return new Response(JSON.stringify({ error: 'Invalid token or user not authenticated.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    // Admin check logic would go here if needed, for now assuming user.id is creator.

    const body: ContestDetailsFromClient = await req.json();
    const { title, description, prize, imageUrl, numberOfWinners, endDate, conditions, targetChannelId, buttonText: userSuppliedButtonText } = body;

    const effectiveChannelId = targetChannelId && typeof targetChannelId === 'string' && targetChannelId.trim() !== ''
                                ? targetChannelId.trim()
                                : defaultTelegramChannelIdFromEnv;

    if (!effectiveChannelId) {
      console.error('Target channel ID is not specified and no default channel ID is configured.');
      return new Response(JSON.stringify({ error: 'Channel ID for posting is not configured.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    if (!title || !description || !prize || !numberOfWinners || !endDate) {
      return new Response(JSON.stringify({ error: 'Title, description, prize, number of winners, and end date are required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const contestDataForDB: Omit<ContestRecordForDB, 'telegram_message_id' | 'telegram_chat_id' | 'raw_telegram_response' | 'button_text_generated' | 'button_url_generated'> & { creator_user_id: string } = {
        creator_user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        prize: prize.trim(),
        image_url: imageUrl?.trim() || undefined,
        number_of_winners: numberOfWinners,
        end_date: new Date(endDate).toISOString(),
        conditions: conditions,
        status: 'active',
    };

    const { data: newContestArray, error: dbInsertError } = await supabaseAdminClient
        .from('contests')
        .insert(contestDataForDB)
        .select()
        .limit(1);

    if (dbInsertError || !newContestArray || newContestArray.length === 0) {
        console.error('Error saving contest to DB:', dbInsertError);
        return new Response(JSON.stringify({ error: `DB error saving contest: ${dbInsertError?.message || 'Failed to insert or retrieve new contest.'}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
        });
    }
    const newContest = newContestArray[0];
    const newContestId = newContest.id;

    let text = `🏆 *${title.trim()}* 🏆\n\n`;
    text += `${description.trim()}\n\n`;
    text += `🎁 *Приз:* ${prize.trim()}\n`;
    text += `👥 *Количество победителей:* ${numberOfWinners}\n`;
    text += `⏰ *Окончание конкурса:* ${formatDisplayDateTime(endDate)}\n\n`;

    if (conditions && (conditions.subscribeChannelLink || conditions.reactToPost || conditions.joinGroupLink)) {
        text += `*Условия участия:*\n`;
        if (conditions.subscribeChannelLink) {
            let link = conditions.subscribeChannelLink.trim();
            if (!link.startsWith('@') && !link.startsWith('https://t.me/')) link = `https://t.me/${link}`;
            text += `  - Подписаться на канал: ${link}\n`;
        }
        if (conditions.reactToPost) text += `  - Поставить реакцию на этот пост 👍\n`;
        if (conditions.joinGroupLink) {
             let link = conditions.joinGroupLink.trim();
            if (!link.startsWith('@') && !link.startsWith('https://t.me/')) link = `https://t.me/${link}`;
            text += `  - Вступить в группу/чат: ${link}\n`;
        }
        text += `\n`;
    }
    text += `Желаем удачи! ✨`;

    const generatedButtonText = userSuppliedButtonText?.trim() || 'Участвовать';
    const generatedButtonUrl = `https://t.me/${telegramBotUsername}?start=contest_${newContestId}`;

    const telegramPayload: any = {
      chat_id: effectiveChannelId,
      parse_mode: 'Markdown',
    };

    // Только если есть текст для кнопки, добавляем reply_markup
    if (generatedButtonText) {
        telegramPayload.reply_markup = {
            inline_keyboard: [[{ text: generatedButtonText, url: generatedButtonUrl }]]
        };
    }
    
    let telegramApiUrl;
    if (imageUrl && imageUrl.trim() !== '') {
        telegramApiUrl = `https://api.telegram.org/bot${telegramBotToken}/sendPhoto`;
        telegramPayload.photo = imageUrl.trim();
        telegramPayload.caption = text;
    } else {
        telegramApiUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
        telegramPayload.text = text;
    }

    const tgResponse = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telegramPayload),
    });

    const tgResponseData = await tgResponse.json();

    if (!tgResponse.ok || !tgResponseData.ok) {
      console.error(`Telegram API error for channel ${effectiveChannelId}:`, tgResponseData);
      await supabaseAdminClient.from('contests').delete().eq('id', newContestId);
      return new Response(JSON.stringify({ error: `Telegram API error: ${tgResponseData.description || 'Unknown error'}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: tgResponse.status,
      });
    }

    const updatePayload = {
        telegram_message_id: tgResponseData.result?.message_id,
        telegram_chat_id: tgResponseData.result?.chat?.id.toString(),
        raw_telegram_response: tgResponseData,
        button_text_generated: generatedButtonText, 
        button_url_generated: generatedButtonUrl,   
    };

    const { error: dbUpdateError } = await supabaseAdminClient
        .from('contests')
        .update(updatePayload)
        .eq('id', newContestId);

    if (dbUpdateError) {
        console.error('Error updating contest with Telegram info:', dbUpdateError);
    }

    return new Response(JSON.stringify({ 
        success: true, 
        message: `Конкурс опубликован в канал ${effectiveChannelId}!`, 
        contestId: newContestId,
        telegramResponse: tgResponseData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error) {
    console.error('Function error:', error);
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
