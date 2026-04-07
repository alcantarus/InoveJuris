import React from 'react';
import { motion } from 'motion/react';
import { Edit2, Trash2, Check, X, LogIn, ShieldAlert } from 'lucide-react';
import { User, useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/utils';

interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (e: React.MouseEvent, id: number) => void;
  onImpersonate?: (user: User) => void;
}

const PermissionBadge = ({ hasPermission, label }: { hasPermission: boolean, label: string }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${hasPermission ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
    {hasPermission ? <Check size={12} /> : <X size={12} />}
    {label}
  </span>
);

export const UserTable: React.FC<UserTableProps> = ({ users, onEdit, onDelete, onImpersonate }) => {
  const { user: currentUser } = useAuth();
  
  const canEditUser = (targetUser: User) => {
    if (!currentUser) return false;
    if (currentUser.is_superadmin) return true;
    if (targetUser.is_superadmin) return false;
    return true;
  };

  const canDeleteUser = (targetUser: User) => {
    if (!currentUser) return false;
    // Cannot delete self
    if (targetUser.id === currentUser.id) return false;
    // Cannot delete superadmins if not superadmin
    if (targetUser.is_superadmin && !currentUser.is_superadmin) return false;
    // Specific protection for "Administrador" and "Anderson Alcântara Silva"
    if (targetUser.name === 'Administrador' || targetUser.name === 'Anderson Alcântara Silva') return false;
    
    // Check if user has permission to delete users
    return currentUser.is_superadmin || currentUser.canAccessUsers;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200 text-sm text-slate-500">
              <th className="p-4 font-medium">Usuário</th>
              <th className="p-4 font-medium">Expiração</th>
              <th className="p-4 font-medium">Permissões</th>
              <th className="p-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user, index) => {
              const isEditable = canEditUser(user);
              const isDeletable = canDeleteUser(user);
              return (
              <motion.tr 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={user.id} 
                className="hover:bg-slate-50/50 transition-colors group"
              >
                <td className="p-4">
                  <div className="font-medium text-slate-900 flex items-center gap-2">
                    {user.name}
                    {user.is_superadmin && (
                      <span title="Super Administrador">
                        <ShieldAlert className="w-4 h-4 text-amber-500" />
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500">{user.email}</div>
                  {user.role_name && (
                    <div className="mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                        {user.role_name}
                      </span>
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <div className="text-sm text-slate-600">
                    {user.expiration_date ? formatDate(user.expiration_date) : 'Nunca'}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    <PermissionBadge hasPermission={user.canAccessDashboard} label="Dashboard" />
                    <PermissionBadge hasPermission={user.canAccessClients} label="Clientes" />
                    <PermissionBadge hasPermission={user.canAccessLawyers} label="Advogados" />
                    <PermissionBadge hasPermission={user.canAccessProcesses} label="Processos" />
                    <PermissionBadge hasPermission={user.canAccessContracts} label="Contratos" />
                    <PermissionBadge hasPermission={user.canAccessReceivables} label="Contas a Receber" />
                    <PermissionBadge hasPermission={user.canAccessCashFlow} label="Fluxo de Caixa" />
                    <PermissionBadge hasPermission={user.canAccessProducts} label="Produtos" />
                    <PermissionBadge hasPermission={user.canAccessIndicators} label="Indicadores" />
                    <PermissionBadge hasPermission={user.canAccessReports} label="Relatórios" />
                    <PermissionBadge hasPermission={user.canAccessUsers} label="Usuários" />
                    <PermissionBadge hasPermission={user.canAccessSettings} label="Configurações" />
                    <PermissionBadge hasPermission={user.canAccessAudit} label="Auditoria" />
                    <PermissionBadge hasPermission={user.canAccessDocuments} label="Documentos" />
                    <PermissionBadge hasPermission={user.canAccessDocTemplates} label="Gestão Modelos" />
                    <PermissionBadge hasPermission={user.canAccessDocGeneration} label="Geração Docs" />
                    <PermissionBadge hasPermission={user.canAccessProdEnv !== false} label="Amb. Produção" />
                    <PermissionBadge hasPermission={user.canAccessTestEnv} label="Amb. Testes" />
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    {onImpersonate && user.id !== currentUser?.id && isEditable && (
                      <button 
                        onClick={() => onImpersonate(user)}
                        className="p-2 text-slate-600 md:text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 bg-slate-50 md:bg-transparent rounded-lg transition-colors"
                        title="Acessar como este usuário"
                      >
                        <LogIn size={18} />
                      </button>
                    )}
                    <button 
                      onClick={() => isEditable && onEdit(user)}
                      disabled={!isEditable}
                      className={`p-2 rounded-lg transition-colors ${isEditable ? 'text-slate-600 md:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 bg-slate-50 md:bg-transparent' : 'text-slate-300 cursor-not-allowed'}`}
                      title={isEditable ? "Editar Usuário" : "Você não tem permissão para alterar este usuário"}
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={(e) => isDeletable && onDelete(e, user.id)}
                      disabled={!isDeletable}
                      className={`p-2 rounded-lg transition-colors ${isDeletable ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-300 cursor-not-allowed'}`}
                      title={isDeletable ? "Excluir Usuário" : "Você não tem permissão para excluir este usuário"}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-slate-100">
        {users.map((user) => {
          const isEditable = canEditUser(user);
          const isDeletable = canDeleteUser(user);
          return (
          <div key={user.id} className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-slate-900 flex items-center gap-2">
                  {user.name}
                  {user.is_superadmin && (
                    <span title="Super Administrador">
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500">{user.email}</div>
                {user.role_name && (
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                      {user.role_name}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {onImpersonate && user.id !== currentUser?.id && isEditable && (
                  <button onClick={() => onImpersonate(user)} className="p-2 text-slate-600 hover:text-emerald-600" title="Acessar"><LogIn size={18} /></button>
                )}
                <button 
                  onClick={() => isEditable && onEdit(user)} 
                  disabled={!isEditable}
                  className={`p-2 ${isEditable ? 'text-slate-600 hover:text-indigo-600' : 'text-slate-300 cursor-not-allowed'}`} 
                  title={isEditable ? "Editar" : "Sem permissão"}
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={(e) => isDeletable && onDelete(e, user.id)} 
                  disabled={!isDeletable}
                  className={`p-2 ${isDeletable ? 'text-slate-600 hover:text-rose-600' : 'text-slate-300 cursor-not-allowed'}`} 
                  title={isDeletable ? "Excluir" : "Sem permissão"}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-500">Expiração:</span> {user.expiration_date ? formatDate(user.expiration_date) : 'Nunca'}
            </div>
            <div className="flex flex-wrap gap-1">
              <PermissionBadge hasPermission={user.canAccessDashboard} label="Dashboard" />
              <PermissionBadge hasPermission={user.canAccessClients} label="Clientes" />
              <PermissionBadge hasPermission={user.canAccessLawyers} label="Advogados" />
              <PermissionBadge hasPermission={user.canAccessProcesses} label="Processos" />
              <PermissionBadge hasPermission={user.canAccessContracts} label="Contratos" />
              <PermissionBadge hasPermission={user.canAccessReceivables} label="Contas a Receber" />
              <PermissionBadge hasPermission={user.canAccessCashFlow} label="Fluxo de Caixa" />
              <PermissionBadge hasPermission={user.canAccessProducts} label="Produtos" />
              <PermissionBadge hasPermission={user.canAccessIndicators} label="Indicadores" />
              <PermissionBadge hasPermission={user.canAccessReports} label="Relatórios" />
              <PermissionBadge hasPermission={user.canAccessUsers} label="Usuários" />
              <PermissionBadge hasPermission={user.canAccessSettings} label="Configurações" />
              <PermissionBadge hasPermission={user.canAccessAudit} label="Auditoria" />
              <PermissionBadge hasPermission={user.canAccessDocuments} label="Documentos" />
              <PermissionBadge hasPermission={user.canAccessDocTemplates} label="Gestão Modelos" />
              <PermissionBadge hasPermission={user.canAccessDocGeneration} label="Geração Docs" />
              <PermissionBadge hasPermission={user.canAccessProdEnv !== false} label="Amb. Produção" />
              <PermissionBadge hasPermission={user.canAccessTestEnv} label="Amb. Testes" />
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};
