const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const cron = require('node-cron');

// Configuração do Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

let tarefasAtivas = [];

/**
 * Função para agendar os backups baseada no Supabase
 */
async function agendarBackups() {
    console.log('Recarregando cronogramas de backup do Supabase...');

    // 1. Para todas as tarefas ativas
    tarefasAtivas.forEach(tarefa => tarefa.stop());
    tarefasAtivas = [];

    // 2. Busca a configuração no Supabase
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'backup_schedules')
            .single();

        if (error) {
            console.error('Erro ao buscar schedules do Supabase:', error);
            return;
        }

        const schedules = data.value || []; // Array de objetos { days: [], time: 'HH:MM' }

        if (schedules.length === 0) {
            console.log('Nenhum agendamento de backup configurado.');
            return;
        }

        schedules.forEach(schedule => {
            const days = schedule.days || [];
            const time = schedule.time || '02:00';

            if (days.length === 0) return;

            const [hour, minute] = time.split(':');
            // Cron: minuto hora * * dias
            const cronExpression = `${minute} ${hour} * * ${days.join(',')}`;

            if (cron.validate(cronExpression)) {
                const tarefa = cron.schedule(cronExpression, () => {
                    console.log(`Executando backup: ${new Date().toLocaleString()}`);
                    executarBackup();
                });
                tarefasAtivas.push(tarefa);
                console.log(`Backup agendado para: ${cronExpression}`);
            } else {
                console.error(`Cron inválido gerado: ${cronExpression}`);
            }
        });
    } catch (error) {
        console.error('Erro ao processar configurações do Supabase:', error);
    }
}

/**
 * Lógica real de execução do backup
 */
async function executarBackup() {
    console.log('Iniciando processo de backup...');
    try {
        // Assume o servidor Next.js está rodando na porta 3000
        const response = await fetch('http://localhost:3000/api/backup/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sendEmail: true, smtpConfig: null, userId: 1 }), // Ajustar conforme necessário
        });
        
        if (response.ok) {
            console.log('Backup gerado com sucesso.');
        } else {
            console.error('Falha ao gerar backup:', await response.text());
        }
    } catch (error) {
        console.error('Erro ao chamar API de backup:', error);
    }
}

// Monitora alterações no Supabase (Polling simples a cada 1 minuto)
setInterval(agendarBackups, 60000);

// Inicialização
console.log('Agente de Backup iniciado.');
agendarBackups();
