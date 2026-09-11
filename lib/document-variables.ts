
export interface DocumentVariable {
  label: string;
  tag: string;
  description: string;
}

export interface VariableCategory {
  id: string;
  title: string;
  variables: DocumentVariable[];
}

export const DOCUMENT_VARIABLES: VariableCategory[] = [
  {
    id: 'client_pf',
    title: 'Cliente Principal (Pessoa Física)',
    variables: [
      { label: 'Nome Completo', tag: '[[clients.name]]', description: 'Nome completo do cliente' },
      { label: 'CPF', tag: '[[clients.document]]', description: 'CPF do cliente (formatado)' },
      { label: 'RG', tag: '[[clients.rg]]', description: 'Registro Geral' },
      { label: 'Data de Nascimento', tag: '[[clients.birthDate]]', description: 'Data de nascimento (DD/MM/AAAA)' },
      { label: 'Nacionalidade', tag: '[[clients.nationality]]', description: 'Nacionalidade do cliente' },
      { label: 'Estado Civil', tag: '[[clients.civilStatus]]', description: 'Estado civil (Solteiro, Casado, etc.)' },
      { label: 'Profissão', tag: '[[clients.profession]]', description: 'Profissão do cliente' },
      { label: 'Email', tag: '[[clients.email]]', description: 'Endereço de email' },
      { label: 'Telefone', tag: '[[clients.phone]]', description: 'Telefone principal' },
      { label: 'Nome da Mãe', tag: '[[clients.motherName]]', description: 'Nome da mãe do cliente' },
      { label: 'Nome do Pai', tag: '[[clients.fatherName]]', description: 'Nome do pai do cliente' },
    ]
  },
  {
    id: 'client_address',
    title: 'Endereço do Cliente Principal',
    variables: [
      { label: 'Logradouro', tag: '[[clients.address]]', description: 'Rua, Avenida, etc.' },
      { label: 'Número', tag: '[[clients.addressNumber]]', description: 'Número do endereço' },
      { label: 'Complemento', tag: '[[clients.addressComplement]]', description: 'Apto, Bloco, etc.' },
      { label: 'Bairro', tag: '[[clients.neighborhood]]', description: 'Bairro' },
      { label: 'Cidade', tag: '[[clients.city]]', description: 'Cidade' },
      { label: 'Estado (UF)', tag: '[[clients.uf]]', description: 'Sigla do estado (ex: SP)' },
      { label: 'CEP', tag: '[[clients.cep]]', description: 'CEP formatado' },
    ]
  },
  {
    id: 'client2_pf',
    title: 'Segundo Cliente / Responsável Legal',
    variables: [
      { label: 'Nome Completo', tag: '[[client2.name]]', description: 'Nome completo do 2º cliente' },
      { label: 'CPF', tag: '[[client2.document]]', description: 'CPF do 2º cliente (formatado)' },
      { label: 'RG', tag: '[[client2.rg]]', description: 'Registro Geral' },
      { label: 'Data de Nascimento', tag: '[[client2.birthDate]]', description: 'Data de nascimento (DD/MM/AAAA)' },
      { label: 'Nacionalidade', tag: '[[client2.nationality]]', description: 'Nacionalidade do 2º cliente' },
      { label: 'Estado Civil', tag: '[[client2.civilStatus]]', description: 'Estado civil (Solteiro, Casado, etc.)' },
      { label: 'Profissão', tag: '[[client2.profession]]', description: 'Profissão do 2º cliente' },
      { label: 'Email', tag: '[[client2.email]]', description: 'Endereço de email' },
      { label: 'Telefone', tag: '[[client2.phone]]', description: 'Telefone principal' },
      { label: 'Logradouro', tag: '[[client2.address]]', description: 'Rua, Avenida, etc.' },
      { label: 'Número', tag: '[[client2.addressNumber]]', description: 'Número do endereço' },
      { label: 'Complemento', tag: '[[client2.addressComplement]]', description: 'Apto, Bloco, etc.' },
      { label: 'Bairro', tag: '[[client2.neighborhood]]', description: 'Bairro' },
      { label: 'Cidade', tag: '[[client2.city]]', description: 'Cidade' },
      { label: 'Estado (UF)', tag: '[[client2.uf]]', description: 'Sigla do estado (ex: SP)' },
      { label: 'CEP', tag: '[[client2.cep]]', description: 'CEP formatado' },
    ]
  },
  {
    id: 'process',
    title: 'Dados do Processo',
    variables: [
      { label: 'Número do Processo', tag: '[[process.number]]', description: 'Número CNJ formatado' },
      { label: 'Vara/Juízo', tag: '[[process.court]]', description: 'Vara ou Juízo do processo' },
      { label: 'Comarca', tag: '[[process.district]]', description: 'Comarca' },
      { label: 'Valor da Causa', tag: '[[process.value]]', description: 'Valor da causa formatado (R$)' },
      { label: 'Fase Processual', tag: '[[process.phase]]', description: 'Fase atual do processo' },
      { label: 'Status', tag: '[[process.status]]', description: 'Status atual (ex: Em andamento)' },
      { label: 'Tipo de Ação', tag: '[[process.type]]', description: 'Tipo da ação judicial' },
      { label: 'Parte Contrária', tag: '[[process.opposingParty]]', description: 'Nome da parte contrária' },
    ]
  },
  {
    id: 'contract',
    title: 'Dados do Contrato/Financeiro',
    variables: [
      { label: 'Valor do Contrato', tag: '[[contract.contractValue]]', description: 'Valor total do contrato (R$)' },
      { label: 'Forma de Pagamento', tag: '[[contract.paymentMethod]]', description: 'Ex: Boleto, Cartão' },
      { label: 'Qtd. Parcelas', tag: '[[contract.installmentsCount]]', description: 'Número de parcelas' },
      { label: 'Data do Contrato', tag: '[[contract.contractDate]]', description: 'Data de assinatura' },
      { label: 'Honorários (%)', tag: '[[contract.commissionPercent]]', description: 'Percentual de honorários' },
      { label: 'Honorários (R$)', tag: '[[contract.commissionValue]]', description: 'Valor dos honorários' },
    ]
  },
  {
    id: 'product',
    title: 'Produto/Serviço',
    variables: [
      { label: 'Nome do Produto', tag: '[[product.name]]', description: 'Nome do serviço contratado' },
      { label: 'Área do Direito', tag: '[[product.lawArea]]', description: 'Área jurídica (Cível, Trabalhista...)' },
    ]
  },
  {
    id: 'lawyer',
    title: 'Dados do Advogado/Escritório',
    variables: [
      { label: 'Nome do Advogado', tag: '[[lawyer.name]]', description: 'Nome do advogado responsável' },
      { label: 'OAB', tag: '[[lawyer.oab]]', description: 'Número da OAB' },
      { label: 'Email do Advogado', tag: '[[lawyer.email]]', description: 'Email profissional' },
    ]
  },
  {
    id: 'date',
    title: 'Datas e Locais',
    variables: [
      { label: 'Data Atual (Extenso)', tag: '[[currentDateExt]]', description: 'Ex: 01 de Janeiro de 2024' },
      { label: 'Data Atual (Curta)', tag: '[[currentDate]]', description: 'Ex: 01/01/2024' },
      { label: 'Cidade do Escritório', tag: '[[officeCity]]', description: 'Cidade configurada no sistema' },
    ]
  }
];
