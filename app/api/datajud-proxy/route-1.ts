import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { process_number } = await req.json();
  
  if (!process_number) {
    return NextResponse.json({ error: "Faltando process_number" }, { status: 400 });
  }

  try {
    console.log(`[Proxy] Consultando DataJUD para: ${process_number}`);
    
    const token = process.env.DATAJUD_API_TOKEN;
    const scraperApiKey = process.env.SCRAPER_API_KEY;
    
    if (!token || !scraperApiKey) {
      console.error("[Proxy] Erro: DATAJUD_API_TOKEN ou SCRAPER_API_KEY não configurado.");
      return NextResponse.json({ error: "Configuração incompleta" }, { status: 500 });
    }

    const targetUrl = `https://api.datajud.cnj.jus.br/api/v1/processos/${process_number}`;
    const proxyUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(targetUrl)}`;
    
    console.log(`[Proxy] URL de consulta via ScraperAPI: ${proxyUrl}`);

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: { 
        "Authorization": `APIKey ${token}`,
        "Content-Type": "application/json"
      }
    });
    
    console.log(`[Proxy] Resposta DataJUD: ${response.status}`);
    
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error("[Proxy] Erro na requisição:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
