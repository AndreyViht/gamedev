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

interface ContestFromDB {
  id: string;
  title: string;
  number_of_winners: number;
  conditions?: ContestConditionDetails | null;
  telegram_message_id?: number | null;
  telegram_chat_id?: string | null;
  image_url?: string | null; // Added for potentially re-sending image if text changes significantly
  prize: string; // Added for context in winner message
}

interface ContestParticipant {
  id: string; // participant_id
  telegram_user_id: number;
  telegram_username?: string | null;
  conditions_met_snapshot?: Record<string, boolean> | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or your specific domain
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Consider GET if cron calls via GET
};

// Fisher-Yates (aka Knuth) Shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
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

    if (!supabaseUrl || !serviceRoleKey || !telegramBotToken) {
      console.error('Missing Supabase URL, Service Role Key, or Telegram Bot Token.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing critical credentials.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }

    supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // This function should be protected, e.g., by a secret header if called by cron,
    // or ensure it's only callable by admin roles if exposed via API gateway.
    // For Supabase cron, the service_role key already provides admin-level access.

    // 1. Find contests that have ended and winners not yet announced
    const now = new Date().toISOString();
    const { data: contestsToEnd, error: fetchContestsError } = await supabaseClient
      .from('contests')
      .select('id, title, number_of_winners, conditions, telegram_message_id, telegram_chat_id, image_url, prize')
      .eq('status', 'active')
      .eq('winners_announced', false)
      .lt('end_date', now);

    if (fetchContestsError) {
      console.error('Error fetching contests to end:', fetchContestsError);
      return new Response(JSON.stringify({ error: `DB error fetching contests: ${fetchContestsError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }

    if (!contestsToEnd || contestsToEnd.length === 0) {
      return new Response(JSON.stringify({ message: 'No contests to end at this time.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    let contestsProcessed = 0;
    const processingErrors: string[] = [];

    for (const contest of contestsToEnd as ContestFromDB[]) {
      try {
        // 2. Get all participants for the contest
        const { data: participants, error: fetchParticipantsError } = await supabaseClient
          .from('contest_participants')
          .select('id, telegram_user_id, telegram_username, conditions_met_snapshot')
          .eq('contest_id', contest.id);

        if (fetchParticipantsError) {
          console.error(`Error fetching participants for contest ${contest.id}:`, fetchParticipantsError);
          processingErrors.push(`Failed to fetch participants for contest ${contest.title}.`);
          continue;
        }

        if (!participants || participants.length === 0) {
          // No participants, just end the contest
           await supabaseClient
            .from('contests')
            .update({ status: 'ended', winners_announced: true }) // Mark as announced even if no winners
            .eq('id', contest.id);

          if (contest.telegram_message_id && contest.telegram_chat_id) {
             const noParticipantsMessage = `Конкурс "${contest.title}" завершен.\n\nК сожалению, в этот раз не было участников. 😕`;
             await fetch(`https://api.telegram.org/bot${telegramBotToken}/editMessageText`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: contest.telegram_chat_id,
                    message_id: contest.telegram_message_id,
                    text: noParticipantsMessage,
                    reply_markup: JSON.stringify({ inline_keyboard: [] }) // Remove button
                }),
            });
          }
          contestsProcessed++;
          continue;
        }

        // 3. Filter participants based on conditions
        let qualifiedParticipants = participants as ContestParticipant[];
        if (contest.conditions) {
          const conditions = contest.conditions as ContestConditionDetails; // Type assertion
          qualifiedParticipants = participants.filter(p => {
            if (!p.conditions_met_snapshot) return false; // Must have snapshot
            let metAll = true;
            if (conditions.subscribeChannelLink) {
              const key = `subscribed_channel_${(conditions.subscribeChannelLink.startsWith('@') ? conditions.subscribeChannelLink : conditions.subscribeChannelLink.split('/').pop() || conditions.subscribeChannelLink).replace('@','')}`;
              if (!p.conditions_met_snapshot[key]) metAll = false;
            }
            if (conditions.joinGroupLink) {
              const key = `joined_group_${(conditions.joinGroupLink.startsWith('@') ? conditions.joinGroupLink : conditions.joinGroupLink.split('/').pop() || conditions.joinGroupLink).replace('@','')}`;
              if (!p.conditions_met_snapshot[key]) metAll = false;
            }
            // Note: reactToPost is not auto-verified, so not filtered here strictly.
            // If reactToPost was required, it should have been checked before saving participant or at this stage if possible.
            return metAll;
          });
        }
        
        // 4. Select winners
        let selectedWinners: ContestParticipant[] = [];
        if (qualifiedParticipants.length > 0) {
            const shuffledParticipants = shuffleArray(qualifiedParticipants);
            selectedWinners = shuffledParticipants.slice(0, contest.number_of_winners);
        }
        

        // 5. Save winners to DB
        if (selectedWinners.length > 0) {
          const winnerRecords = selectedWinners.map(w => ({
            contest_id: contest.id,
            participant_id: w.id, // This is contest_participants.id
          }));
          const { error: saveWinnersError } = await supabaseClient
            .from('contest_winners')
            .insert(winnerRecords);

          if (saveWinnersError) {
            console.error(`Error saving winners for contest ${contest.id}:`, saveWinnersError);
            processingErrors.push(`Failed to save winners for contest ${contest.title}.`);
            continue; 
          }
        }

        // 6. Update contest status
        const { error: updateContestError } = await supabaseClient
          .from('contests')
          .update({ status: 'ended', winners_announced: true })
          .eq('id', contest.id);

        if (updateContestError) {
          console.error(`Error updating contest status for ${contest.id}:`, updateContestError);
          processingErrors.push(`Failed to update status for contest ${contest.title}.`);
          // Continue to try and announce, as winners might be saved.
        }

        // 7. Announce winners in Telegram
        if (contest.telegram_message_id && contest.telegram_chat_id) {
          let winnerMessage = `🎉 Конкурс "${contest.title}" завершен! 🎉\n\n`;
          if (selectedWinners.length > 0) {
            winnerMessage += `Поздравляем наших победителей, которые получают: *${contest.prize}*!\n\n`;
            selectedWinners.forEach(winner => {
              if (winner.telegram_username) {
                winnerMessage += `🏆 @${winner.telegram_username}\n`;
              } else {
                winnerMessage += `🏆 [Пользователь ${winner.telegram_user_id}](tg://user?id=${winner.telegram_user_id})\n`;
              }
            });
            winnerMessage += `\nСвяжитесь с администрацией для получения приза, если это необходимо.`;
          } else if (participants.length > 0 && qualifiedParticipants.length === 0) {
             winnerMessage += `К сожалению, никто из участников не выполнил все обязательные условия. 😕`;
          } else {
             winnerMessage += `В этот раз у нас нет победителей, так как не было квалифицированных участников.`;
          }

          // Edit original message text and remove button
          const tgApiUrl = `https://api.telegram.org/bot${telegramBotToken}/editMessageText`;
          const payload = {
            chat_id: contest.telegram_chat_id,
            message_id: contest.telegram_message_id,
            text: winnerMessage,
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: [] }) // Remove button
          };

          const tgResponse = await fetch(tgApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const tgResponseData = await tgResponse.json();
          if (!tgResponse.ok || !tgResponseData.ok) {
            console.error(`Telegram API error updating message for contest ${contest.id}:`, tgResponseData);
            processingErrors.push(`Failed to announce winners in Telegram for contest ${contest.title}. Description: ${tgResponseData.description}`);
          }
        }
        contestsProcessed++;
      } catch (innerError: any) {
        console.error(`Error processing contest ${contest.id} (${contest.title}):`, innerError);
        processingErrors.push(`Error processing contest ${contest.title}: ${innerError.message}`);
      }
    }

    if (processingErrors.length > 0) {
      return new Response(JSON.stringify({ 
        message: `Processed ${contestsProcessed} contest(s) with ${processingErrors.length} error(s).`,
        errors: processingErrors 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 207, // Multi-Status
      });
    }

    return new Response(JSON.stringify({ message: `Successfully processed ${contestsProcessed} contest(s).` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error) {
    console.error('General function error in select-contest-winners:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
