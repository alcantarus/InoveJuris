// Proxy público e somente leitura para a API do DJEN.
// Motivo: o CloudFront do DJEN devolve 403 para o egress da Vercel (a mesma URL
// responde 200 localmente). O egress das Edge Functions do Supabase é distinto.
// Segurança: o host e o caminho de destino são fixos; apenas query params são
// repassados, portanto não é possível usar esta função como proxy arbitrário.

const DJEN_API_URL = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const incoming = new URL(req.url)
  const target = new URL(DJEN_API_URL)
  incoming.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value)
  })

  let upstream: Response
  try {
    upstream = await fetch(target.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        Referer: 'https://comunicaapi.pje.jus.br/swagger/index.html',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Falha de rede ao consultar o DJEN: ${String(error)}` }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  const body = await upstream.text()
  const region = Deno.env.get('DENO_REGION')
    || Deno.env.get('FLY_REGION')
    || Deno.env.get('SB_REGION')
    || 'unknown'
  console.log(`[djen-proxy] region=${region} status=${upstream.status} url=${target.toString()}`)

  return new Response(body, {
    status: upstream.status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store',
      'X-Djen-Proxy': 'hit',
      'X-Djen-Proxy-Region': region,
      'X-Djen-RateLimit-Remaining': upstream.headers.get('x-ratelimit-remaining') || '',
      'X-Djen-RateLimit-Limit': upstream.headers.get('x-ratelimit-limit') || '',
      'X-Djen-RateLimit-Reset': upstream.headers.get('x-ratelimit-reset') || '',
    },
  })
})
