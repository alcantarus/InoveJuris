'use server'

import { GoogleGenAI } from "@google/genai";

export async function getGeminiApiKey() {
  return process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
}

export async function analyzeTemplateImage(base64Image: string, manualApiKey?: string) {
  // Ordem de busca: 1. Chave manual enviada pelo usuário, 2. Segredos do Servidor
  const apiKey = 
    manualApiKey ||
    process.env.GEMINI_API_KEY || 
    process.env.NEXT_PUBLIC_GEMINI_API_KEY || 
    process.env.GOOGLE_API_KEY || 
    process.env.API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    return { 
      error: 'Chave do Gemini não encontrada. Por favor, insira a chave no campo de configuração acima ou nos Segredos do projeto.' 
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: `Aja como um Diretor de Arte Sênior. Sua tarefa é posicionar textos em um card de aniversário com perfeição estética e legibilidade máxima.
            
            REGRAS DE OURO DE DESIGN:
            1. MARGENS: Mantenha todos os textos a pelo menos 10% de distância das bordas.
            2. DISTANCIAMENTO (UX): O Nome e a Mensagem NUNCA devem se sobrepor. Deve haver um respiro vertical de pelo menos 15% entre eles.
            3. TAMANHOS MÁXIMOS: 
               - Nome: Máximo 32px (deve ser elegante, não gigante).
               - Mensagem: Máximo 16px (tamanho de leitura).
            4. MAPEAMENTO DE OBSTÁCULOS: Identifique visualmente:
               - Onde está o texto 'Feliz Aniversário' original.
               - Onde está o bolo e os balões.
               - Onde está o logotipo no rodapé.
               PROIBIDO colocar texto sobre essas áreas.
            5. ALINHAMENTO: Se a imagem tem elementos pesados na direita (como o bolo), alinhe o texto à ESQUERDA ou CENTRO-ESQUERDA para equilibrar o peso visual.
            6. CORES: Use cores da paleta da imagem (ex: o dourado dos balões ou o marrom do bolo) para o texto, garantindo contraste.

            Retorne APENAS este JSON:
            {
              "name_x": "string (ex: 15%)",
              "name_y": "string (ex: 40%)",
              "name_size": "string (ex: 28px)",
              "msg_x": "string (ex: 15%)",
              "msg_y": "string (ex: 55%)",
              "msg_size": "string (ex: 14px)",
              "text_color": "hex_color",
              "text_align": "left|center|right",
              "max_width": "string (ex: 250px)",
              "line_height": "string (ex: 1.4)"
            }` },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        }
      ]
    });

    const responseText = response.text || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      return { error: 'IA não retornou um formato válido.' };
    }

    return { data: JSON.parse(jsonMatch[0]) };
  } catch (error: any) {
    console.error('Gemini Server Error:', error);
    return { error: error.message || 'Erro ao processar imagem com IA.' };
  }
}
