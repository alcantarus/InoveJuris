import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { defaultUrlProd, defaultKeyProd } from '@/lib/supabase';

// Helper to get Supabase client with Service Role Key
const getSupabase = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  const supabaseKey = serviceRoleKey || defaultKeyProd;
  
  return createClient(defaultUrlProd, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // 'google' or 'outlook'
  const error = searchParams.get('error');

  if (error) {
    return new NextResponse(`<html><body><script>window.opener.postMessage({ type: 'OAUTH_ERROR', error: '${error}' }, '*'); window.close();</script></body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!code || !state) {
    return new NextResponse(`<html><body><script>window.opener.postMessage({ type: 'OAUTH_ERROR', error: 'Missing code or state' }, '*'); window.close();</script></body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const redirectUri = `${new URL(request.url).origin}/api/auth/email/callback`;
  let tokenData: any = {};
  let userEmail = '';

  try {
    if (state === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) throw new Error('Google credentials missing');

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const err = await tokenResponse.text();
        throw new Error(`Google token error: ${err}`);
      }

      tokenData = await tokenResponse.json();

      // Get user info
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = await userResponse.json();
      userEmail = userData.email;

    } else if (state === 'outlook') {
      const clientId = process.env.OUTLOOK_CLIENT_ID;
      const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;

      if (!clientId || !clientSecret) throw new Error('Outlook credentials missing');

      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const err = await tokenResponse.text();
        throw new Error(`Outlook token error: ${err}`);
      }

      tokenData = await tokenResponse.json();

      // Get user info
      const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = await userResponse.json();
      userEmail = userData.mail || userData.userPrincipalName;
    }

    // Store tokens in system_settings
    const supabase = getSupabase();
    
    // We store separate settings for each provider
    const settingKey = `email_oauth_${state}`; // email_oauth_google or email_oauth_outlook
    
    // Store tokens securely (ideally encrypted, but for now plaintext as per constraints)
    await supabase.from('system_settings').upsert({
      key: settingKey,
      value: {
        provider: state,
        email: userEmail,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expiry_date: Date.now() + (tokenData.expires_in * 1000),
        connected_at: new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '.000Z',
      },
      category: 'integration',
      description: `OAuth2 tokens for ${state} email integration`,
      updated_at: new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '.000Z',
    }, { onConflict: 'key' });

    // Also update the main smtp_config to use this provider if desired?
    // Or just let the user select it. For now, we just store the connection.

    return new NextResponse(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_SUCCESS', provider: '${state}', email: '${userEmail}' }, '*');
              window.close();
            } else {
              document.body.innerHTML = 'Authentication successful! You can close this window.';
            }
          </script>
          <p>Authentication successful. Closing...</p>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (err: any) {
    console.error('OAuth Callback Error:', err);
    return new NextResponse(`<html><body><script>window.opener.postMessage({ type: 'OAUTH_ERROR', error: '${err.message}' }, '*'); window.close();</script></body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
