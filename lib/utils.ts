import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isPrivacyGloballyHidden } from "./privacy-store"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const brlCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const ptBRDateFormatter = new Intl.DateTimeFormat('pt-BR')
const ptBRTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
})
// Timestamps vindos do Postgres/PostgREST chegam em UTC (ou com offset).
// Para exibir o horário de Brasília independentemente do fuso do navegador,
// usamos formatadores com timeZone explícito.
const ptBRDateBRTFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
})
const ptBRTimeBRTFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
})
const enCAFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
})

export function getTodayBR(): string {
  return enCAFormatter.format(new Date());
}

export function getTodayBRString(): string {
  return enCAFormatter.format(new Date());
}

export const MASKED_CURRENCY = 'R$ •••••'
export const MASKED_VALUE = '••••••'

/** Formata valor monetário. Respeita o olhinho local e o modo privacidade global. */
export function formatCurrency(value: number, isVisible: boolean = true): string {
  if (!isVisible || isPrivacyGloballyHidden()) return MASKED_CURRENCY
  return brlCurrencyFormatter.format(value)
}

/**
 * Para rótulos de eixo de gráfico (ex.: "R$ 12k"), que têm formatação própria.
 * Aplica a mesma regra de privacidade antes de chamar o formatador customizado.
 */
export function formatCurrencyWith(
  value: number,
  formatter: (numericValue: number) => string,
  isVisible: boolean = true,
): string {
  if (!isVisible || isPrivacyGloballyHidden()) return MASKED_CURRENCY
  return formatter(value)
}

/**
 * Usado em campos de digitação (CurrencyInput, modais de lançamento).
 * Ignora o modo privacidade global para não impedir a edição do valor.
 */
export function formatCurrencyEditable(value: number): string {
  return brlCurrencyFormatter.format(value)
}

/** Número do percentual sem o sinal %, para KPIs que desenham o % à parte. */
export function formatPercentValue(value: number, isVisible: boolean = true, digits: number = 1): string {
  if (!isVisible || isPrivacyGloballyHidden()) return '•••'
  return Number(value || 0).toFixed(digits)
}

/** Formata percentual exibido em KPIs. Mesma regra de privacidade de formatCurrency. */
export function formatPercent(value: number, isVisible: boolean = true, digits: number = 1): string {
  return `${formatPercentValue(value, isVisible, digits)}%`
}

export function formatDate(date: string | Date): string {
  if (!date) return 'Data inválida';
  
  let d: Date;
  if (typeof date === 'string') {
    // Tenta tratar formatos YYYY-MM-DD ou YYYY-MM-DD HH:MM:SS
    const parts = date.split(/[- :T]/);
    if (parts.length >= 3) {
      const [year, month, day, hour, minute, second] = parts.map(Number);
      d = new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
    } else {
      d = new Date(date);
    }
  } else {
    d = date;
  }
  
  if (isNaN(d.getTime())) return 'Data inválida';
  return ptBRDateFormatter.format(d);
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return 'Data inválida';

  const value = String(dateStr).trim();

  // Timestamp com fuso explícito (Z, +00:00, -03:00). Converter de verdade,
  // senão 14:40Z aparece como 14:40 no Brasil em vez de 11:40.
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    const parsed = new Date(value)
    if (!isNaN(parsed.getTime())) {
      return (
        ptBRDateBRTFormatter.format(parsed) +
        ' às ' +
        ptBRTimeBRTFormatter.format(parsed)
      )
    }
  }

  // Datas sem fuso continuam sendo interpretadas como horário local, para não
  // deslocar lançamentos manuais (ex.: "2026-11-23 14:40:00").
  let date: Date;

  if (value.includes('T')) {
    const [datePart, timePart] = value.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    date = new Date(year, month - 1, day, hour, minute);
  } else if (value.includes(' ')) {
    const [datePart, timePart] = value.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    date = new Date(year, month - 1, day, hour, minute);
  } else {
    return formatDate(value);
  }

  if (isNaN(date.getTime())) return 'Data inválida';
  return ptBRDateFormatter.format(date) + ' às ' + ptBRTimeFormatter.format(date);
}

export function removeAccents(str: string): string {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function normalizeSearchText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return removeAccents(String(value)).toLowerCase().trim()
}

