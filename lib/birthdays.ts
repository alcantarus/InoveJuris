import { supabase } from '@/lib/supabase'

/**
 * Busca compartilhada de aniversariantes do dia.
 *
 * Antes, `BirthdayChecker` e `BirthdayWidget` faziam cada um as mesmas 3
 * consultas no mount do dashboard (6 no total). Aqui elas são unificadas
 * e memoizadas por 5 minutos, com deduplicação de requests em voo.
 *
 * Esta função é somente leitura: não grava nada no banco.
 */

export interface BirthdayPerson {
  id: string
  name: string
  birthDate: string
  age: number
  type: 'client' | 'indicator' | 'maternity'
  phone?: string
}

interface CacheEntry {
  at: number
  promise: Promise<BirthdayPerson[]>
}

const TTL_MS = 5 * 60 * 1000
let cache: CacheEntry | null = null

function parseDate(value: string): Date | null {
  if (typeof value !== 'string' || !value) return null

  let date: Date
  if (value.includes('-')) {
    const [year, month, day] = value.split('-').map(Number)
    date = new Date(year, month - 1, day)
  } else if (value.includes('/')) {
    const [day, month, year] = value.split('/').map(Number)
    date = new Date(year, month - 1, day)
  } else {
    date = new Date(value)
  }

  return Number.isNaN(date.getTime()) ? null : date
}

function isToday(date: Date, month: number, day: number): boolean {
  return date.getMonth() + 1 === month && date.getDate() === day
}

async function loadBirthdays(): Promise<BirthdayPerson[]> {
  const [clientsRes, indicatorsRes, maternityRes] = await Promise.all([
    supabase.from('clients').select('id, name, "birthDate", phone').not('"birthDate"', 'is', null),
    supabase.from('indicators').select('id, name, data_nascimento, phone').not('data_nascimento', 'is', null),
    supabase.from('contracts').select('id, rn_name, rn_birth_date').ilike('product', '%maternidade%').not('rn_birth_date', 'is', null),
  ])

  if (clientsRes.error) throw clientsRes.error
  if (indicatorsRes.error) throw indicatorsRes.error
  if (maternityRes.error) throw maternityRes.error

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentDay = now.getDate()
  const currentYear = now.getFullYear()

  const fromPerson = (
    person: any,
    dateField: string,
    type: 'client' | 'indicator',
  ): BirthdayPerson | null => {
    const birthDate = person?.[dateField]
    if (!birthDate) return null

    const date = parseDate(birthDate)
    if (!date || !isToday(date, currentMonth, currentDay)) return null

    return {
      id: `${type}_${person.id}`,
      name: person.name || 'Cliente',
      birthDate,
      age: currentYear - date.getFullYear(),
      type,
      phone: person.phone,
    }
  }

  const fromMaternity = (contract: any): BirthdayPerson | null => {
    const birthDate = contract?.rn_birth_date
    if (!birthDate) return null

    const date = parseDate(birthDate)
    if (!date || !isToday(date, currentMonth, currentDay)) return null

    return {
      id: `maternity_${contract.id}`,
      name: contract.rn_name || 'Recém-nascido',
      birthDate,
      age: 0,
      type: 'maternity',
    }
  }

  const birthdays: BirthdayPerson[] = [
    ...(clientsRes.data || []).map((c: any) => fromPerson(c, 'birthDate', 'client')).filter(Boolean),
    ...(indicatorsRes.data || []).map((i: any) => fromPerson(i, 'data_nascimento', 'indicator')).filter(Boolean),
    ...(maternityRes.data || []).map(fromMaternity).filter(Boolean),
  ] as BirthdayPerson[]

  return birthdays
}

/** Retorna a Promise em cache enquanto ela estiver válida. */
export function getBirthdays(): Promise<BirthdayPerson[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.promise

  const promise = loadBirthdays().catch((error) => {
    // Não guarda falha em cache: a próxima chamada tenta novamente.
    if (cache?.promise === promise) cache = null
    throw error
  })

  cache = { at: Date.now(), promise }
  return promise
}

/** Força uma nova busca (usado no foco da janela). */
export function invalidateBirthdaysCache(): void {
  cache = null
}
