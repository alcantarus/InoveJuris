'use client'

import React, { useRef, useState, useEffect } from 'react'
import html2canvas from 'html2canvas'
import { Download, X, Loader2, Image as ImageIcon, Type, User, Sparkles, Check, ChevronRight, PartyPopper } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { toast } from 'sonner'

interface BirthdayTemplate {
  id: string
  name: string
  image_url: string
  text_color: string
  name_y?: string
  name_x?: string
  name_size?: string
  name_max_width?: string
  name_font?: string
  msg_y?: string
  msg_x?: string
  msg_size?: string
  msg_max_width?: string
  msg_font?: string
  line_height?: string
  text_align?: 'left' | 'center' | 'right'
}

interface Client {
  id: number
  name: string
  birthDate?: string
}

interface BirthdayMessage {
  id: string
  content: string
}

// Fallback messages in case the database is empty or fails
const FALLBACK_MESSAGES = [
  "Neste dia especial, celebramos a sua vida e a honra de tê-lo(a) como cliente. Que este novo ciclo traga muita paz, saúde e vitórias em todos os seus caminhos.",
  "Feliz aniversário! Agradecemos a confiança depositada em nosso trabalho. Que seu novo ano de vida seja marcado por grandes conquistas e muita prosperidade.",
  "Hoje o dia é todo seu! Nossa equipe lhe deseja um feliz aniversário. Que a justiça, a paz e a alegria sejam constantes em sua jornada.",
  "Um brinde a você! Que a vida continue lhe presenteando com momentos inesquecíveis. Receba o abraço afetuoso de toda a nossa equipe neste dia tão especial.",
  "Hoje celebramos a sua vida! Que este novo ciclo seja de muita paz, saúde e justiça. É uma honra tê-lo(a) conosco.",
  "Feliz aniversário! Desejamos que seu caminho seja sempre iluminado e repleto de vitórias. Um abraço de toda a nossa equipe.",
  "Parabéns pelo seu dia! Que a felicidade seja constante e que possamos continuar trilhando juntos um caminho de sucesso.",
  "Nossos mais sinceros votos de felicidades! Que a vida lhe reserve grandes surpresas e muitas realizações neste novo ano.",
  "Celebrar o seu aniversário é celebrar uma parceria de confiança. Desejamos muita saúde, prosperidade e paz.",
  "Mais um ano de vida, mais um ano de conquistas! Que seus direitos sejam sempre preservados e seus sonhos realizados.",
  "Feliz aniversário! É um privilégio atuar na defesa dos seus interesses. Que a vida lhe retribua com muita alegria e tranquilidade.",
  "Parabéns! Que a sabedoria e a serenidade guiem seus passos neste novo ciclo. Felicidades de toda a nossa equipe jurídica.",
  "Um brinde à sua vida! Que a prosperidade e a justiça caminhem lado a lado com você todos os dias. Feliz aniversário!",
  "Nossa equipe se alegra com o seu dia. Que a sua jornada seja sempre pautada por grandes vitórias, segurança e paz.",
  "Hoje o dia amanheceu mais feliz. Receba nosso abraço e nossos votos de um ano extraordinário, repleto de saúde e sucesso.",
  "Desejamos que este novo capítulo da sua história seja escrito com tintas de alegria, saúde e muita paz. Parabéns!",
  "Feliz aniversário! Que a vida continue lhe presenteando com momentos inesquecíveis ao lado de quem você ama.",
  "Receba nossas homenagens neste dia tão especial. Que a saúde, o amor e a paz sejam suas companheiras diárias.",
  "Celebrar você é celebrar a confiança que nos une. Desejamos um aniversário maravilhoso e um ano de realizações plenas.",
  "Parabéns! Que o sucesso seja o destino inevitável de todos os seus projetos neste novo ano de vida. Felicidades!",
  "Parabéns pelo seu dia! Que a paz interior e a força para vencer transbordem em sua vida hoje e sempre.",
  "Nossos melhores votos para você! Que este novo ciclo traga renovação, força e muitas alegrias inesperadas.",
  "Feliz aniversário! Que cada novo dia seja uma oportunidade para grandes conquistas. Um abraço afetuoso de nossa equipe.",
  "Que a alegria deste dia se estenda por todos os meses do seu ano. Feliz aniversário, com os melhores cumprimentos do nosso escritório.",
  "Prezado(a) cliente, neste dia especial, renovamos nossos votos de estima e consideração. Que seu aniversário seja o início de um ano repleto de realizações pessoais e profissionais.",
  "A vida é um presente, e hoje celebramos a sua! Que a justiça e a felicidade sejam constantes em sua caminhada. Feliz aniversário!",
  "Com gratidão e respeito, desejamos um feliz aniversário! Que a saúde e a paz sejam suas aliadas em todos os momentos.",
  "Parabéns! Que a luz da sabedoria ilumine seus dias e que a justiça prevaleça em todos os seus pleitos. Felicidades!",
  "Hoje é dia de celebrar você! Agradecemos por nos permitir fazer parte da sua história. Um feliz e abençoado aniversário."
]