export function matchesSearch(term: string, ...values: unknown[]): boolean {
  const normalizedTerm = normalizeSearchText(term)
  if (!normalizedTerm) return true
  return values.some((value) => normalizeSearchText(value).includes(normalizedTerm))
}

export function validateCPF(cpf: string): boolean {
  cpf = cpf.replace(/[^\d]+/g, '')
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false
  let sum = 0
  let remainder
  for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i)
  remainder = (sum * 10) % 11
  if ((remainder === 10) || (remainder === 11)) remainder = 0
  if (remainder !== parseInt(cpf.substring(9, 10))) return false
  sum = 0
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i)
  remainder = (sum * 10) % 11
  if ((remainder === 10) || (remainder === 11)) remainder = 0
  if (remainder !== parseInt(cpf.substring(10, 11))) return false
  return true
}

export function validateCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/[^\d]+/g, '')
  if (cnpj.length !== 14) return false
  let size = cnpj.length - 2
  let numbers = cnpj.substring(0, size)
  let digits = cnpj.substring(size)
  let sum = 0
  let pos = size - 7
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--
    if (pos < 2) pos = 9
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(0))) return false
  size = size + 1
  numbers = cnpj.substring(0, size)
  sum = 0
  pos = size - 7
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--
    if (pos < 2) pos = 9
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(1))) return false
  return true
}

export function validatePIS(pis: string): boolean {
  pis = pis.replace(/[^\d]+/g, '')
  if (pis.length !== 11) return false
  let sum = 0
  let weights = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  for (let i = 0; i < 10; i++) sum += parseInt(pis.charAt(i)) * weights[i]
  let remainder = 11 - (sum % 11)
  if (remainder === 10 || remainder === 11) remainder = 0
  return remainder === parseInt(pis.charAt(10))
}

export function formatCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function formatCNPJ(cnpj: string): string {
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

export function formatPIS(pis: string): string {
  return pis.replace(/(\d{3})(\d{5})(\d{2})(\d{1})/, '$1.$2.$3-$4')
}

export function formatCEP(cep: string): string {
  return cep.replace(/(\d{5})(\d{3})/, '$1-$2')
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 0) return ''
  if (cleaned.length <= 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
}

export function getRowColor(status: string): string {
  switch (status) {
    case 'Cancelado': return 'bg-rose-50 hover:bg-rose-100'
    case 'Estornado': return 'bg-rose-100 hover:bg-rose-200'
    case 'Pro Bono': return 'bg-yellow-50 hover:bg-yellow-100'
    case 'Quitado': return 'bg-emerald-50 hover:bg-emerald-100'
    case 'Prorrogado': return 'bg-amber-50 hover:bg-amber-100'
    case 'Financiado': return 'bg-cyan-50 hover:bg-cyan-100'
    case 'Atrasada': return 'bg-rose-50 hover:bg-rose-100'
    case 'Paga': return 'bg-emerald-50 hover:bg-emerald-100'
    default: return 'hover:bg-slate-50'
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'Cancelado': return 'text-rose-700 bg-rose-100'
    case 'Estornado': return 'text-rose-800 bg-rose-200'
    case 'Pro Bono': return 'text-yellow-800 bg-yellow-100'
    case 'Quitado': return 'text-emerald-700 bg-emerald-100'
    case 'Prorrogado': return 'text-amber-700 bg-amber-100'
    case 'Financiado': return 'text-cyan-700 bg-cyan-100'
    case 'Atrasada': return 'text-rose-700 bg-rose-100'
    case 'Paga': return 'text-emerald-700 bg-emerald-100'
    default: return 'text-slate-600 bg-slate-100'
  }
}

export function isContractQuitado(statusOrContract: any, total?: number, received?: number): boolean {
  if (typeof statusOrContract === 'string') {
    const status = statusOrContract;
    // Apenas 'Quitado' é considerado quitado. 'Prorrogado' não é.
    return status === 'Quitado';
  }
  
  const contract = statusOrContract;
  // Apenas 'Quitado' é considerado quitado.
  return contract.status === 'Quitado';
}

export function formatProcessNumber(number: string): string {
  return number // Implementação simples, pode ser refinada
}

export function getNearestDeadlineStatus(process: any): string {
  return 'Normal' // Implementação simples
}

export function getDeadlineStatus(deadline: string): string {
  return 'Normal' // Implementação simples
}
