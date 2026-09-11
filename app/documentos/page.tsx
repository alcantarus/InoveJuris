'use client'

import React, { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { FileText, Upload, X, Save, Download, ShieldAlert, BookOpen, Trash2, Search, CheckCircle2, User, FileCheck, ArrowRight, Wrench, ChevronUp, ChevronDown } from 'lucide-react'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { VariablesDictionary } from '@/components/documents/VariablesDictionary'
import { removeAccents } from '@/lib/utils'
import { motion, AnimatePresence } from 'motion/react'

// Função de Limpeza de Tags (String-based State Machine)
const cleanDuplicateTags = (xmlContent: string): string => {
  try {
    let xml = xmlContent;
    
    // 1. Remove noise tags that Word inserts
    xml = xml.replace(/<w:(proofErr|rsid[^>]*|lang|gramE|spellE|noBreakHyphen|softHyphen|lastRenderedPageBreak|bookmark[^>]*|commentRange[^>]*)[^>]*\/>/g, "");
    xml = xml.replace(/<w:(proofErr|rsid[^>]*|lang|gramE|spellE|bookmark[^>]*|commentRange[^>]*)>/g, "");
    xml = xml.replace(/<\/w:(proofErr|rsid[^>]*|lang|gramE|spellE|bookmark[^>]*|commentRange[^>]*)>/g, "");

    // 2. Merge split braces by removing XML tags between them
    // This safely turns [</w:t><w:t>[ into [[
    let previousXml = "";
    while (previousXml !== xml) {
        previousXml = xml;
        xml = xml.replace(/\[((?:<[^>]+>|\s)+)\[/g, '[[');
        xml = xml.replace(/\]((?:<[^>]+>|\s)+)\]/g, ']]');
    }

    // 3. Normalize multiple braces to exactly two (fixes [[[[ -> [[)
    xml = xml.replace(/\[\[+/g, "[[");
    xml = xml.replace(/\]\]+/g, "]]");

    return xml;
  } catch (e) {
    console.error("Erro na limpeza de tags:", e);
    return xmlContent;
  }
}

export default function DocumentosPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'gestao' | 'geracao'>('geracao')
  const hasSetInitialTab = useRef(false)
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false)
  const [showRepairTool, setShowRepairTool] = useState(false)

  useEffect(() => {
    if (user && !hasSetInitialTab.current) {
      if (!user.canAccessDocGeneration && user.canAccessDocTemplates) {
        setTimeout(() => setActiveTab('gestao'), 0)
      }
      hasSetInitialTab.current = true
    }
  }, [user])
  const [file, setFile] = useState<File | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [selectedClient2Id, setSelectedClient2Id] = useState<string | null>(null)
  const [templates, setTemplates] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos')

  const availableVariables = [
    { path: 'name', label: 'Nome do Cliente' },
    { path: 'email', label: 'E-mail' },
    { path: 'phone', label: 'Telefone' },
    { path: 'address', label: 'Endereço' },
    { path: 'addressNumber', label: 'Número' },
    { path: 'addressComplement', label: 'Complemento' },
    { path: 'neighborhood', label: 'Bairro' },
    { path: 'city', label: 'Cidade' },
    { path: 'uf', label: 'UF' },
    { path: 'cep', label: 'CEP' },
    { path: 'document', label: 'CPF/CNPJ' },
    { path: 'birthDate', label: 'Data de Nascimento' },
    { path: 'profession', label: 'Profissão' },
    { path: 'civilStatus', label: 'Estado Civil' },
    { path: 'pisNisNit', label: 'PIS/NIS/NIT' },
    { path: 'legalRepresentative', label: 'Representante Legal' },
  ]

  const [repairFile, setRepairFile] = useState<File | null>(null)
  const [isRepairing, setIsRepairing] = useState(false)

  const handleRepairUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setRepairFile(file)
    setIsRepairing(true)

    try {
        const arrayBuffer = await file.arrayBuffer()
        const zip = new PizZip(arrayBuffer)
        
        // Itera sobre TODOS os arquivos XML do documento (documento, cabeçalhos, rodapés)
        const filesToClean = Object.keys(zip.files).filter(path => 
            path.endsWith('.xml') && path.startsWith('word/')
        );

        let fixedCount = 0;

        if (filesToClean.length > 0) {
            filesToClean.forEach(filePath => {
                const docXml = zip.file(filePath)?.asText();
                if (docXml) {
                    const cleanedXml = cleanDuplicateTags(docXml);
                    if (cleanedXml !== docXml) {
                        fixedCount++;
                        zip.file(filePath, cleanedXml);
                    }
                }
            });
        }

        if (fixedCount > 0) {
            const out = zip.generate({ 
                type: 'blob', 
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
            })
            
            // Download automático
            const url = URL.createObjectURL(out)
            const a = document.createElement('a')
            a.href = url
            a.download = `CORRIGIDO_${file.name}`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            
            alert(`Sucesso! Encontramos e corrigimos erros em ${fixedCount} locais do arquivo. O download do arquivo corrigido iniciará automaticamente.\n\nPor favor, use este novo arquivo para gerar seus documentos.`)
        } else {
            alert('Não encontramos erros de tags duplicadas neste arquivo. Ele parece estar correto!')
        }

    } catch (error) {
        console.error('Erro ao reparar arquivo:', error)
        alert('Ocorreu um erro ao tentar reparar o arquivo. Verifique se é um .docx válido.')
    } finally {
        setIsRepairing(false)
        setRepairFile(null)
    }
  }

  const handleDeleteTemplate = async (templateId: string, fileUrl: string) => {
    if (!confirm('Tem certeza que deseja excluir este modelo? Esta ação não pode ser desfeita.')) return

    try {
      // 1. Delete variables first
      const { error: varError } = await supabase
        .from('template_variables')
        .delete()
        .eq('template_id', templateId)
        
      if (varError) throw varError

      // 2. Delete template record
      const { error: dbError } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', templateId)

      if (dbError) throw dbError

      // 3. Delete file from storage
      try {
        const urlParts = fileUrl.split('/')
        const fileName = urlParts[urlParts.length - 1]
        if (fileName) {
          await supabase.storage.from('templates').remove([fileName])
        }
      } catch (e) {
        console.error('Error deleting file from storage:', e)
      }

      // 4. Update UI
      setTemplates(prev => prev.filter(t => t.id !== templateId))
      if (selectedTemplateId === templateId) setSelectedTemplateId(null)
      alert('Modelo excluído com sucesso!')
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Erro ao excluir modelo. Tente novamente.')
    }
  }

  const handleGenerate = async () => {
    if (selectedTemplateId && selectedClientId) {
      await generateDocument(selectedTemplateId, selectedClientId, selectedClient2Id)
    } else {
      alert('Selecione um modelo e um cliente principal!')
    }
  }

  const fetchData = async () => {
    const { data: templatesData } = await supabase.from('document_templates').select('*')
    const { data: clientsData } = await supabase.from('clients').select('*')
    return { templatesData, clientsData }
  }

  useEffect(() => {
    const loadData = async () => {
      const { templatesData, clientsData } = await fetchData()
      setTemplates(templatesData || [])
      setClients(clientsData || [])
    }
    loadData()
  }, [])

  const [templateName, setTemplateName] = useState('')
  const [templateCategory, setTemplateCategory] = useState('Contratos')
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [client2Search, setClient2Search] = useState('')

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0]
    if (uploadedFile) {
      setFile(uploadedFile)
      setTemplateName(uploadedFile.name.replace('.docx', ''))
      
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
            const content = e.target?.result as ArrayBuffer
            const zip = new PizZip(content)
            
            // --- SANITIZAÇÃO DO XML ANTES DE EXTRAIR AS TAGS ---
            const filesToClean = Object.keys(zip.files).filter(path => 
                path.endsWith('.xml') && path.startsWith('word/')
            );
            
            if (filesToClean.length > 0) {
                filesToClean.forEach(filePath => {
                    const docXml = zip.file(filePath)?.asText();
                    if (docXml) {
                        const cleanedXml = cleanDuplicateTags(docXml);
                        if (cleanedXml !== docXml) {
                            zip.file(filePath, cleanedXml);
                        }
                    }
                });
            }
            // ---------------------------------------------------

            const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
            
            // Extract tags
            const text = doc.getFullText()
            
            // Check for double brackets [[ ]]
            const bracketRegex = /\[\[([^\]]+)\]\]/g
            const bracketMatches = Array.from(text.matchAll(bracketRegex), m => m[1].trim())
            
            const uniqueTags = Array.from(new Set(bracketMatches))

            if (uniqueTags.length === 0) {
                const singleBracketRegex = /\[([^\]]+)\]/g
                const singleMatches = Array.from(text.matchAll(singleBracketRegex))
                if (singleMatches.length > 0) {
                    // Aviso mais suave, sem bloquear ou assustar
                    console.warn('Possíveis colchetes simples detectados.')
                }
            }

            setTags(uniqueTags)
        } catch (error) {
            console.error("Erro ao processar arquivo:", error);
            alert("Erro ao processar o arquivo. Verifique se o documento possui tags válidas.");
        }
      }
      reader.readAsArrayBuffer(uploadedFile)
    }
  }

  const handleMappingChange = (tag: string, value: string) => {
    setMapping(prev => ({ ...prev, [tag]: value }))
  }

  const handleSaveTemplate = async () => {
    if (!file) return
    setIsSaving(true)
    
    try {
      // 1. Upload file to Supabase Storage
      console.log('Iniciando upload para o Storage...')
      const fileName = `${Date.now()}_${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('templates')
        .upload(fileName, file)

      if (uploadError) {
        console.error('Erro no Upload:', uploadError)
        throw new Error(`Erro no Upload do Arquivo: ${uploadError.message}`)
      }
      console.log('Upload concluído:', uploadData)

      const { data: publicUrlData } = supabase.storage.from('templates').getPublicUrl(fileName)

      // 2. Save template to DB
      console.log('Salvando no Banco de Dados...')
      const { data: template, error: templateError } = await supabase
        .from('document_templates')
        .insert({ 
          name: templateName, 
          category: templateCategory, 
          file_url: publicUrlData.publicUrl 
        })
        .select()
        .single()

      if (templateError) {
        console.error('Erro no Banco de Dados:', templateError)
        throw new Error(`Erro ao salvar no Banco de Dados: ${templateError.message}`)
      }
      console.log('Salvo no Banco de Dados:', template)

      // 3. Save variables mapping if any
      if (tags.length > 0) {
        const variables = Object.entries(mapping).map(([tag, path]) => ({
          template_id: template.id,
          variable_tag: tag,
          data_source_path: path,
          data_type: 'String'
        }))
        
        if (variables.length > 0) {
          const { error: varError } = await supabase
            .from('template_variables')
            .insert(variables)

          if (varError) throw varError
        }
      }

      alert('Modelo salvo com sucesso!')
      
      // Refresh list
      const { templatesData } = await fetchData()
      setTemplates(templatesData || [])
      
      // Reset form
      setFile(null)
      setTags([])
      setMapping({})
      setTemplateName('')
      setTemplateCategory('Contratos')
      
    } catch (error: any) {
      console.error('Error saving template:', error)
      if (error.message?.includes('Bucket not found') || error.error === 'Bucket not found') {
        alert('Erro: O bucket "templates" não foi encontrado no Supabase.\n\nPor favor, crie um bucket público chamado "templates" no painel do Supabase Storage.')
      } else {
        alert(`Erro ao salvar modelo: ${error.message || 'Erro desconhecido'}`)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const generateDocument = async (templateId: string, clientId: string, client2Id?: string | null) => {
    setIsGenerating(true)
    try {
      console.log('Iniciando geração de documento...')
      
      // 1. Fetch template and variables
      console.log('Buscando modelo:', templateId)
      const { data: template, error: templateError } = await supabase
        .from('document_templates')
        .select('*')
        .eq('id', templateId)
        .single()
      
      if (templateError) throw new Error(`Erro ao buscar modelo: ${templateError.message}`)
      if (!template) throw new Error('Modelo não encontrado')

      console.log('Buscando variáveis do modelo...')
      const { data: vars, error: varsError } = await supabase
        .from('template_variables')
        .select('*')
        .eq('template_id', templateId)

      if (varsError) throw new Error(`Erro ao buscar variáveis: ${varsError.message}`)

      if (!vars || vars.length === 0) {
        alert('AVISO: Este modelo não possui variáveis configuradas no sistema.\n\nO documento será gerado sem substituições. Se você espera ver dados preenchidos, verifique se fez o upload do modelo corretamente com as tags [[ ]] e se elas foram detectadas.')
      }

      // 2. Fetch client data
      console.log('Buscando dados do cliente:', clientId)
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()

      if (clientError) throw new Error(`Erro ao buscar cliente: ${clientError.message}`)
      if (!client) throw new Error('Cliente não encontrado')

      // Fetch second client if selected
      let client2 = null
      if (client2Id) {
        console.log('Buscando dados do segundo cliente:', client2Id)
        const { data: c2, error: c2Error } = await supabase
          .from('clients')
          .select('*')
          .eq('id', client2Id)
          .single()

        if (c2Error) throw new Error(`Erro ao buscar segundo cliente: ${c2Error.message}`)
        client2 = c2
      }

      // 3. Prepare data
      console.log('Preparando dados para substituição...')
      const templateContext: any = {
        clients: client,
        client2: client2,
        // Adicione outros contextos aqui se necessário (ex: process, contract)
      }
      
      const templateData: Record<string, string> = {}
      
      if (vars && vars.length > 0) {
        vars.forEach((v: { data_source_path: string; variable_tag: string }) => {
          // A tag no banco é salva SEM os colchetes, ex: "clients.name" ou "nome"
          // O docxtemplater espera a chave exatamente como está dentro do [[ ]] no Word.
          
          if (v.data_source_path) {
            // data_source_path é o caminho no objeto de dados, ex: "clients.name"
            const pathParts = v.data_source_path.split('.')
            
            let value = undefined
            try {
              // Tenta resolver o valor navegando no objeto templateContext
              value = pathParts.reduce((obj: any, key: string) => obj?.[key], templateContext)
            } catch (e) {
              console.warn(`Erro ao acessar caminho ${v.data_source_path}:`, e)
            }
            
            // Se o valor for encontrado, atribui. Se não, string vazia.
            templateData[v.variable_tag] = value !== undefined && value !== null ? String(value) : ''
          } else {
             templateData[v.variable_tag] = ''
          }
        })
      }
      
      console.log('Dados preparados:', templateData)

      // 4. Generate doc
      console.log('Baixando arquivo do template:', template.file_url)
      const response = await fetch(template.file_url)
      if (!response.ok) throw new Error(`Erro ao baixar arquivo do template: ${response.statusText}`)
      
      const arrayBuffer = await response.arrayBuffer()
      
      console.log('Processando DOCX...')
      
      let doc;
      try {
        // Carrega o zip
        const zip = new PizZip(arrayBuffer)
        let delimiters = { start: '[[', end: ']]' };

        // --- SANITIZAÇÃO DO XML (SOLUÇÃO DEFINITIVA - STRING STATE MACHINE) ---
        try {
            // Itera sobre TODOS os arquivos XML do documento (documento, cabeçalhos, rodapés)
            const filesToClean = Object.keys(zip.files).filter(path => 
                path.endsWith('.xml') && path.startsWith('word/')
            );

            if (filesToClean.length > 0) {
                console.log(`Executando Limpeza de Tags em ${filesToClean.length} arquivos...`);
                
                filesToClean.forEach(filePath => {
                    const docXml = zip.file(filePath)?.asText();
                    if (docXml) {
                        const cleanedXml = cleanDuplicateTags(docXml);
                        if (cleanedXml !== docXml) {
                            console.log(`Arquivo ${filePath} limpo com sucesso!`);
                            zip.file(filePath, cleanedXml);
                        }
                    }
                });
            }
        } catch (e) {
            console.warn("Falha na limpeza do XML:", e);
        }
        // ---------------------------------------------

        // Inicializa o Docxtemplater
        doc = new Docxtemplater(zip, { 
          paragraphLoop: true, 
          linebreaks: true,
          delimiters
        })
        
        // Define os dados e renderiza
        doc.setData(templateData)
        doc.render()
      } catch (error: any) {
        // Log profundo para debug no console do navegador
        console.error('ERRO CRÍTICO DOCXTEMPLATER:', error);
        if (error.properties && error.properties.errors) {
            console.error('Detalhes dos erros:', JSON.stringify(error.properties.errors, null, 2));
        }

        // Tratamento para MultiError (erros de sintaxe de tags)
        const errors = error?.properties?.errors || error?.errors;
        
        if (Array.isArray(errors) && errors.length > 0) {
           const messages = errors.map((e: any) => {
             return `- ${e.properties?.explanation || e.message || 'Erro desconhecido na tag'}`;
           }).join('\n');
           
           throw new Error(`Não foi possível corrigir automaticamente o modelo. Erros encontrados:\n${messages}\n\nPor favor, revise as variáveis no Word.`);
        }
        
        throw new Error(`Erro ao processar o modelo: ${error.message}`);
      }
      
      const out = doc.getZip().generate({ 
        type: 'blob', 
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      })
      
      // Download
      console.log('Iniciando download...')
      const url = URL.createObjectURL(out)
      const a = document.createElement('a')
      a.href = url
      const safeClientName = client.name ? client.name.replace(/[^a-z0-9]/gi, '_') : 'Cliente'
      a.download = `Documento_${safeClientName}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      console.log('Geração concluída com sucesso!')

    } catch (error: any) {
      console.error('Erro na geração do documento:', error)
      alert(`Falha ao gerar documento: ${error.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <ModuleHeader
          icon={FileText}
          title="Gestão de Documentos"
          description="Crie, gerencie e automatize seus documentos jurídicos."
        />
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
          {user?.canAccessDocGeneration && (
            <button 
              onClick={() => setActiveTab('geracao')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'geracao' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600'}`}
            >
              Geração de Documentos
            </button>
          )}
          {user?.canAccessDocTemplates && (
            <button 
              onClick={() => setActiveTab('gestao')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'gestao' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600'}`}
            >
              Gestão de Modelos
            </button>
          )}
        </div>

        {!user?.canAccessDocGeneration && !user?.canAccessDocTemplates ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
            <div className="bg-rose-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="text-rose-500" size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Acesso Restrito</h2>
            <p className="text-slate-500 mt-2">Você não tem permissão para acessar as funcionalidades deste módulo.</p>
          </div>
        ) : activeTab === 'gestao' ? (
          <div className="space-y-6">
            {/* Repair Tool Collapsible */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <button 
                    onClick={() => setShowRepairTool(!showRepairTool)}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                            <Wrench size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900">Ferramenta de Reparo</h3>
                            <p className="text-xs text-slate-500">Corrigir erros de tags duplicadas em arquivos Word</p>
                        </div>
                    </div>
                    {showRepairTool ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                </button>
                
                <AnimatePresence>
                    {showRepairTool && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="p-6 border-t border-slate-100 bg-white">
                                <div className="max-w-2xl mx-auto text-center">
                                    <p className="text-slate-600 mb-6 text-sm">
                                        Se você está recebendo erros de &quot;Duplicate Tags&quot; ou &quot;Multi Error&quot;, faça o upload do arquivo aqui para limpá-lo automaticamente.
                                    </p>

                                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 hover:bg-slate-50 transition-colors cursor-pointer relative">
                                        <input 
                                            type="file" 
                                            accept=".docx" 
                                            onChange={handleRepairUpload} 
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            disabled={isRepairing}
                                        />
                                        <div className="flex flex-col items-center">
                                            {isRepairing ? (
                                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
                                            ) : (
                                                <Upload className="w-10 h-10 text-slate-400 mb-4" />
                                            )}
                                            <span className="text-lg font-medium text-slate-700">
                                                {isRepairing ? 'Reparando...' : 'Selecionar arquivo com erro'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">Upload de Modelo</h2>
                <button
                  onClick={() => setIsDictionaryOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                >
                  <BookOpen size={18} />
                  Dicionário de Variáveis
                </button>
              </div>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center relative">
                {file ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-center gap-4">
                      <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                        <FileText size={32} />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-slate-900">{file.name}</p>
                        <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button 
                        onClick={() => {
                          setFile(null)
                          setTags([])
                          setMapping({})
                        }}
                        className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Modelo</label>
                        <input
                          type="text"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="Ex: Contrato de Honorários"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                        <select
                          value={templateCategory}
                          onChange={(e) => setTemplateCategory(e.target.value)}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="Contratos">Contratos</option>
                          <option value="Procurações">Procurações</option>
                          <option value="Petições">Petições</option>
                          <option value="Outros">Outros</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto text-slate-400 mb-4" size={48} />
                    <h3 className="text-lg font-bold text-slate-900">Arraste seus modelos .docx aqui</h3>
                    <p className="text-slate-500 mt-2">Ou clique para selecionar arquivos do seu computador.</p>
                    <input 
                      type="file" 
                      accept=".docx" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                      id="file-upload-input"
                    />
                    <label 
                      htmlFor="file-upload-input"
                      className="mt-6 inline-block px-6 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 cursor-pointer"
                    >
                      Selecionar Arquivo
                    </label>
                  </>
                )}
              </div>
            </div>

            {file && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-900">Configuração do Modelo</h2>
                  <button 
                    onClick={handleSaveTemplate}
                    disabled={isSaving || !templateName}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isSaving ? (
                      <span className="animate-pulse">Salvando...</span>
                    ) : (
                      <>
                        <Save size={18} />
                        Salvar Modelo
                      </>
                    )}
                  </button>
                </div>

                {tags.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                        <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">{tags.length}</span>
                        Variáveis detectadas:
                      </h3>
                      <div className="max-h-96 overflow-y-auto pr-2 space-y-3">
                        {tags.map(tag => (
                          <div key={tag} className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="font-mono text-indigo-700 text-sm font-medium w-1/3 truncate" title={tag}>
                              {`[[${tag}]]`}
                            </span>
                            <select 
                              className="flex-1 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                              value={mapping[tag] || ''}
                              onChange={(e) => handleMappingChange(tag, e.target.value)}
                            >
                              <option value="">Mapear campo (opcional)...</option>
                              <optgroup label="Cliente Principal">
                                {availableVariables.map(v => (
                                  <option key={`clients.${v.path}`} value={`clients.${v.path}`}>{v.label}</option>
                                ))}
                              </optgroup>
                              <optgroup label="Segundo Cliente">
                                {availableVariables.map(v => (
                                  <option key={`client2.${v.path}`} value={`client2.${v.path}`}>{v.label} (2º Cliente)</option>
                                ))}
                              </optgroup>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center h-full">
                      <BookOpen className="text-indigo-400 mb-3" size={32} />
                      <h3 className="font-semibold text-slate-700 mb-2">Dicionário de Variáveis</h3>
                      <p className="text-sm text-slate-500 mb-4">
                        Use o dicionário para copiar as variáveis corretas e colar no seu documento Word antes de fazer o upload.
                      </p>
                      <button
                        onClick={() => setIsDictionaryOpen(true)}
                        className="px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors text-sm font-medium shadow-sm"
                      >
                        Abrir Dicionário
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-slate-500 mb-2">Nenhuma variável detectada neste modelo.</p>
                    <p className="text-sm text-slate-400">
                      Você pode salvar o modelo mesmo assim, ou editar o arquivo Word adicionando variáveis como <code>{'[[nome]]'}</code> e fazer o upload novamente.
                    </p>
                  </div>
                )}
              </div>
            )}
            {/* Lista de Modelos Existentes */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Modelos Salvos</h2>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  Nenhum modelo salvo ainda.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map(template => (
                    <div key={template.id} className="group relative p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all bg-slate-50 hover:bg-white">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-lg border border-slate-100 text-indigo-600">
                            <FileText size={24} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900 line-clamp-1" title={template.name}>{template.name}</h3>
                            <p className="text-xs text-slate-500">{template.category || 'Geral'}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteTemplate(template.id, template.file_url)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Excluir modelo"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                        <span>Adicionado em {new Date(template.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Selection Steps */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Step 1: Template */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${selectedTemplateId ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {selectedTemplateId ? <CheckCircle2 size={18} /> : '1'}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Selecione o Modelo</h2>
                </div>
                
                {/* Category Filter */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 custom-scrollbar">
                  {['Todos', ...Array.from(new Set(templates.map(t => t.category || 'Geral')))].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        selectedCategory === cat 
                          ? 'bg-indigo-100 text-indigo-700' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Buscar modelo..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {templates
                    .filter(t => selectedCategory === 'Todos' || (t.category || 'Geral') === selectedCategory)
                    .filter(t => removeAccents(t.name.toLowerCase()).includes(removeAccents(templateSearch).toLowerCase()))
                    .map(t => (
                    <button 
                      key={t.id} 
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                        selectedTemplateId === t.id 
                          ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' 
                          : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${selectedTemplateId === t.id ? 'bg-indigo-100 text-indigo-700' : 'bg-white border border-slate-100 text-slate-500'}`}>
                        <FileText size={20} />
                      </div>
                      <div>
                        <h3 className={`font-semibold line-clamp-1 ${selectedTemplateId === t.id ? 'text-indigo-900' : 'text-slate-700'}`}>{t.name}</h3>
                        <p className="text-xs text-slate-500 mt-1">{t.category || 'Geral'}</p>
                      </div>
                    </button>
                  ))}
                  {templates.length === 0 && (
                    <div className="col-span-full text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
                      Nenhum modelo disponível. Faça o upload na aba &quot;Gestão de Modelos&quot;.
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Client */}
              <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-opacity duration-300 ${!selectedTemplateId ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${selectedClientId ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {selectedClientId ? <CheckCircle2 size={18} /> : '2'}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Selecione o Cliente Principal</h2>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {clients.filter(c => removeAccents(c.name.toLowerCase()).includes(removeAccents(clientSearch).toLowerCase())).map(c => (
                    <button 
                      key={c.id} 
                      onClick={() => setSelectedClientId(c.id)}
                      className={`p-4 rounded-xl border text-left flex items-center gap-3 transition-all ${
                        selectedClientId === c.id 
                          ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' 
                          : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${selectedClientId === c.id ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                        <User size={20} />
                      </div>
                      <div className="overflow-hidden">
                        <h3 className={`font-semibold truncate ${selectedClientId === c.id ? 'text-indigo-900' : 'text-slate-700'}`}>{c.name}</h3>
                        <p className="text-xs text-slate-500 truncate">{c.document || 'Sem documento'}</p>
                      </div>
                    </button>
                  ))}
                  {clients.length === 0 && (
                    <div className="col-span-full text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
                      Nenhum cliente cadastrado.
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Second Client (Optional) */}
              <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-opacity duration-300 ${!selectedClientId ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${selectedClient2Id ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {selectedClient2Id ? <CheckCircle2 size={18} /> : '3'}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Segundo Cliente <span className="text-sm font-normal text-slate-500">(Opcional)</span></h2>
                      <p className="text-sm text-slate-500">Ex: Responsável legal, fiador, cônjuge.</p>
                    </div>
                  </div>
                  {selectedClient2Id && (
                    <button 
                      onClick={() => setSelectedClient2Id(null)}
                      className="text-sm text-rose-500 hover:text-rose-600 font-medium"
                    >
                      Remover
                    </button>
                  )}
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Buscar segundo cliente..."
                    value={client2Search}
                    onChange={(e) => setClient2Search(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {clients.filter(c => c.id !== selectedClientId && removeAccents(c.name.toLowerCase()).includes(removeAccents(client2Search).toLowerCase())).map(c => (
                    <button 
                      key={c.id} 
                      onClick={() => setSelectedClient2Id(c.id)}
                      className={`p-4 rounded-xl border text-left flex items-center gap-3 transition-all ${
                        selectedClient2Id === c.id 
                          ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' 
                          : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${selectedClient2Id === c.id ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                        <User size={20} />
                      </div>
                      <div className="overflow-hidden">
                        <h3 className={`font-semibold truncate ${selectedClient2Id === c.id ? 'text-indigo-900' : 'text-slate-700'}`}>{c.name}</h3>
                        <p className="text-xs text-slate-500 truncate">{c.document || 'Sem documento'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Column: Summary & Action */}
            <div className="lg:col-span-1">
              <div className="bg-slate-900 rounded-3xl p-6 text-white sticky top-8 shadow-xl">
                <div className="mb-8">
                  <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-4 text-indigo-400">
                    <FileCheck size={24} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Resumo da Geração</h2>
                  <p className="text-slate-400 text-sm">
                    Revise as informações antes de gerar o documento final.
                  </p>
                </div>

                <div className="space-y-6 mb-8">
                  <div className="relative">
                    <div className="absolute left-4 top-8 bottom-[-16px] w-px bg-slate-700"></div>
                    
                    <div className="flex gap-4 relative z-10">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 ${selectedTemplateId ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                        <FileText size={14} />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Modelo</p>
                        {selectedTemplateId ? (
                          <p className="font-medium text-white">{templates.find(t => t.id === selectedTemplateId)?.name}</p>
                        ) : (
                          <p className="text-slate-500 italic">Aguardando seleção...</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    <div className={`absolute left-4 top-8 bottom-[-16px] w-px ${selectedClient2Id ? 'bg-slate-700' : 'bg-transparent'}`}></div>
                    <div className="flex gap-4 relative z-10">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 ${selectedClientId ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                        <User size={14} />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Cliente Principal</p>
                        {selectedClientId ? (
                          <p className="font-medium text-white">{clients.find(c => c.id === selectedClientId)?.name}</p>
                        ) : (
                          <p className="text-slate-500 italic">Aguardando seleção...</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedClient2Id && (
                    <div className="flex gap-4 relative z-10">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 bg-emerald-500 border-emerald-400 text-white">
                        <User size={14} />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Segundo Cliente</p>
                        <p className="font-medium text-white">{clients.find(c => c.id === selectedClient2Id)?.name}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-slate-800">
                  <button 
                    onClick={handleGenerate}
                    disabled={isGenerating || !selectedTemplateId || !selectedClientId}
                    className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25"
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Processando...
                      </>
                    ) : (
                      <>
                        Gerar Documento
                        <ArrowRight size={20} />
                      </>
                    )}
                  </button>
                  {(!selectedTemplateId || !selectedClientId) && (
                    <p className="text-center text-xs text-slate-500 mt-4">
                      Complete os passos ao lado para liberar a geração.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <VariablesDictionary isOpen={isDictionaryOpen} onClose={() => setIsDictionaryOpen(false)} />
    </DashboardLayout>
  )
}
