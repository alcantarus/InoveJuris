import { NextResponse } from 'next/server'

// Mapping of CNJ Tribunal Codes (J.TR) to Datajud slugs
const TRIBUNAL_MAP: Record<string, string> = {
  '8.26': 'tjsp',
  '8.13': 'tjmg',
  '8.19': 'tjrj',
  '8.05': 'tjba',
  '8.06': 'tjce',
  '8.07': 'tjdft',
  '8.08': 'tjes',
  '8.09': 'tjgo',
  '8.10': 'tjma',
  '8.11': 'tjmt',
  '8.12': 'tjms',
  '8.14': 'tjpa',
  '8.15': 'tjpb',
  '8.16': 'tjpr',
  '8.17': 'tjpe',
  '8.18': 'tjpi',
  '8.20': 'tjrn',
  '8.21': 'tjrs',
  '8.22': 'tjro',
  '8.23': 'tjrr',
  '8.24': 'tjsc',
  '8.25': 'tjse',
  '8.27': 'tjtoc',
  '4.01': 'trf1',
  '4.02': 'trf2',
  '4.03': 'trf3',
  '4.04': 'trf4',
  '4.05': 'trf5',
  '4.06': 'trf6',
  '5.01': 'trt1',
  '5.02': 'trt2',
  '5.03': 'trt3',
  '5.04': 'trt4',
  '5.05': 'trt5',
  '5.15': 'trt15',
}

export async function POST(req: Request) {
  try {
    const { processNumber } = await req.json()

    if (!processNumber) {
      return NextResponse.json({ error: 'Número do processo é obrigatório' }, { status: 400 })
    }

    const apiKey = process.env.DATAJUD_API_KEY || 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=='
    
    // Clean number for Datajud (remove dots and dashes)
    const cleanNumber = processNumber.replace(/\D/g, '')
    
    // Extract Tribunal Code (J.TR) from CNJ number
    // Format: NNNNNNN-DD.AAAA.J.TR.OOOO
    // Clean: NNNNNNNDDAAAAJTROOOO
    // J is at index 13, TR is at 14-15
    const j = cleanNumber.substring(13, 14)
    const tr = cleanNumber.substring(14, 16)
    const tribunalCode = `${j}.${tr}`
    const tribunalSlug = TRIBUNAL_MAP[tribunalCode]

    if (!tribunalSlug) {
      return NextResponse.json({ error: `Tribunal não suportado ou código inválido: ${tribunalCode}` }, { status: 400 })
    }

    const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${tribunalSlug}/_search`

    console.log(`Consulting Datajud for ${cleanNumber} at ${tribunalSlug} using ${apiKey === process.env.DATAJUD_API_KEY ? 'Custom Key' : 'Default Key'}`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `ApiKey ${apiKey}`
      },
      body: JSON.stringify({
        query: {
          bool: {
            should: [
              { match: { numeroProcesso: cleanNumber } },
              { match: { numeroProcesso: processNumber } }
            ],
            minimum_should_match: 1
          }
        },
        sort: [{ "dataHoraUltimaAtualizacao": { "order": "desc" } }],
        size: 100
      }),
      cache: 'no-store'
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Datajud API error:', errorText)
      return NextResponse.json({ error: 'Erro na consulta ao Datajud' }, { status: response.status })
    }

    const data = await response.json()
    const hits = data.hits?.hits || []

    if (hits.length === 0) {
      return NextResponse.json({ error: 'Processo não encontrado no Datajud' }, { status: 404 })
    }

    // Combine movements from all hits
    let allMovements: any[] = []
    let mainHit = hits[0]._source // Default to first hit

    // Find the hit with the most recent last update to use as main metadata
    let mostRecentDate = 0
    
    hits.forEach((hit: any) => {
      const source = hit._source
      const lastUpdate = source.dataHoraUltimaAtualizacao ? new Date(source.dataHoraUltimaAtualizacao).getTime() : 0
      
      if (lastUpdate > mostRecentDate) {
        mostRecentDate = lastUpdate
        mainHit = source
      }

      if (source.movimentos) {
        allMovements = [...allMovements, ...source.movimentos]
      }
    })

    // Map Datajud movements to our history format
    const history = allMovements
      .map((m: any) => {
        const descricao = m.movimentoNacional?.nome || m.movimentoLocal?.nome || m.nome || 'Movimentação registrada'
        const complemento = m.complementosTabelados?.[0]?.nome || m.complementosTabelados?.[0]?.valor || ''
        const fullDesc = complemento ? `${descricao} - ${complemento}` : descricao
        const dataMov = m.dataHora || m.dataMovimentacao
        
        return {
          date: dataMov,
          description: fullDesc
        }
      })
      .filter(m => m.date) // Ensure date exists
      // Remove duplicates based on date and description
      .filter((v, i, a) => a.findIndex(t => t.date === v.date && t.description === v.description) === i)
      // Sort descending by date
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({
      success: true,
      processNumber: mainHit.numeroProcesso,
      court: mainHit.tribunal || tribunalSlug.toUpperCase(),
      status: mainHit.classe?.nome || 'Em Andamento',
      history: history,
      meta: {
        usingCustomKey: !!process.env.DATAJUD_API_KEY,
        foundHits: hits.length,
        mostRecentUpdate: new Date(mostRecentDate).toISOString()
      }
    })

  } catch (error) {
    console.error('Error in process consultation:', error)
    return NextResponse.json({ error: 'Erro interno na consulta' }, { status: 500 })
  }
}

function getMockResponse(processNumber: string) {
  const mockHistory = [
    { date: new Date().toISOString(), description: 'Movimentação: Conclusos para Sentença' },
    { date: new Date(Date.now() - 86400000 * 2).toISOString(), description: 'Movimentação: Petição de Juntada de Documentos' },
    { date: new Date(Date.now() - 86400000 * 5).toISOString(), description: 'Movimentação: Despacho Proferido' },
    { date: new Date(Date.now() - 86400000 * 10).toISOString(), description: 'Movimentação: Publicação no Diário Oficial' },
    { date: new Date(Date.now() - 86400000 * 15).toISOString(), description: 'Movimentação: Distribuído por Sorteio' }
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json({
    success: true,
    processNumber,
    court: 'Tribunal de Justiça (Consulta em Processamento)',
    status: 'Em Andamento',
    history: mockHistory
  })
}
