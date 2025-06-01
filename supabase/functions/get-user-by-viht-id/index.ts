// @ts-ignore This directive suppresses the TypeScript error for the next line if the type definition file is not found locally.
/// <reference types="npm:@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

// Declare Deno as a global variable of type 'any' to satisfy TypeScript when Deno types are not fully resolved in the local environment.
declare var Deno: any;

// supabase/functions/get-user-by-viht-id/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Эти переменные окружения должны быть установлены в настройках вашей функции в Supabase
const ADMIN_USER_VIHT_ID_SERVER = Deno.env.get('ADMIN_USER_VIHT_ID_CONFIG') || 'viht-3owuiauy';
const ADMIN_USER_EMAIL_SERVER = Deno.env.get('ADMIN_USER_EMAIL_CONFIG') || 'symmalop@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Разрешить запросы с любого источника
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Разрешены только POST и OPTIONS
};

serve(async (req: Request) => {
  // Обработка preflight-запроса (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Получение URL и ключа из переменных окружения функции
    const supabaseUrl = Deno.env.get('APP_SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('APP_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Supabase URL or Service Role Key is not set in environment variables for the function.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing Supabase credentials.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Инициализация Admin-клиента Supabase с указанием схемы 'auth'
    const supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: { schema: 'auth' } // <--- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Указываем схему 'auth'
    });

    // Проверка авторизации вызывающего пользователя (должен быть админ)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callingUser }, error: userError } = await supabaseAdminClient.auth.getUser(token);

    if (userError || !callingUser) {
      console.error('Auth error for calling user:', userError);
      return new Response(JSON.stringify({ error: 'Invalid token or calling user not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Проверка, является ли вызывающий пользователь администратором
    // Обратите внимание: user_metadata получается из raw_user_meta_data в auth.users
    const isAdmin = callingUser.email === ADMIN_USER_EMAIL_SERVER &&
                    callingUser.user_metadata?.user_viht_id === ADMIN_USER_VIHT_ID_SERVER;

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Access denied. Admin privileges required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Получение ID для поиска из тела запроса
    if (req.body === null) {
        return new Response(JSON.stringify({ error: 'Request body is missing.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
    const body = await req.json();
    const { viht_id_to_search } = body;

    if (!viht_id_to_search || typeof viht_id_to_search !== 'string') {
      return new Response(JSON.stringify({ error: 'viht_id_to_search (string) is required in the request body' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Поиск пользователя в таблице auth.users (теперь .from('users') будет работать с auth.users)
    const { data: foundUsers, error: dbError } = await supabaseAdminClient
      .from('users') // Теперь это будет искать в auth.users из-за опции клиента
      .select('id, email, raw_user_meta_data')
      .eq('raw_user_meta_data->>user_viht_id', viht_id_to_search)
      .limit(1);

    if (dbError) {
      console.error('Database search error:', dbError);
      // Не отправляйте детали ошибки базы данных клиенту напрямую в продакшене
      return new Response(JSON.stringify({ error: 'An error occurred while searching for the user. Check function logs.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (foundUsers && foundUsers.length > 0) {
      const userToReturn = {
        id: foundUsers[0].id,
        email: foundUsers[0].email,
        user_metadata: foundUsers[0].raw_user_meta_data, // raw_user_meta_data используется на клиенте как user_metadata
        // Добавьте другие поля из auth.users если они нужны клиенту, например:
        // created_at: foundUsers[0].created_at, 
        // last_sign_in_at: foundUsers[0].last_sign_in_at,
      };
      return new Response(JSON.stringify(userToReturn), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      return new Response(JSON.stringify({ error: `User not found with viht_id: ${viht_id_to_search}` }), { // Более информативно
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }
  } catch (error) {
    console.error('General error in Edge Function get-user-by-viht-id:', error);
    if (error instanceof SyntaxError) { // Ошибка парсинга JSON из тела запроса
        return new Response(JSON.stringify({ error: 'Invalid JSON in request body.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error. Check function logs.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
