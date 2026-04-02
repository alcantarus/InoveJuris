import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function removeAccents(str: string | null | undefined): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function validateCPF(cpf: string) {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
  const cpfDigits = cpf.split('').map(el => +el);
  const rest = (count: number) => {
    return (((cpfDigits.slice(0, count - 12).reduce((soma, el, index) => (soma + el * (count - index)), 0) * 10) % 11) % 10);
  };
  return rest(10) === cpfDigits[9] && rest(11) === cpfDigits[10];
}

export function validateCNPJ(cnpj: string) {
  cnpj = cnpj.replace(/[^\d]+/g, '');
  if (cnpj.length !== 14 || !!cnpj.match(/(\d)\1{13}/)) return false;
  let size = cnpj.length - 2;
  let numbers = cnpj.substring(0, size);
  const digits = cnpj.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;
  size = size + 1;
  numbers = cnpj.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;
  return true;
}

export function formatCPF(v: string) {
  v = v.replace(/\D/g, "");
  if (v.length <= 11) {
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return v;
}

export function formatCNPJ(v: string) {
  v = v.replace(/\D/g, "");
  if (v.length <= 14) {
    v = v.replace(/^(\d{2})(\d)/, "$1.$2");
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
    v = v.replace(/(\d{4})(\d)/, "$1-$2");
  }
  return v;
}

export function validatePIS(pis: string) {
  pis = pis.replace(/[^\d]+/g, '');
  if (pis.length !== 11 || !!pis.match(/(\d)\1{10}/)) return false;
  
  const weights = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  
  for (let i = 0; i < 10; i++) {
    sum += parseInt(pis.charAt(i)) * weights[i];
  }
  
  let remainder = sum % 11;
  let checkDigit = remainder < 2 ? 0 : 11 - remainder;
  
  return checkDigit === parseInt(pis.charAt(10));
}

export function formatPIS(v: string) {
  v = v.replace(/\D/g, "");
  if (v.length <= 11) {
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})\.(\d{5})(\d)/, "$1.$2.$3");
    v = v.replace(/(\d{3})\.(\d{5})\.(\d{2})(\d)/, "$1.$2.$3-$4");
  }
  return v;
}

export function formatCEP(v: string) {
  v = v.replace(/\D/g, "");
  if (v.length <= 8) {
    v = v.replace(/(\d{5})(\d)/, "$1-$2");
  }
  return v;
}

export function isContractQuitado(status: string | undefined, contractValue: number | undefined | null, amountReceived: number | undefined | null): boolean {
  return status === 'Quitado' || 
         (Number(contractValue || 0) > 0 && Number(amountReceived || 0) >= Number(contractValue || 0));
}

export function formatPhone(v: string) {
  v = v.replace(/\D/g, "");
  if (v.length <= 11) {
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
  }
  return v;
}

export function formatProcessNumber(v: string) {
  v = v.replace(/\D/g, "")
  
  if (v.length > 20) v = v.slice(0, 20)

  // 0000000-00.0000.0.00.0000
  if (v.length > 15) {
    v = v.replace(/^(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4}).*/, "$1-$2.$3.$4.$5.$6")
  } else if (v.length > 13) {
    v = v.replace(/^(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})/, "$1-$2.$3.$4.$5")
  } else if (v.length > 12) {
    v = v.replace(/^(\d{7})(\d{2})(\d{4})(\d{1})/, "$1-$2.$3.$4")
  } else if (v.length > 9) {
    v = v.replace(/^(\d{7})(\d{2})(\d{4})/, "$1-$2.$3")
  } else if (v.length > 7) {
    v = v.replace(/^(\d{7})(\d{2})/, "$1-$2")
  }
  
  return v
}

export function getTodayBR() {
  // Retorna a data atual no formato YYYY-MM-DD para o fuso de Brasília
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

export function formatDate(dateString: string | null | undefined) {
  if (!dateString) return '-'
  try {
    // Se for ISO string completa (com T), pega só a parte da data
    const pureDate = dateString.split('T')[0]
    const [year, month, day] = pureDate.split('-').map(Number)
    if (isNaN(year) || isNaN(month) || isNaN(day)) return dateString
    
    // Criamos a data especificando meio-dia para evitar problemas de fuso horário ao converter para local
    const date = new Date(year, month - 1, day, 12, 0, 0)
    
    return date.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } catch (e) {
    return dateString || '-'
  }
}

export function formatCurrency(value: number | string | null | undefined, isVisible: boolean = true, maximumFractionDigits?: number) {
  if (!isVisible) return '••••••';
  const num = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    maximumFractionDigits
  }).format(num);
}

export function getStatusColor(status: string | null | undefined): string {
  const normalizedStatus = status?.toLowerCase().trim();
  switch (normalizedStatus) {
    case 'aberto':
      return 'bg-blue-100 text-blue-700';
    case 'quitado':
      return 'bg-[#b6d7a8] text-black';
    case 'parcial':
      return 'bg-indigo-100 text-indigo-700';
    case 'atrasada':
    case 'atrasado':
      return 'bg-rose-100 text-rose-700';
    case 'prorrogada':
    case 'prorrogado':
    case 'prorrogado':
      return 'bg-[#f9cb9c] text-black';
    case 'estornada':
    case 'estornado':
      return 'bg-[#f4cccc] text-black';
    case 'cancelada':
    case 'cancelado':
      return 'bg-[#ea9999] text-black line-through';
    case 'financiado':
      return 'bg-[#46bdc6] text-black';
    case 'pro bono':
      return 'bg-[#ffff00] text-black';
    case 'normal':
      return 'bg-[#cfe2f3] text-black';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function getRowColor(status: string | null | undefined): string {
  const normalizedStatus = status?.toLowerCase().trim();
  switch (normalizedStatus) {
    case 'cancelado':
    case 'cancelada':
      return 'bg-[#ea9999]/10 hover:bg-[#ea9999]/20 opacity-60 line-through';
    case 'estornado':
    case 'estornada':
      return 'bg-[#f4cccc]/20 hover:bg-[#f4cccc]/30';
    case 'pro bono':
      return 'bg-[#ffff00]/10 hover:bg-[#ffff00]/20';
    case 'quitado':
      return 'bg-[#b6d7a8]/20 hover:bg-[#b6d7a8]/30';
    case 'prorrogado':
    case 'prorrogada':
      return 'bg-[#f9cb9c]/20 hover:bg-[#f9cb9c]/30';
    case 'financiado':
      return 'bg-[#46bdc6]/10 hover:bg-[#46bdc6]/20';
    case 'normal':
      return 'bg-[#cfe2f3]/20 hover:bg-[#cfe2f3]/30';
    default:
      return 'hover:bg-slate-50';
  }
}

export function getDeadlineStatus(deadlineDate: string | null | undefined) {
  if (!deadlineDate) return 'none'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const parts = deadlineDate.split('-')
  if (parts.length !== 3) return 'none'
  
  const [year, month, day] = parts.map(Number)
  const deadline = new Date(year, month - 1, day)
  
  const diffTime = deadline.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays <= 0) return 'expired'
  if (diffDays <= 7) return 'critical'
  if (diffDays <= 15) return 'warning'
  return 'safe'
}

export function getNearestDeadlineStatus(deadlines: any[] | null | undefined) {
  if (!deadlines || deadlines.length === 0) return 'none'
  
  let nearestDeadline = deadlines.reduce((prev, curr) => {
    if (!prev) return curr
    return new Date(curr.deadline_date) < new Date(prev.deadline_date) ? curr : prev
  }, null)
  
  return getDeadlineStatus(nearestDeadline.deadline_date)
}
