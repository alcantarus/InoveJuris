export function Header({ name }: { name: string }) {
  return (
    <header className="mb-10 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">IJ</span>
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">InoveJuris</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Portal do Indicador</h1>
        <p className="text-lg text-slate-600 mt-1">Olá, <span className="font-semibold text-indigo-600">{name}</span>. Bem-vindo ao seu painel de resultados.</p>
      </div>
      <div className="hidden sm:block text-right">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Ambiente de Produção</p>
      </div>
    </header>
  )
}
