'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Organization {
  id: string
  name: string
  slug: string
  is_demo: boolean
  created_at: string
}

export default function OrganizationTable() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrgs = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (data) setOrgs(data)
      setLoading(false)
    }
    fetchOrgs()
  }, [])

  if (loading) return <div>Carregando organizações...</div>

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criado em</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {orgs.map((org) => (
            <tr key={org.id}>
              <td className="px-6 py-4 whitespace-nowrap">{org.name}</td>
              <td className="px-6 py-4 whitespace-nowrap">{org.slug}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${org.is_demo ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                  {org.is_demo ? 'Demonstração' : 'Produção'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">{new Date(org.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
