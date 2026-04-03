import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FileText, AlertCircle, CheckCircle } from "lucide-react";

interface Process {
  id: number;
  number: string;
  status: string;
  deadline_date?: string;
}

interface ProcessPopoverProps {
  clientId: number;
  clientName: string;
}

export function ProcessPopover({ clientId, clientName }: ProcessPopoverProps) {
  const [processes, setProcesses] = React.useState<Process[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);

  const fetchProcesses = async () => {
    // In a real implementation, you would fetch processes for this client
    // For now, we simulate with mock data or a call to a new RPC
    // const { data } = await supabase.from('processes').select('*').eq('client_id', clientId);
    setProcesses([
      { id: 1, number: '12345/2023', status: 'Em andamento' },
      { id: 2, number: '67890/2024', status: 'Atrasado', deadline_date: '2026-04-10' },
    ]);
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (open) fetchProcesses();
    }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <FileText className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Processos de {clientName}</h4>
            <p className="text-sm text-muted-foreground">
              Resumo dos processos ativos.
            </p>
          </div>
          <div className="grid gap-2">
            {processes.map((proc) => (
              <div key={proc.id} className="flex items-center justify-between text-sm">
                <span>{proc.number}</span>
                <span className={`flex items-center gap-1 ${proc.status === 'Atrasado' ? 'text-red-500' : 'text-green-500'}`}>
                  {proc.status === 'Atrasado' ? <AlertCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                  {proc.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
