export function Header({ name }: { name: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Portal do Indicador</h1>
      <p className="text-lg text-slate-600 mt-2">Olá, <span className="font-semibold text-indigo-600">{name}</span>. Bem-vindo ao seu painel.</p>
    </header>
  )
}
