import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { process_number } = await req.json();
  
  if (!process_number) {
    return NextResponse.json({ error: "Faltando process_number" }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.datajud.cnj.jus.br/api/v1/processos/${process_number}`, {
      method: 'GET',
      headers: { 
        "Authorization": `APIKey ${process.env.DATAJUD_API_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
