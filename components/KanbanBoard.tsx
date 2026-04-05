'use client'

import React, { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { supabase } from '@/lib/supabase'
import { cn, formatDate, getDeadlineStatus } from '@/lib/utils'
import { Clock, Calendar, AlertTriangle, User, Scale, FileText, MoreVertical, Plus, CheckCircle, Edit2, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useAuth } from '@/lib/auth'

interface KanbanColumn {
  id: string
  board_id: string
  title: string
  position: number
}

interface KanbanBoardProps {
  processes: any[]
  onProcessUpdate: () => void
  onEditProcess: (process: any) => void
}

export default function KanbanBoard({ processes, onProcessUpdate, onEditProcess }: KanbanBoardProps) {
  const { user } = useAuth()
  const isAdmin = user?.role_name === 'Administrador' || user?.email === 'admin@admin.com'

  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [boardId, setBoardId] = useState<string | null>(null)
  
  const [isAddingColumn, setIsAddingColumn] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [addingProcessToColumnId, setAddingProcessToColumnId] = useState<string | null>(null)
  const [newProcessNumber, setNewProcessNumber] = useState('')
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
  const [editingColumnTitle, setEditingColumnTitle] = useState('')
  const [activeColumnOptionsId, setActiveColumnOptionsId] = useState<string | null>(null)

  useEffect(() => {
    fetchColumns()
  }, [])

  const fetchColumns = async () => {
    try {
      // First, get the default board
      const { data: boardData, error: boardError } = await supabase
        .from('kanban_boards')
        .select('id')
        .eq('module', 'processes')
        .limit(1)
        .single()

      if (boardError) throw boardError
      if (!boardData) return

      setBoardId(boardData.id)

      // Then get columns for this board
      const { data: columnsData, error: columnsError } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('board_id', boardData.id)
        .order('position', { ascending: true })

      if (columnsError) throw columnsError
      setColumns(columnsData || [])
    } catch (error: any) {
      console.error('Error fetching kanban columns:', error);
    } finally {
      setLoading(false)
    }
  }

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    // Dropped outside the list
    if (!destination) return

    // Dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    const processId = draggableId
    const newColumnId = destination.droppableId
    const oldColumnId = source.droppableId

    // Optimistic UI update
    // We don't strictly need to update local state here if we rely on the parent's `processes` prop,
    // but for a smoother experience, we could. For now, we'll just call the DB and then refresh.
    
    try {
      // Get processes in the destination column, sorted by order
      let destinationProcesses = processes
        .filter(p => p.kanban_column_id === newColumnId)
        .sort((a, b) => (a.kanban_order || 0) - (b.kanban_order || 0));

      // If moving within the same column, remove the process from the list first
      if (oldColumnId === newColumnId) {
        destinationProcesses = destinationProcesses.filter(p => p.id.toString() !== processId.toString());
      }

      // Calculate new order
      let newOrder = 0;
      if (destinationProcesses.length === 0) {
        newOrder = 1000;
      } else if (destination.index === 0) {
        newOrder = (destinationProcesses[0].kanban_order || 0) - 1000;
      } else if (destination.index >= destinationProcesses.length) {
        newOrder = (destinationProcesses[destinationProcesses.length - 1].kanban_order || 0) + 1000;
      } else {
        const prevOrder = destinationProcesses[destination.index - 1].kanban_order || 0;
        const nextOrder = destinationProcesses[destination.index].kanban_order || 0;
        newOrder = (prevOrder + nextOrder) / 2;
      }

      // Update the process in the database
      const { error } = await supabase
        .from('processes')
        .update({ 
          kanban_column_id: newColumnId,
          kanban_order: newOrder
        })
        .eq('id', processId)

      if (error) throw error

      // Call the parent to refresh the data
      onProcessUpdate()
    } catch (error) {
      console.error('Error moving process:', error)
      alert('Erro ao mover o processo.')
      // The UI will snap back because we didn't optimistically update the parent's state
    }
  }

  const getDeadlineStatus = (deadlineDate: string | null | undefined) => {
    if (!deadlineDate) return 'none'
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const parts = deadlineDate.split('-')
    if (parts.length !== 3) return 'none'
    
    const [year, month, day] = parts.map(Number)
    const deadline = new Date(year, month - 1, day)
    
    const diffTime = deadline.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays <= 0) return 'expired'
    if (diffDays <= 7) return 'critical'
    if (diffDays <= 15) return 'warning'
    return 'safe'
  }

  const deleteProcess = async (processId: number) => {
    try {
      const { error } = await supabase
        .from('processes')
        .delete()
        .eq('id', processId);

      if (error) throw error;
      onProcessUpdate();
    } catch (error) {
      console.error('Error deleting process:', error);
      alert('Erro ao excluir processo.');
    }
  };

  const createProcess = async (columnId: string, number: string) => {
    try {
      const { data, error } = await supabase
        .from('processes')
        .insert({
          number,
          kanban_column_id: columnId,
          kanban_order: 1000,
        })
        .select()

      if (error) throw error
      onProcessUpdate()
    } catch (error) {
      console.error('Error creating process:', error)
      alert('Erro ao criar processo: ' + (error as any).message)
    }
  }

  const addColumn = async (title: string) => {
    try {
      const { error } = await supabase
        .from('kanban_columns')
        .insert({
          board_id: boardId,
          title,
          position: columns.length + 1
        })

      if (error) throw error
      await fetchColumns()
    } catch (error) {
      console.error('Error adding column:', error)
      alert('Erro ao adicionar coluna: ' + (error as any).message)
    }
  }

  const handleCreateProcess = async (columnId: string) => {
    if (!newProcessNumber) return
    await createProcess(columnId, newProcessNumber)
    setNewProcessNumber('')
    setAddingProcessToColumnId(null)
  }

  const handleAddColumn = async () => {
    if (!newColumnTitle || !boardId) return
    await addColumn(newColumnTitle)
    setNewColumnTitle('')
    setIsAddingColumn(false)
  }

  const handleRenameColumn = async (columnId: string) => {
    if (!editingColumnTitle.trim()) {
      setEditingColumnId(null)
      return
    }

    try {
      const { error } = await supabase
        .from('kanban_columns')
        .update({ title: editingColumnTitle.trim() })
        .eq('id', columnId)

      if (error) throw error

      await fetchColumns()
    } catch (error) {
      console.error('Error renaming column:', error)
      alert('Erro ao renomear a coluna.')
    } finally {
      setEditingColumnId(null)
    }
  }

  const handleDeleteColumn = async (columnId: string) => {
    // Check if column has processes
    const columnProcesses = processes.filter(p => p.kanban_column_id === columnId);
    if (columnProcesses.length > 0) {
      alert('Não é possível excluir uma coluna que contém processos. Mova os processos para outra coluna primeiro.');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir esta coluna? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('kanban_columns')
        .delete()
        .eq('id', columnId);

      if (error) {
        console.error('Error deleting column details:', error);
        throw error;
      }

      await fetchColumns();
      setActiveColumnOptionsId(null);
    } catch (error: any) {
      console.error('Full error object:', error);
      alert(`Erro ao excluir a coluna: ${error.message || 'Erro desconhecido'}`);
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
  }

  if (columns.length === 0) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Kanban não configurado</h3>
        <p className="text-slate-500 mb-4">Execute o script de configuração do Kanban no banco de dados.</p>
      </div>
    )
  }

  return (
    <div>
        {/* Add Column Button */}
        {isAdmin && (
          <div className="p-4">
            {isAddingColumn ? (
              <div className="bg-white p-4 rounded-2xl shadow-lg border border-indigo-200">
                <input 
                  type="text" 
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                  placeholder="Nome da coluna"
                  className="w-full p-2 border rounded-lg text-sm mb-2"
                />
                <div className="flex gap-2">
                  <button onClick={handleAddColumn} className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg">Adicionar</button>
                  <button onClick={() => setIsAddingColumn(false)} className="text-sm bg-slate-200 px-3 py-1.5 rounded-lg">Cancelar</button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => {
                  console.log('Botão Adicionar Nova Coluna clicado');
                  setIsAddingColumn(true);
                }}
                className="h-14 border-2 border-dashed border-indigo-500 rounded-2xl flex items-center justify-center gap-2 text-indigo-600 font-bold bg-indigo-50 hover:bg-indigo-100 transition-all w-80"
              >
                <Plus size={20} />
                Adicionar Nova Coluna
              </button>
            )}
          </div>
        )}
     <DragDropContext onDragEnd={onDragEnd}>
      <div className="relative">
        <div className="flex gap-6 overflow-x-auto pb-4 min-h-[600px] custom-scrollbar pr-12">
          {columns.map((column) => {
            // Filter and sort processes for this column
            const columnProcesses = processes.filter(p => 
              p.kanban_column_id === column.id || 
              // Fallback: if no kanban_column_id is set, try to map by status for the first column
              (!p.kanban_column_id && column.position === 1 && p.status === 'Em Andamento')
            ).sort((a, b) => (a.kanban_order || 0) - (b.kanban_order || 0));

            return (
              <div key={column.id} className="flex-shrink-0 w-56 flex flex-col bg-slate-50/50 rounded-2xl border border-slate-200/60">
                {/* Column Header */}
                <div 
                  className="p-4 border-b border-slate-200/60 flex items-center justify-between bg-white/50 rounded-t-2xl border-t-4"
                  style={{ borderTopColor: (column as any).color || '#6366f1' }}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {editingColumnId === column.id ? (
                      <input
                        type="text"
                        value={editingColumnTitle}
                        onChange={(e) => setEditingColumnTitle(e.target.value)}
                        onBlur={() => handleRenameColumn(column.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameColumn(column.id);
                          } else if (e.key === 'Escape') {
                            setEditingColumnId(null);
                          }
                        }}
                        autoFocus
                        className="font-semibold text-slate-800 bg-white border border-indigo-300 rounded px-1 py-0.5 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    ) : (
                      <h3 
                        className={cn(
                          "font-semibold text-slate-800 truncate text-sm transition-colors",
                          isAdmin ? "cursor-pointer hover:text-indigo-600" : ""
                        )}
                        onClick={() => {
                          if (isAdmin) {
                            setEditingColumnId(column.id);
                            setEditingColumnTitle(column.title);
                          }
                        }}
                        title={isAdmin ? "Clique para renomear" : ""}
                      >
                        {column.title}
                      </h3>
                    )}
                    <span className="bg-slate-200 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                      {columnProcesses.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="relative">
                      <button 
                        onClick={() => setAddingProcessToColumnId(column.id)}
                        className="text-slate-400 hover:text-indigo-600 p-1 rounded-md hover:bg-indigo-50 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                      {addingProcessToColumnId === column.id && (
                        <div className="absolute right-0 top-8 z-10 bg-white p-2 rounded-lg shadow-lg border border-slate-200 w-48">
                          <input 
                            type="text" 
                            value={newProcessNumber}
                            onChange={(e) => setNewProcessNumber(e.target.value)}
                            placeholder="Número do processo"
                            className="w-full p-1 border rounded text-sm mb-2"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => handleCreateProcess(column.id)} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">Criar</button>
                            <button onClick={() => setAddingProcessToColumnId(null)} className="text-xs bg-slate-200 px-2 py-1 rounded">Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="relative">
                        <button 
                          onClick={() => setActiveColumnOptionsId(activeColumnOptionsId === column.id ? null : column.id)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {activeColumnOptionsId === column.id && (
                          <div className="absolute right-0 top-8 z-10 bg-white rounded-lg shadow-lg border border-slate-200 w-36 py-1">
                            <button
                              onClick={() => {
                                setEditingColumnId(column.id);
                                setEditingColumnTitle(column.title);
                                setActiveColumnOptionsId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              Renomear
                            </button>
                            <button
                              onClick={() => handleDeleteColumn(column.id)}
                              className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={column.id.toString()}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex-1 p-3 flex flex-col gap-3 transition-colors min-h-[150px]",
                        snapshot.isDraggingOver ? "bg-indigo-50/50" : ""
                      )}
                    >
                      {columnProcesses.map((process, index) => (
                        <Draggable key={process.id} draggableId={process.id.toString()} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                "bg-white p-4 rounded-xl border shadow-sm transition-all group cursor-pointer",
                                snapshot.isDragging ? "shadow-lg border-indigo-300 rotate-2 scale-105" : "border-slate-200 hover:border-indigo-200 hover:shadow-md",
                                process.priority === 'Alta' ? "border-l-4 border-l-rose-500" : 
                                process.priority === 'Média' ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-blue-500"
                              )}
                            >
                              {/* Card Content */}
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <span className={cn(
                                    "font-bold uppercase tracking-wider",
                                    process.priority === 'Alta' ? "text-rose-600" : 
                                    process.priority === 'Média' ? "text-amber-600" : "text-blue-600"
                                  )}>{process.priority}</span>
                                  <span>•</span>
                                  <span>{process.court || 'TRF1'}</span>
                                </div>
                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditProcess(process);
                                      }}
                                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('Tem certeza que deseja excluir este processo?')) {
                                          deleteProcess(process.id);
                                        }
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                </div>
                              </div>

                              <h4 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-indigo-600 transition-colors line-clamp-1">
                                {process.number}
                              </h4>
                              
                              <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-3">
                                <User size={12} className="text-slate-400" />
                                <span className="truncate">{process.client}</span>
                              </div>

                              {/* Deadlines */}
                              {(process.process_deadlines && process.process_deadlines.length > 0) && (() => {
                                const nearestDeadline = process.process_deadlines.reduce((prev: any, curr: any) => {
                                  if (!prev) return curr;
                                  if (!curr.deadline_date) return prev;
                                  const prevDate = new Date(prev.deadline_date);
                                  const currDate = new Date(curr.deadline_date);
                                  return currDate < prevDate ? curr : prev;
                                }, null);
                                
                                if (!nearestDeadline || !nearestDeadline.deadline_date) return null;

                                const status = getDeadlineStatus(nearestDeadline.deadline_date);
                                const isValidDate = !isNaN(new Date(nearestDeadline.deadline_date).getTime());

                                return (
                                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                                    <div className={cn(
                                      "flex items-center gap-1.5 text-[11px] font-medium",
                                      status === 'expired' ? "text-rose-600" :
                                      status === 'critical' ? "text-orange-600" :
                                      status === 'warning' ? "text-amber-600" :
                                      "text-emerald-600"
                                    )}>
                                      {status === 'expired' ? <AlertTriangle size={12} /> : 
                                       status === 'critical' ? <Clock size={12} /> : <Calendar size={12} />}
                                      <span>{isValidDate ? formatDate(nearestDeadline.deadline_date) : 'Data inválida'}</span>
                                      <div className={cn("w-2 h-2 rounded-full", 
                                        status === 'expired' ? "bg-rose-500" :
                                        status === 'critical' ? "bg-orange-500" :
                                        status === 'warning' ? "bg-amber-500" :
                                        "bg-emerald-500"
                                      )} />
                                    </div>
                                    <p className="text-[10px] text-slate-500 truncate">{nearestDeadline.description}</p>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
        {/* Gradient overlay on the right */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-slate-50 to-transparent" />
      </div>
    </DragDropContext>
    </div>
  )
}
