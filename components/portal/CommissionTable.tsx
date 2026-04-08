interface Commission {
  contract_id: number
  client_name: string
  total_commission: number
  total_paid: number
  remaining_balance: number
  contract_status: string
  payment_status: 'Pago' | 'Pendente'
}

interface CommissionTableProps {
  data: Commission[]
}

export function CommissionTable({ data }: CommissionTableProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
      <h3 className="text-xl font-bold text-slate-950 mb-8">Minhas Comissões</h3>
      <div className="space-y-4">
        {data.map((s) => {
          const isPaid = s.payment_status === 'Pago';
          return (
            <div key={s.contract_id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all items-center">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contrato</span>
                <p className="text-lg font-bold text-slate-950">#{s.contract_id}</p>
                <span className="text-xs text-slate-500">{s.client_name}</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total</span>
                <p className="text-lg font-bold text-slate-900">R$ {Number(s.total_commission).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pago</span>
                <p className="text-lg font-bold text-emerald-600">R$ {Number(s.total_paid).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saldo</span>
                <p className={`text-lg font-bold ${isPaid ? 'text-slate-400' : 'text-indigo-600'}`}>
                  R$ {Number(s.remaining_balance).toFixed(2)}
                </p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {s.payment_status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  )
}
