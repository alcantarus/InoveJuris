import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { process_number } = await req.json();
  
  if (!process_number) {
    return NextResponse.json({ error: "Faltando process_number" }, { status: 400 });
  }

  try {
    const targetUrl = `https://api.datajud.cnj.jus.br/api/v1/processos/${process_number}`;
    const scraperApiKey = process.env.SCRAPER_API_KEY;
    
    // URL do Proxy (ScraperAPI)
    const proxyUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(targetUrl)}`;
    
    console.log(`[Proxy] Consultando via ScraperAPI: ${process_number}`);

    // Timeout de 25 segundos (mais tempo para o DataJUD responder)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: { 
        // O ScraperAPI já lida com a autenticação, removemos o Authorization daqui
        "Content-Type": "application/json"
      },
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });

  } catch (error: any) {
    console.error("[Proxy] Erro:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
