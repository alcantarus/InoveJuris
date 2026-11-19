import { NextResponse } from 'next/server'
import { fetchDatajud } from '@/lib/datajud'
import { authErrorResponse, requireSessionContext } from '@/lib/server-auth'

export async function POST(req: Request) {
  try {
    await requireSessionContext()

    const { processNumber } = await req.json()

    if (!processNumber) {
      return NextResponse.json({ error: 'Número do processo é obrigatório' }, { status: 400 })
    }

    const apiKey = process.env.DATAJUD_API_KEY
    const result = await fetchDatajud(String(processNumber), apiKey || '')

    return NextResponse.json(result)
  } catch (error: any) {
    const unauthorized = authErrorResponse(error)
    if (unauthorized) return unauthorized

    const message = error?.message || 'Erro interno na consulta'
    console.error('[process-consultation] erro:', message)

    const status = message.includes('DATAJUD_API_KEY') || message.includes('inválida')
      ? 500
      : message.includes('inválido') || message.includes('não suportado')
        ? 400
        : message.includes('não encontrado')
          ? 404
          : 502

    return NextResponse.json({ error: message }, { status })
  }
}
