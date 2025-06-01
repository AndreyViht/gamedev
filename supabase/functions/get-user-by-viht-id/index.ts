// @ts-ignore This directive suppresses the TypeScript error for the next line if the type definition file is not found locally.
/// <reference types="npm:@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

// Declare Deno as a global variable of type 'any' to satisfy TypeScript when Deno types are not fully resolved in the local environment.
declare var Deno: any;

// supabase/functions/get-user-by-viht-id/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface AdminUserConfig {
  email: string;
  viht_id: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('APP_SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('APP_SERVICE_ROLE_KEY');
    const adminUsersJson = Deno.env.get('ADMIN_USERS_JSON'); // Новая переменная окружения

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Supabase URL or Service Role Key is not set for the function.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing Supabase credentials.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
     if (!adminUsersJson) {
      console.error('ADMIN_USERS_JSON is not set in environment variables for the function.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing admin users configuration.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    let configuredAdminUsers: AdminUserConfig[] = [];
    try {
        configuredAdminUsers = JSON.parse(adminUsersJson);
        if (!Array.isArray(configuredAdminUsers) || !configuredAdminUsers.every(u => u.email && u.viht_id)) {
            throw new Error("ADMIN_USERS_JSON is not a valid array of {email, viht_id} objects.");
        }
    } catch (e) {
        console.error('Error parsing ADMIN_USERS_JSON:', e.message);
        return new Response(JSON.stringify({ error: 'Server configuration error: Invalid admin users configuration format.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }


    const supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'auth' }
    });

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
      console.error('Auth error for calling user:', userError?.message);
      return new Response(JSON.stringify({ error: 'Invalid token or calling user not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const isAdmin = configuredAdminUsers.some(admin =>
      callingUser.email === admin.email &&
      callingUser.user_metadata?.user_viht_id === admin.viht_id
    );

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Access denied. Admin privileges required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

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

    const { data: foundUsers, error: dbError } = await supabaseAdminClient
      .from('users')
      .select('id, email, raw_user_meta_data, last_sign_in_at') // Добавлено last_sign_in_at для полноты UserProfile
      .eq('raw_user_meta_data->>user_viht_id', viht_id_to_search)
      .limit(1);

    if (dbError) {
      console.error('Database search error:', dbError.message);
      return new Response(JSON.stringify({ error: 'An error occurred while searching for the user. Check function logs.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (foundUsers && foundUsers.length > 0) {
      const userToReturn = {
        id: foundUsers[0].id,
        email: foundUsers[0].email,
        user_metadata: foundUsers[0].raw_user_meta_data,
        last_sign_in_at: foundUsers[0].last_sign_in_at, // Добавлено
      };
      return new Response(JSON.stringify(userToReturn), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      return new Response(JSON.stringify({ error: `User not found with viht_id: ${viht_id_to_search}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }
  } catch (error) {
    console.error('General error in Edge Function get-user-by-viht-id:', error.message);
    if (error instanceof SyntaxError) {
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
