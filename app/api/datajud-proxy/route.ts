import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { process_number } = await req.json();
  
  if (!process_number) {
    return NextResponse.json({ error: "Faltando process_number" }, { status: 400 });
  }

  try {
    const token = process.env.DATAJUD_API_TOKEN;
    const scraperApiKey = process.env.SCRAPER_API_KEY;
    
    if (!token || !scraperApiKey) {
      return NextResponse.json({ error: "Configuração incompleta" }, { status: 500 });
    }

    const targetUrl = `https://api.datajud.cnj.jus.br/api/v1/processos/${process_number}`;
    const proxyUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(targetUrl)}`;
    
    console.log(`[Proxy] URL de consulta via ScraperAPI: ${proxyUrl}`);

    // Timeout de 8 segundos para não travar a Vercel
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: { 
        "Authorization": `APIKey ${token}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal // Conecta o timeout ao fetch
    });
    
    clearTimeout(timeout); // Limpa o timeout se responder antes
    
    console.log(`[Proxy] Resposta DataJUD: ${response.status}`);
    
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });

  } catch (error: any) {
    console.error("[Proxy] Erro na requisição:", error);
    
    // Se for timeout, retornamos 504 (Gateway Timeout)
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: "Timeout: O serviço de proxy demorou a responder." }, { status: 504 });
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
