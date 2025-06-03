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

interface Contest {
  id: string;
  title: string;
  end_date: string;
  status: 'active' | 'ended' | 'cancelled';
  conditions?: ContestConditionDetails | null;
  number_of_winners: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function checkTelegramMembership(botToken: string, chatId: string, userId: number): Promise<boolean> {
  // chatId for channels can be @channelusername or channel_id
  // For private channels/groups, bot must be an admin or member to check.
  const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${userId}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.ok) {
      const status = data.result.status;
      return status === 'member' || status === 'administrator' || status === 'creator';
    } else {
      console.warn(`Telegram API error checking membership for user ${userId} in chat ${chatId}: ${data.description}`);
      return false; // Assume not a member if API error or bot doesn't have permission
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

  let supabaseClient: SupabaseClient | null = null;

  try {
    const supabaseUrl = Deno.env.get('APP_SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('APP_SERVICE_ROLE_KEY');
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');


    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase URL or Service Role Key.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing Supabase credentials.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }
    // Note: Do not require TELEGRAM_BOT_TOKEN here as it's optional for message sending,
    // but it WILL be required if condition checking is implemented.

    supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // For Edge Functions called by a trusted backend (like your Telegram bot),
    // you might use a secret header for auth instead of Supabase JWT.
    // For now, assuming this function is protected and can be called with service_role.

    const body = await req.json();
    const { contest_id, telegram_user_id, telegram_username } = body;

    if (!contest_id || !telegram_user_id) {
      return new Response(JSON.stringify({ error: 'contest_id and telegram_user_id are required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }
    if (typeof telegram_user_id !== 'number') {
        return new Response(JSON.stringify({ error: 'telegram_user_id must be a number.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
        });
    }


    // 1. Fetch contest details
    const { data: contest, error: contestError } = await supabaseClient!
      .from('contests')
      .select('id, title, end_date, status, conditions, number_of_winners')
      .eq('id', contest_id)
      .single(); // Removed <Contest> type argument

    if (contestError || !contest) {
      console.error('Error fetching contest or contest not found:', contestError);
      return new Response(JSON.stringify({ error: `Contest not found or DB error: ${contestError?.message || 'Not found'}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
      });
    }

    // 2. Check contest status and end date
    if (contest.status !== 'active' || new Date(contest.end_date) < new Date()) {
      let reason = 'Конкурс больше не активен.';
      if (contest.status === 'ended') reason = 'Конкурс завершен.';
      else if (contest.status === 'cancelled') reason = 'Конкурс был отменен.';
      else if (new Date(contest.end_date) < new Date()) reason = 'Время проведения конкурса истекло.';
      
      return new Response(JSON.stringify({ success: false, error: reason }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403, // Forbidden
      });
    }

    // 3. Check if user already participated
    const { data: existingParticipant, error: participantCheckError } = await supabaseClient
      .from('contest_participants')
      .select('id')
      .eq('contest_id', contest_id)
      .eq('telegram_user_id', telegram_user_id)
      .maybeSingle();

    if (participantCheckError) {
      console.error('Error checking existing participant:', participantCheckError);
      return new Response(JSON.stringify({ error: `DB error checking participation: ${participantCheckError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }

    if (existingParticipant) {
      return new Response(JSON.stringify({ success: false, message_to_user: "Вы уже участвуете в этом конкурсе! 😉", error: "User already participated." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200, // Or 409 Conflict
      });
    }

    // 4. Check conditions (if any and bot token is available)
    const conditionsMetSnapshot: Record<string, boolean> = {};
    let conditionsTextForUser = "";
    let allRequiredConditionsMet = true; // Assume true unless a required condition fails

    if (contest.conditions && telegramBotToken) {
        const conditions = contest.conditions as ContestConditionDetails; // Assert type for conditions
        const conditionChecks: Promise<void>[] = [];
        let conditionsListForMsg = [];

        if (conditions.subscribeChannelLink) {
            const channelIdOrUsername = conditions.subscribeChannelLink.startsWith('@') ? conditions.subscribeChannelLink : conditions.subscribeChannelLink.split('/').pop() || conditions.subscribeChannelLink;
            conditionChecks.push(
                checkTelegramMembership(telegramBotToken, channelIdOrUsername, telegram_user_id).then(isMember => {
                    conditionsMetSnapshot['subscribed_channel_' + channelIdOrUsername.replace('@','')] = isMember;
                    if (!isMember) allRequiredConditionsMet = false;
                    conditionsListForMsg.push(`- Подписка на ${conditions.subscribeChannelLink} ${isMember ? '✅' : '❌ (не выполнено!)'}`);
                })
            );
        }
        if (conditions.joinGroupLink) {
            const groupIdOrUsername = conditions.joinGroupLink.startsWith('@') ? conditions.joinGroupLink : conditions.joinGroupLink.split('/').pop() || conditions.joinGroupLink;
             conditionChecks.push(
                checkTelegramMembership(telegramBotToken, groupIdOrUsername, telegram_user_id).then(isMember => {
                    conditionsMetSnapshot['joined_group_' + groupIdOrUsername.replace('@','')] = isMember;
                    if (!isMember) allRequiredConditionsMet = false;
                    conditionsListForMsg.push(`- Вступление в ${conditions.joinGroupLink} ${isMember ? '✅' : '❌ (не выполнено!)'}`);
                })
            );
        }
        if (conditions.reactToPost) {
             conditionsListForMsg.push(`- Поставить реакцию на пост конкурса (проверяется вручную)`);
             conditionsMetSnapshot['reacted_to_post'] = false; // Cannot verify automatically
        }
        
        await Promise.all(conditionChecks); // Wait for all async checks to complete

        if (conditionsListForMsg.length > 0) {
            conditionsTextForUser = "\n\n📋 Статус выполнения условий:\n" + conditionsListForMsg.join("\n");
        }
    } else if (contest.conditions) {
        // No bot token, cannot verify. Just list them for user.
        let conditionsListForMsg = [];
        const conditions = contest.conditions as ContestConditionDetails; // Assert type
        if (conditions.subscribeChannelLink) conditionsListForMsg.push(`- Подписка на ${conditions.subscribeChannelLink}`);
        if (conditions.joinGroupLink) conditionsListForMsg.push(`- Вступление в ${conditions.joinGroupLink}`);
        if (conditions.reactToPost) conditionsListForMsg.push(`- Поставить реакцию на пост конкурса`);
        if (conditionsListForMsg.length > 0) {
             conditionsTextForUser = "\n\n❗ Не забудьте выполнить условия (если еще не сделали):\n" + conditionsListForMsg.join("\n");
        }
    }

    // For now, we register participant even if not all conditions met, snapshot indicates status.
    // Later, this can be stricter based on requirements.

    // 5. Add participant to DB
    const { error: insertError } = await supabaseClient
      .from('contest_participants')
      .insert({
        contest_id: contest_id,
        telegram_user_id: telegram_user_id,
        telegram_username: telegram_username || null,
        conditions_met_snapshot: conditionsMetSnapshot,
      });

    if (insertError) {
      console.error('Error inserting participant:', insertError);
      return new Response(JSON.stringify({ error: `DB error inserting participant: ${insertError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }

    // 6. Prepare and optionally send confirmation message
    let messageToUser = `🎉 Поздравляем! Вы успешно зарегистрированы в конкурсе "${contest.title}"!`;
    messageToUser += conditionsTextForUser;
    if (!allRequiredConditionsMet && telegramBotToken && contest.conditions) {
         messageToUser += `\n\n⚠️ Пожалуйста, убедитесь, что все обязательные условия выполнены, чтобы ваш голос был засчитан при подведении итогов.`;
    } else {
        messageToUser += `\n\nЖелаем удачи! 🍀`;
    }

    let messageSentToTelegram = false;
    if (telegramBotToken) {
      try {
        const sendMessageUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
        const tgResponse = await fetch(sendMessageUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: telegram_user_id, text: messageToUser, parse_mode: 'Markdown' }),
        });
        const tgData = await tgResponse.json();
        if (tgData.ok) {
          messageSentToTelegram = true;
        } else {
          console.warn(`Failed to send confirmation message to user ${telegram_user_id} via Telegram: ${tgData.description}`);
        }
      } catch (e) {
        console.error('Error sending Telegram confirmation message:', e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message_to_user: messageToUser,
      message_sent_to_telegram: messageSentToTelegram
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error) {
    console.error('Main function error:', error);
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
