interface Commission {
  contract_id: number
  client_name: string
  total_commission: number
  total_paid: number
  remaining_balance: number
}

interface CommissionTableProps {
  data: Commission[]
}

export function CommissionTable({ data }: CommissionTableProps) {
  return (
    <div className="border-none shadow-sm bg-white rounded-2xl overflow-hidden ring-1 ring-slate-200">
      <div className="p-6 border-b border-slate-100">
        <h3 className="text-lg font-semibold text-slate-900">Minhas Comissões</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="p-4">Contrato</th>
              <th className="p-4">Cliente</th>
              <th className="p-4 text-right">Comissão</th>
              <th className="p-4 text-right">Pago</th>
              <th className="p-4 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((s) => (
              <tr key={s.contract_id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 font-medium text-slate-900">#{s.contract_id}</td>
                <td className="p-4 text-slate-600">{s.client_name}</td>
                <td className="p-4 text-right text-slate-900">R$ {Number(s.total_commission).toFixed(2)}</td>
                <td className="p-4 text-right text-slate-900">R$ {Number(s.total_paid).toFixed(2)}</td>
                <td className="p-4 text-right font-bold text-emerald-600">R$ {Number(s.remaining_balance).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
