import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { process_number } = await req.json();
  
  if (!process_number) {
    return NextResponse.json({ error: "Faltando process_number" }, { status: 400 });
  }

  try {
    console.log(`[Proxy] Consultando DataJUD para: ${process_number}`);
    
    const token = process.env.DATAJUD_API_TOKEN;
    if (!token) {
      console.error("[Proxy] Erro: DATAJUD_API_TOKEN não configurado.");
      return NextResponse.json({ error: "Token não configurado" }, { status: 500 });
    }

    const response = await fetch(`https://api.datajud.cnj.jus.br/api/v1/processos/${process_number}`, {
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
