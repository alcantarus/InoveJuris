import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');
  const redirectUri = `${new URL(request.url).origin}/api/auth/email/callback`;

  if (!provider) {
    return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
  }

  let authUrl = '';

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: 'Google Client ID not configured' }, { status: 500 });
    }
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://mail.google.com/ email profile',
      access_type: 'offline',
      prompt: 'consent', // Force refresh token
      state: 'google',
    });
    
    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  } else if (provider === 'outlook') {
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: 'Outlook Client ID not configured' }, { status: 500 });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://outlook.office.com/SMTP.Send offline_access user.read',
      state: 'outlook',
    });

    // Use the common endpoint for multi-tenant or personal accounts
    authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  } else {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  return NextResponse.json({ url: authUrl });
}
