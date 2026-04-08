import { useState } from 'react'
import { ChevronDown, ChevronUp, FileText } from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

interface Commission {
  contract_id: number
  client_name: string
  base_comissao: number
  commissionPercent: number
  total_commission: number
  total_paid: number
  remaining_balance: number
  contract_status: string
  payment_status: 'Pago' | 'Pendente'
  payments: any[]
}

interface CommissionTableProps {
  data: Commission[]
}

export function CommissionTable({ data }: CommissionTableProps) {
  const [expandedRows, setExpandedRows] = useState<number[]>([])

  const toggleRow = (contractId: number) => {
    setExpandedRows(prev => 
      prev.includes(contractId) ? prev.filter(id => id !== contractId) : [...prev, contractId]
    )
  }

  const generatePDF = (commission: Commission) => {
    const doc = new jsPDF()
    doc.text(`Comprovante de Pagamento - Contrato #${commission.contract_id}`, 10, 10)
    doc.text(`Cliente: ${commission.client_name}`, 10, 20)
    
    const tableData = commission.payments.map(p => [
      new Date(p.created_at).toLocaleDateString('pt-BR'),
      `R$ ${Number(p.amount_paid).toFixed(2)}`,
      p.description || '-'
    ])

    ;(doc as any).autoTable({
      head: [['Data', 'Valor Pago', 'Descrição']],
      body: tableData,
      startY: 30
    })
    
    doc.save(`comprovante_contrato_${commission.contract_id}.pdf`)
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
      <h3 className="text-xl font-bold text-slate-950 mb-8">Minhas Comissões</h3>
      <div className="space-y-4">
        {data.map((s) => {
          const isPaid = s.payment_status === 'Pago';
          const isExpanded = expandedRows.includes(s.contract_id);
          
          return (
            <div key={s.contract_id} className="border border-slate-100 rounded-2xl overflow-hidden">
              <div 
                className="grid grid-cols-1 md:grid-cols-6 gap-4 p-6 hover:bg-indigo-50/30 transition-all items-center cursor-pointer"
                onClick={() => toggleRow(s.contract_id)}
              >
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contrato</span>
                  <p className="text-lg font-bold text-slate-950">#{s.contract_id}</p>
                  <span className="text-xs text-slate-500">{s.client_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Valor Contrato</span>
                  <p className="text-lg font-bold text-slate-900">R$ {Number(s.base_comissao || 0).toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">% Comissão</span>
                  <p className="text-lg font-bold text-slate-900">{Number(s.commissionPercent || 0).toFixed(2)}%</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total</span>
                  <p className="text-lg font-bold text-slate-900">R$ {Number(s.total_commission).toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pago</span>
                  <p className="text-lg font-bold text-emerald-600">R$ {Number(s.total_paid).toFixed(2)}</p>
                </div>
                <div className="text-right flex items-center justify-end gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saldo</span>
                    <p className={`text-lg font-bold ${isPaid ? 'text-slate-400' : 'text-indigo-600'}`}>
                      R$ {Number(s.remaining_balance).toFixed(2)}
                    </p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {s.payment_status}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>
              
              {isExpanded && s.payments.length > 0 && (
                <div className="p-6 bg-slate-50 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-slate-900">Histórico de Pagamentos</h4>
                    <button 
                      onClick={() => generatePDF(s)}
                      className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      <FileText size={16} />
                      Baixar Comprovante
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {s.payments.map((p, i) => (
                      <li key={i} className="flex justify-between text-sm text-slate-600">
                        <span>{new Date(p.created_at).toLocaleDateString('pt-BR')} - {p.description || 'Pagamento'}</span>
                        <span className="font-semibold">R$ {Number(p.amount_paid).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  )
}
