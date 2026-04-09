import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getTodayBR(): string {
  return new Date().toISOString().split('T')[0]
}

export function getTodayBRString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function formatCurrency(value: number, isVisible: boolean = true): string {
  if (!isVisible) return 'R$ •••••'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
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
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return 'Data inválida';
  
  let date: Date;
  
  if (dateStr.includes('T')) {
    const [datePart, timePart] = dateStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    date = new Date(year, month - 1, day, hour, minute);
  } else if (dateStr.includes(' ')) {
    const [datePart, timePart] = dateStr.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    date = new Date(year, month - 1, day, hour, minute);
  } else {
    return formatDate(dateStr);
  }
  
  if (isNaN(date.getTime())) return 'Data inválida';
  return date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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
    case 'Atrasada': return 'bg-rose-50'
    case 'Paga': return 'bg-emerald-50'
    default: return ''
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'Atrasada': return 'text-rose-600'
    case 'Paga': return 'text-emerald-600'
    default: return 'text-slate-600'
  }
}

export function isContractQuitado(statusOrContract: any, total?: number, received?: number): boolean {
  if (typeof statusOrContract === 'string') {
    const status = statusOrContract;
    if (status === 'Quitado') return true;
    if (total !== undefined && received !== undefined) {
      return received >= total;
    }
    return false;
  }
  
  const contract = statusOrContract;
  return contract.status === 'Quitado' || (contract.amount_received >= contract.contract_value);
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
