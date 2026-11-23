import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Type } from '@google/genai'
import { createServiceRoleClient } from '@/lib/supabase-service'
import { friendlyGeminiError, generateGeminiText } from '@/lib/gemini-server'

type Kind = 'dashboard_insight' | 'task_subtasks' | 'lead_score' | 'lead_insights'

const ALLOWED_KINDS: Kind[] = [
  'dashboard_insight',
  'task_subtasks',
  'lead_score',
  'lead_insights',
]

const LIMITE_TEXTO = 8000

function texto(value: unknown, max = LIMITE_TEXTO): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function numero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function buildRequest(kind: Kind, payload: Record<string, unknown>) {
  switch (kind) {
    case 'dashboard_insight': {
      const total = numero(payload.total)
      const completed = numero(payload.completed)
      const pending = numero(payload.pending)
      const highPriorityPending = numero(payload.highPriorityPending)

      return {
        prompt: `
          Você é um assistente de produtividade para um advogado.
          Aqui estão os dados das tarefas do usuário:
          - Total de tarefas: ${total}
          - Tarefas concluídas: ${completed}
          - Tarefas pendentes: ${pending}
          - Tarefas pendentes de alta prioridade: ${highPriorityPending}

          Com base nesses dados, escreva um insight curto e motivacional (máximo de 3 frases) sobre a produtividade do usuário e uma sugestão de foco. Use um tom profissional, mas encorajador.
        `,
      }
    }

    case 'task_subtasks': {
      const title = texto(payload.title, 500)

      if (!title) {
        return { error: 'Título da tarefa é obrigatório.' }
      }

      return {
        prompt: `Sugira 3 a 5 sub-tarefas práticas para o compromisso: "${title}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subtasks: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Lista de sub-tarefas sugeridas.',
              },
            },
            required: ['subtasks'],
          },
        },
      }
    }

    case 'lead_score': {
      const description = texto(payload.description)

      if (!description) {
        return { error: 'Descrição do lead é obrigatória.' }
      }

      return {
        prompt: `Analise este lead. Descreva o problema em 2 linhas. Defina o nível de urgência/temperatura respondendo APENAS com um emoji (🔥 para Quente/Urgente, 🌤️ para Morno, ❄️ para Frio).

        Texto: "${description}"

        Formato de Resposta (JSON estrito):
        { "score": "🔥", "notes": "Descrição do problema..." }`,
      }
    }

    case 'lead_insights': {
      const description = texto(payload.description)

      if (!description) {
        return { error: 'Descrição do lead é obrigatória.' }
      }

      return {
        prompt: `Analise a descrição deste lead: "${description}". (1) Identifique o sentimento do cliente (positivo/negativo/neutral). (2) Liste 3 pontos chave do problema. (3) Sugira a melhor abordagem de contato. Mantenha em bullets.`,
      }
    }
  }
}

async function sessaoValida(): Promise<boolean> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value
  const environment = cookieStore.get('app_env')?.value || 'production'

  if (!sessionId) return false

  const client = createServiceRoleClient()
  const { data, error } = await client.rpc('app_validate_session', {
    p_session_id: sessionId,
    p_environment: environment,
  })

  return !error && data?.valid === true
}

export async function POST(request: Request) {
  try {
    if (!(await sessaoValida())) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
    }

    const body = await request.json()
    const kind = body?.kind as Kind

    if (!ALLOWED_KINDS.includes(kind)) {
      return NextResponse.json({ error: 'Operação não permitida.' }, { status: 400 })
    }

    const payload =
      body?.payload && typeof body.payload === 'object' ? body.payload : {}

    const built = buildRequest(kind, payload)

    if ('error' in built) {
      return NextResponse.json({ error: built.error }, { status: 400 })
    }

    const config = 'config' in built ? built.config : undefined
    const text = await generateGeminiText(built.prompt, config)
    return NextResponse.json({ text })
  } catch (error: any) {
    if (error?.code === 'GEMINI_KEY_MISSING') {
      return NextResponse.json(
        { error: 'Chave do Gemini não configurada no servidor.' },
        { status: 503 }
      )
    }

    const friendly = friendlyGeminiError(error) as Error & { code?: string }
    console.error('[AI] falha ao gerar conteúdo:', friendly.message)
    const status =
      friendly.code === 'GEMINI_TIMEOUT'
        ? 504
        : friendly.code === 'GEMINI_UNAVAILABLE' || friendly.code === 'GEMINI_RATE_LIMIT'
          ? 503
          : 500
    return NextResponse.json({ error: friendly.message }, { status })
  }
}
