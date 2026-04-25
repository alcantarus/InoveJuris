import React from 'react'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'

export function LeadsButton() {
  return (
    <Link 
      href="/leads"
      className="fixed bottom-24 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all hover:scale-105 z-50 flex items-center justify-center"
      title="Gestão de Leads"
    >
      <MessageSquare size={24} />
    </Link>
  )
}
