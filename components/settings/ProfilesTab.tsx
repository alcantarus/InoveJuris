'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '../ui/Card';
import { Shield, Plus, Save, Trash2, Check, X, Loader2, Info } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface Permission {
  id: string;
  slug: string;
  description: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[]; // slugs
}

export function ProfilesTab() {
  const { user, refreshUser } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Toda escrita em RBAC passa pelo servidor, que valida a sessao e chama a RPC. */
  const rbacRequest = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch('/api/settings/rbac', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.success) {
      throw new Error(data?.error || 'Falha ao salvar permissões.');
    }

    return data;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await rbacRequest({ action: 'get' });
      setPermissions(data.permissions || []);
      setRoles(data.roles || []);
    } catch (error: any) {
      console.error('Error fetching RBAC data:', error);
      setErrorMessage(error.message || 'Não foi possível carregar perfis e permissões.');
    } finally {
      setLoading(false);
    }
  }, [rbacRequest]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTogglePermission = async (roleId: string, permissionSlug: string, hasPermission: boolean) => {
    setSaving(roleId);
    setErrorMessage(null);
    try {
      if (!permissions.find(p => p.slug === permissionSlug)) return;

      await rbacRequest({
        action: 'set_permission',
        roleId: Number(roleId),
        permissionSlug,
        enabled: !hasPermission,
      });

      // Update local state
      setRoles(prev => prev.map(r => {
        if (r.id === roleId) {
          const newPerms = hasPermission 
            ? r.permissions.filter(p => p !== permissionSlug)
            : [...r.permissions, permissionSlug];
          return { ...r, permissions: newPerms };
        }
        return r;
      }));

      // Refresh current user's permissions if they are affected
      if (user?.role_name === roles.find(r => r.id === roleId)?.name) {
        refreshUser();
      }
    } catch (error: any) {
      console.error('Error toggling permission:', error);
      setErrorMessage(error.message || 'Não foi possível alterar a permissão.');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;

    setErrorMessage(null);
    try {
      await rbacRequest({
        action: 'save_role',
        id: editingRole.id ? Number(editingRole.id) : null,
        name: editingRole.name,
        description: editingRole.description,
      });
      setIsModalOpen(false);
      await fetchData();
    } catch (error: any) {
      console.error('Error saving role:', error);
      setErrorMessage(error.message || 'Não foi possível salvar o perfil.');
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este perfil? Esta ação é irreversível e afetará todos os usuários vinculados.')) return;

    setErrorMessage(null);
    try {
      await rbacRequest({ action: 'delete_role', id: Number(id) });
      setRoles(prev => prev.filter(r => r.id !== id));
    } catch (error: any) {
      console.error('Error deleting role:', error);
      setErrorMessage(error.message || 'Não foi possível excluir o perfil.');
    }
  };

  if (!user?.is_superadmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center gap-3">
        <Shield className="w-10 h-10 text-slate-300" />
        <h2 className="text-xl font-bold text-slate-900">Acesso restrito</h2>
        <p className="text-sm text-slate-500">
          Somente superadministradores podem gerenciar perfis e permissões.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Perfis e Permissões</h2>
          <p className="text-sm text-slate-500">Defina o que cada perfil de usuário pode acessar no sistema.</p>
        </div>
        <button 
          onClick={() => {
            setEditingRole({ id: '', name: '', description: '', permissions: [] });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus size={18} />
          Novo Perfil
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {roles.map(role => (
          <Card 
            key={role.id}
            title={role.name}
            description={role.description}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {permissions.map(perm => {
                  const hasPerm = role.permissions.includes(perm.slug);
                  const isProcessing = saving === role.id;

                  return (
                    <button
                      key={perm.id}
                      onClick={() => handleTogglePermission(role.id, perm.slug, hasPerm)}
                      disabled={isProcessing || role.name === 'Administrador'}
                      className={`
                        flex items-center justify-between p-3 rounded-xl border transition-all text-left
                        ${hasPerm 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                        }
                        ${role.name === 'Administrador' ? 'opacity-80 cursor-default' : ''}
                      `}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase tracking-wider">{perm.description}</span>
                        <span className="text-[10px] opacity-60 font-mono">{perm.slug}</span>
                      </div>
                      {hasPerm ? <Check size={16} className="text-indigo-600" /> : <X size={16} className="text-slate-300" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                {role.name !== 'Administrador' && (
                  <>
                    <button 
                      onClick={() => {
                        setEditingRole(role);
                        setIsModalOpen(true);
                      }}
                      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Editar Nome/Descrição
                    </button>
                    <button 
                      onClick={() => handleDeleteRole(role.id)}
                      className="text-sm text-rose-600 hover:text-rose-800 font-medium"
                    >
                      Excluir Perfil
                    </button>
                  </>
                )}
                {role.name === 'Administrador' && (
                  <span className="text-xs text-slate-400 italic flex items-center gap-1">
                    <Info size={12} />
                    Perfil de administrador possui acesso total e não pode ser editado.
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal for Create/Edit Role */}
      {isModalOpen && editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingRole.id ? 'Editar Perfil' : 'Novo Perfil'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveRole} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Perfil</label>
                <input 
                  type="text"
                  required
                  value={editingRole.name}
                  onChange={e => setEditingRole({ ...editingRole, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ex: Advogado Sênior"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                <textarea 
                  rows={3}
                  value={editingRole.description}
                  onChange={e => setEditingRole({ ...editingRole, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  placeholder="Descreva as responsabilidades deste perfil..."
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm"
                >
                  Salvar Perfil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
