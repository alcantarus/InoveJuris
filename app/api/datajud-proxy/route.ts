import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { process_number } = await req.json();
  
  if (!process_number) {
    return NextResponse.json({ error: "Faltando process_number" }, { status: 400 });
  }

  try {
    // URL do DataJUD
    const targetUrl = `https://api.datajud.cnj.jus.br/api/v1/processos/${process_number}`;
    
    // URL do Proxy (ScraperAPI)
    const proxyUrl = `http://api.scraperapi.com?api_key=${process.env.SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}`;

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: { 
        "Authorization": `APIKey ${process.env.DATAJUD_API_TOKEN}`,
        "Content-Type": "application/json"
      }
    });
    
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error("[Proxy] Erro:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
