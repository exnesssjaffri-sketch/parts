import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const jwtSecret = Deno.env.get('JWT_SECRET') || 'auto-marts-jwt-secret-change-in-production';

interface OAuthCallbackPayload {
  code: string;
  redirect_uri: string;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    user_metadata: Record<string, unknown>;
  };
}

async function generateJwt(payload: Record<string, unknown>): Promise<string> {
  const key = new TextEncoder().encode(jwtSecret);
  const header = new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const expiresIn = 604800;
  const claims = new TextEncoder().encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + expiresIn }));

  const signature = await crypto.subtle.sign(
    'HMACSHA256',
    key,
    new Uint8Array([...header, ...new TextEncoder().encode('.'), ...claims])
  );

  const b64url = (b: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(b)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${b64url(header as ArrayBuffer)}.${b64url(claims)}.${b64url(signature)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { code, redirect_uri } = await req.json() as OAuthCallbackPayload;

  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing authorization code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const response = await fetch('https://dsyjerhfuldpcoshaicl.supabase.co/auth/v1/token?grant_type=authorization_code', {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, redirect_to: redirect_uri || '/' }),
    });

    const data = await response.json() as OAuthTokenResponse;

    if (!data.access_token || !data.user) {
      return new Response(JSON.stringify({ error: 'Failed to exchange code for session' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const metadata = data.user.user_metadata || {};
    const firstName = (metadata.first_name as string) || (metadata.full_name as string)?.split(' ')[0] || '';
    const lastName = (metadata.last_name as string) || (metadata.full_name as string)?.split(' ').slice(1).join(' ') || '';

    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('email', data.user.email)
      .maybeSingle();

    if (fetchError) throw fetchError;

    let appUserId: number | null = existingUser?.id || null;

    if (!appUserId) {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          email: data.user.email,
          password_hash: '',
          first_name: firstName,
          last_name: lastName,
          phone: null,
          is_admin: false,
          is_active: true,
          email_verified: true,
        }])
        .select()
        .single();

      if (insertError) throw insertError;
      appUserId = newUser.id;
    }

    const jwt = await generateJwt({
      sub: String(appUserId),
      email: data.user.email,
      provider: 'google',
      iat: Math.floor(Date.now() / 1000),
    });

    return new Response(JSON.stringify({
      session_token: jwt,
      user_id: appUserId,
      email: data.user.email,
      first_name: firstName,
      last_name: lastName,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
