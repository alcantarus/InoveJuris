import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreVertical, Gift, User, Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ClientActions({ client, onEdit, onDelete, onBirthday }: { client: any, onEdit: () => void, onDelete: () => void, onBirthday: () => void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
          <MoreVertical size={18} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="min-w-[160px] bg-white rounded-xl p-2 shadow-lg border border-slate-100 z-50">
          <DropdownMenu.Item onClick={onBirthday} className="flex items-center gap-2 px-2 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer">
            <Gift size={16} /> Card Aniversário
          </DropdownMenu.Item>
          <DropdownMenu.Item onClick={() => window.location.href = `/clientes/${client.id}`} className="flex items-center gap-2 px-2 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer">
            <User size={16} /> Ver Perfil
          </DropdownMenu.Item>
          <DropdownMenu.Item onClick={onEdit} className="flex items-center gap-2 px-2 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer">
            <Edit2 size={16} /> Editar
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="h-[1px] bg-slate-100 my-1" />
          <DropdownMenu.Item onClick={onDelete} className="flex items-center gap-2 px-2 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer">
            <Trash2 size={16} /> Excluir
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
