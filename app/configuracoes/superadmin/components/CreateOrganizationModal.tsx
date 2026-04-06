'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateOrganizationModal({ isOpen, onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    is_demo: false,
    adminName: '',
    adminEmail: '',
    adminPassword: ''
  })

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Hash da senha antes de enviar para o RPC
    const salt = bcrypt.genSaltSync(10)
    const hashedPassword = bcrypt.hashSync(formData.adminPassword, salt)

    const { data, error } = await supabase.rpc('create_organization_and_admin', {
      org_name: formData.name,
      org_slug: formData.slug,
      org_is_demo: formData.is_demo,
      admin_name: formData.adminName,
      admin_email: formData.adminEmail,
      admin_password_hash: hashedPassword
    })

    if (error) {
      console.error('Erro ao criar organização:', error)
      alert('Erro ao criar organização: ' + error.message)
    } else {
      alert('Organização criada com sucesso!')
      onSuccess()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Nova Organização</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Nome da Organização" className="w-full p-2 border rounded" required onChange={e => setFormData({...formData, name: e.target.value})} />
          <input type="text" placeholder="Slug (ex: alcantara-adv)" className="w-full p-2 border rounded" required onChange={e => setFormData({...formData, slug: e.target.value})} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={formData.is_demo} onChange={e => setFormData({...formData, is_demo: e.target.checked})} />
            É ambiente de demonstração?
          </label>
          <hr />
          <h3 className="font-semibold">Admin Inicial</h3>
          <input type="text" placeholder="Nome do Admin" className="w-full p-2 border rounded" required onChange={e => setFormData({...formData, adminName: e.target.value})} />
          <input type="email" placeholder="Email do Admin" className="w-full p-2 border rounded" required onChange={e => setFormData({...formData, adminEmail: e.target.value})} />
          <input type="password" placeholder="Senha do Admin" className="w-full p-2 border rounded" required onChange={e => setFormData({...formData, adminPassword: e.target.value})} />
          
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Criar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
