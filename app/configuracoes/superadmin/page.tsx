'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import OrganizationTable from './components/OrganizationTable'
import CreateOrganizationModal from './components/CreateOrganizationModal'

export default function SuperAdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!loading && (!user || !user.is_superadmin)) {
      router.push('/configuracoes')
    }
  }, [user, loading, router])

  if (loading) return <div>Carregando...</div>
  if (!user || !user.is_superadmin) return null

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Painel Super Admin</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Nova Organização
        </button>
      </div>
      
      <OrganizationTable key={refreshKey} />
      
      <CreateOrganizationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => setRefreshKey(prev => prev + 1)}
      />
    </div>
  )
}