// Fallback templates
const FALLBACK_TEMPLATES: BirthdayTemplate[] = [
  {
    id: 'default-1',
    name: 'Clássico Escuro',
    image_url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?q=80&w=1080&auto=format&fit=crop',
    text_color: '#ffffff',
    name_y: '40%',
    name_x: '50%',
    name_size: '36px',
    msg_y: '60%',
    msg_x: '50%',
    msg_size: '14px',
    text_align: 'center'
  },
  {
    id: 'default-2',
    name: 'Elegante Claro',
    image_url: 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1080&auto=format&fit=crop',
    text_color: '#1e293b',
    name_y: '20%',
    name_x: '50%',
    name_size: '32px',
    msg_y: '80%',
    msg_x: '50%',
    msg_size: '14px',
    text_align: 'center'
  }
]

interface BirthdayCardGeneratorProps {
  clientName: string
  clientId: string
  onClose: () => void
  onSuccess: (clientId: string) => void
}

export function BirthdayCardGenerator({ clientName, clientId, onClose, onSuccess }: BirthdayCardGeneratorProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [templates, setTemplates] = useState<BirthdayTemplate[]>(FALLBACK_TEMPLATES)
  const [messages, setMessages] = useState<string[]>(FALLBACK_MESSAGES)
  
  const [selectedTemplate, setSelectedTemplate] = useState<BirthdayTemplate>(FALLBACK_TEMPLATES[0])
  const [selectedMessage, setSelectedMessage] = useState<string>(FALLBACK_MESSAGES[0])
  const [isGhostMode, setIsGhostMode] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)

  // Usa o nome completo
  const displayName = clientName || 'cliente';

  useEffect(() => {
    async function loadConfig() {
      console.log('Iniciando loadConfig no BirthdayCardGenerator...');
      try {
        setIsLoadingData(true)
        
        // Tenta buscar templates do banco
        const { data: dbTemplates, error: tError } = await supabase
          .from('birthday_templates')
          .select('*')
          
        if (!tError && dbTemplates && dbTemplates.length > 0) {
          console.log('Template selecionado:', dbTemplates[0]);
          setTemplates(dbTemplates)
          setSelectedTemplate(dbTemplates[0])
        }

        // Tenta buscar mensagens do banco
        const { data: dbMessages, error: mError } = await supabase
          .from('birthday_messages')
          .select('content')
          .eq('is_active', true) // Filtra apenas mensagens ativas
          
        if (mError) {
          console.error('Erro ao buscar mensagens do banco:', mError)
        }

        if (!mError && dbMessages && dbMessages.length > 0) {
          const msgContents = dbMessages.map((m: any) => m.content)
          console.log('Mensagens que serão exibidas no UI:', msgContents);
          setMessages(msgContents)
          setSelectedMessage(msgContents[0])
        } else {
          setMessages(FALLBACK_MESSAGES)
          setSelectedMessage(FALLBACK_MESSAGES[0])
        }

      } catch (error) {
        console.error('Erro ao carregar configurações de aniversário:', error)
        // Mantém os fallbacks em caso de erro
      } finally {
        setIsLoadingData(false)
      }
    }

    loadConfig()
  }, [])

  const handleDownload = async () => {
    if (!cardRef.current) return

    try {
      setIsGenerating(true)
      
      // Criar canvas em memória
      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = 1080
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Não foi possível criar contexto de canvas')

      // Carregar imagem de fundo
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = selectedTemplate.image_url
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Configurações de texto
      ctx.fillStyle = selectedTemplate.text_color || '#ffffff'
      ctx.textAlign = selectedTemplate.text_align || 'center'
      
      // Desenhar Nome
      if (!isGhostMode) {
        const nameSize = parseInt(selectedTemplate.name_size || '36') * 3
        ctx.font = `bold ${nameSize}px ${selectedTemplate.name_font || 'serif'}`
        const nameX = (parseInt(selectedTemplate.name_x || '50') / 100) * canvas.width
        const nameY = (parseInt(selectedTemplate.name_y || '40') / 100) * canvas.height
        ctx.fillText(displayName.toUpperCase(), nameX, nameY)

        // Desenhar Mensagem
        const msgSize = parseInt(selectedTemplate.msg_size || '14') * 3
        ctx.font = `${msgSize}px ${selectedTemplate.msg_font || 'sans-serif'}`
        const msgX = (parseInt(selectedTemplate.msg_x || '50') / 100) * canvas.width
        const msgY = (parseInt(selectedTemplate.msg_y || '60') / 100) * canvas.height
        
        // Quebra de linha simples para a mensagem
        const maxWidth = (parseInt(selectedTemplate.msg_max_width || '80') / 100) * canvas.width
        const words = selectedMessage.split(' ')
        let line = ''
        let y = msgY
        const lineHeight = msgSize * 1.4

        for (let i = 0; i < words.length; i++) {
          const testLine = line + words[i] + ' '
          const metrics = ctx.measureText(testLine)
          if (metrics.width > maxWidth && i > 0) {
            ctx.fillText(line, msgX, y)
            line = words[i] + ' '
            y += lineHeight
          } else {
            line = testLine
          }
        }
        ctx.fillText(line, msgX, y)
      }

      // Download
      const dataUrl = canvas.toDataURL('image/png', 1.0)
      const link = document.createElement('a')
      link.href = dataUrl
      const safeName = (displayName || 'cliente').toLowerCase().replace(/[^a-z0-9]/g, '')
      link.download = `aniversario-${safeName}.png`
      link.click()
      
      // Registrar no log de marketing
      try {
        const isIndicator = clientId.startsWith('indicator_')
        const isMaternity = clientId.startsWith('maternity_') || clientId === 'new'
        
        const numericIdStr = clientId.replace(/\D/g, '')
        const numericId = numericIdStr ? parseInt(numericIdStr, 10) : null
        
        // Ensure template_id is a valid UUID, otherwise pass null
        const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedTemplate.id)
        
        let logType = 'birthday_card_client'
        if (isIndicator) logType = 'birthday_card_indicator'
        if (isMaternity) logType = 'birthday_card_maternity'

        if (numericId !== null && !isNaN(numericId)) {
          const { error: logError } = await supabase.from('marketing_logs').insert([{
            client_id: numericId,
            template_id: isValidUUID ? selectedTemplate.id : null,
            type: logType
          }])
          
          if (logError) {
            console.error('Erro do Supabase ao salvar log:', logError)
          }
        } else {
          console.warn('Não foi possível registrar log: ID numérico inválido', clientId)
        }
      } catch (logError) {
        console.error('Erro ao salvar log de marketing:', logError)
      }

      // Confetti Effect
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4f46e5', '#8b5cf6', '#ec4899', '#10b981']
      })
      
      toast.success('Cartão gerado com sucesso!', {
        description: `O cartão de ${displayName || 'cliente'} foi baixado.`,
        icon: <PartyPopper className="w-5 h-5 text-indigo-600" />
      })

      onSuccess(clientId)
    } catch (error) {
      console.error('Erro detalhado ao gerar cartão:', error)
      toast.error('Erro ao gerar cartão', {
        description: error instanceof Error ? error.message : 'Não foi possível gerar a imagem.'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl flex flex-col md:flex-row my-auto relative z-[200] overflow-hidden h-[90vh] md:h-[80vh]"
      >
        
        {/* Painel de Configuração (Esquerda) */}
        <div className="w-full md:w-[45%] bg-white flex flex-col h-full border-r border-slate-100">
          <div className="flex items-center justify-between p-8 shrink-0">
            <div>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Personalizar Cartão</h3>
              <p className="text-sm text-slate-500 mt-1">Crie uma experiência única para {displayName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isLoadingData ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
              <p className="font-medium">Preparando recursos...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              
              {/* Seleção de Arte */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm uppercase tracking-wider">
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                  <span>Escolha o Tema</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all duration-300 ${
                        selectedTemplate.id === template.id 
                          ? 'border-indigo-600 ring-4 ring-indigo-600/10 shadow-xl scale-[1.02]' 
                          : 'border-slate-200 hover:border-indigo-300 hover:shadow-md'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={template.image_url} 
                        alt={template.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        crossOrigin="anonymous"
                      />
                      <div className={`absolute inset-0 transition-opacity duration-300 ${selectedTemplate.id === template.id ? 'bg-indigo-900/20' : 'bg-black/0 group-hover:bg-black/10'}`} />
                      
                      {selectedTemplate.id === template.id && (
                        <div className="absolute top-2 right-2 bg-indigo-600 text-white p-1.5 rounded-full shadow-lg">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seleção de Mensagem */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm uppercase tracking-wider">
                  <Type className="w-4 h-4 text-indigo-600" />
                  <span>Mensagem Personalizada</span>
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="ghostMode"
                    checked={isGhostMode}
                    onChange={(e) => setIsGhostMode(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="ghostMode" className="text-sm text-slate-700 font-medium">
                    Gerar card sem texto (Template Mídia Social)
                  </label>
                </div>
                
                <div className="relative">
                  <textarea
                    value={selectedMessage}
                    onChange={(e) => setSelectedMessage(e.target.value)}
                    disabled={isGhostMode}
                    className="w-full p-5 border border-slate-200 rounded-2xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none h-32 shadow-sm transition-all bg-slate-50 disabled:opacity-50"
                    placeholder="Escreva uma mensagem personalizada..."
                  />
                  <div className="absolute bottom-4 right-4 text-xs text-slate-400 font-medium pointer-events-none">
                    {selectedMessage.length} caracteres
                  </div>
                </div>

                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-3">
                  Modelos Sugeridos:
                </div>

                <div className="space-y-3 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                  {messages.map((msg, idx) => (
                    <div 
                      key={idx}
                      onClick={() => setSelectedMessage(msg)}
                      className={`relative p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                        selectedMessage === msg 
                          ? 'border-indigo-600 bg-indigo-50 shadow-sm' 
                          : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                      }`}
                    >
                      <p className={`text-xs leading-relaxed line-clamp-2 ${selectedMessage === msg ? 'text-indigo-900 font-medium' : 'text-slate-600'}`}>
                        {msg}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="p-8 border-t border-slate-100 bg-white shrink-0">
            <button
              onClick={handleDownload}
              disabled={isGenerating || isLoadingData}
              className="w-full flex items-center justify-center px-6 py-4 text-base font-bold text-white bg-indigo-600 rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:-translate-y-0.5"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Gerando Imagem...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Baixar Cartão
                </>
              )}
            </button>
          </div>
        </div>


        {/* Área de Preview (Direita) */}
        <div className="w-full md:w-[60%] bg-slate-100 flex flex-col relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          
          <div className="flex-1 flex items-center justify-center p-8 md:p-12 overflow-y-auto">
            <div className="relative group">
              {/* Glow Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              
              {/* O Cartão (O que será renderizado no PNG) */}
              <div
                ref={cardRef}
                className="relative w-full max-w-[500px] min-w-[400px] min-h-[400px] aspect-square shadow-2xl flex flex-col items-center justify-center text-center overflow-hidden bg-white"
                style={{
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  backgroundColor: '#ffffff'
                }}
              >
                {/* Imagem de Fundo (Arte do Social Media) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={selectedTemplate.image_url} 
                  alt="Fundo do Cartão"
                  className="absolute inset-0 w-full h-full object-cover z-0"
                  crossOrigin="anonymous"
                />

                {/* Overlay escuro/claro opcional para garantir leitura do texto */}
                {/* <div className="absolute inset-0 bg-black/10 z-10 pointer-events-none"></div> */}

                {/* Nome Dinâmico */}
                {!isGhostMode && (
                  <div 
                    className="absolute z-20"
                    style={{
                      top: selectedTemplate.name_y || '40%',
                      left: selectedTemplate.name_x || '50%',
                      transform: selectedTemplate.text_align === 'center' ? 'translate(-50%, -50%)' : selectedTemplate.text_align === 'right' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
                      color: selectedTemplate.text_color || '#ffffff',
                      fontSize: selectedTemplate.name_size || '36px',
                      textAlign: selectedTemplate.text_align || 'center',
                      width: 'fit-content',
                      maxWidth: selectedTemplate.name_max_width || '80%',
                      textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                      lineHeight: '1.1'
                    }}
                  >
                    <h1 className="font-serif font-bold uppercase tracking-widest drop-shadow-md m-0 leading-none">
                      {displayName}
                    </h1>
                  </div>
                )}

                {/* Mensagem Dinâmica */}
                {!isGhostMode && (
                  <div 
                    className="absolute z-20"
                    style={{
                      top: selectedTemplate.msg_y || '60%',
                      left: selectedTemplate.msg_x || '50%',
                      transform: selectedTemplate.text_align === 'center' ? 'translate(-50%, -50%)' : selectedTemplate.text_align === 'right' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
                      color: selectedTemplate.text_color || '#ffffff',
                      fontSize: selectedTemplate.msg_size || '14px',
                      textAlign: selectedTemplate.text_align || 'center',
                      width: 'fit-content',
                      maxWidth: selectedTemplate.msg_max_width || '80%',
                      textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      lineHeight: selectedTemplate.line_height || '1.4'
                    }}
                  >
                    <p className="font-sans leading-relaxed tracking-wide drop-shadow-md m-0">
                      {selectedMessage}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="p-4 text-center text-slate-400 text-xs">
             Preview em tempo real • Alta resolução na exportação
          </div>
        </div>
      </motion.div>
    </div>
  )
}
