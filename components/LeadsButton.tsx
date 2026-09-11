'use client'

import React from 'react'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

export function LeadsButton() {
  const { user } = useAuth()
  const canAccessLeads = user?.canAccessLeads
  
  return (
    <Link 
      href={canAccessLeads ? "/leads" : "#"}
      className={cn(
        "fixed bottom-24 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all hover:scale-105 z-50 flex items-center justify-center",
        !canAccessLeads && "opacity-50 pointer-events-none cursor-not-allowed grayscale"
      )}
      title={canAccessLeads ? "Gestão de Leads" : "Permissão negada"}
    >
      <MessageSquare size={24} />
    </Link>
  )
}
