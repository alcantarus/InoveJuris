const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuração do Supabase
// Prioriza variáveis específicas de ambiente se disponíveis
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_PROD || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('ERRO: Configurações do Supabase (URL ou KEY) não encontradas no .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

let tarefasAtivas = [];

/**
 * Função para agendar os backups baseada no Supabase
 */
async function agendarBackups() {
    console.log('--- Verificando agendamentos no Supabase ---');
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'backup_schedules')
            .maybeSingle();

        if (error) { 
            console.error('ERRO ao buscar schedules:', error); 
            return; 
        }
        
        const schedules = data ? data.value : [];

        // Limpa tarefas anteriores
        tarefasAtivas.forEach(tarefa => tarefa.stop());
        tarefasAtivas = [];

        if (!schedules || schedules.length === 0) {
            console.log('Nenhum agendamento configurado.');
            return;
        }

        schedules.forEach(schedule => {
            const days = schedule.days || [];
            const time = schedule.time || '02:00';
            if (days.length === 0) return;

            const [hour, minute] = time.split(':');
            const cronExpression = `${minute} ${hour} * * ${days.join(',')}`;

            if (cron.validate(cronExpression)) {
                const tarefa = cron.schedule(cronExpression, () => {
                    console.log(`[${new Date().toLocaleString()}] Disparando backup agendado...`);
                    executarBackup();
                });
                tarefasAtivas.push(tarefa);
                console.log(`Backup agendado: ${cronExpression}`);
            } else {
                console.error(`Expressão cron inválida: ${cronExpression}`);
            }
        });
    } catch (error) { 
        console.error('ERRO CRÍTICO ao agendar backups:', error); 
    }
}

/**
 * Lógica REAL de execução do backup (pg_dump) via Connection Pooler
 */
function executarBackup() {
    console.log('Iniciando processo de backup (pg_dump) via Pooler...');
    
    // Define a pasta de backup (ajuste conforme o SO, aqui mantendo o padrão do usuário)
    const pastaBackup = process.platform === 'win32' ? 'C:\\Backups' : path.join(process.cwd(), 'backups');
    
    try {
        if (!fs.existsSync(pastaBackup)) {
            fs.mkdirSync(pastaBackup, { recursive: true });
        }
    } catch (err) {
        console.error(`Erro ao criar pasta de backup: ${err.message}`);
        return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const arquivoBackup = path.join(pastaBackup, `backup-${timestamp}.sql`);

    // NOVA LÓGICA: Utilizando a Connection String do Pooler
    // A variável DB_URL_POOLER deve conter a URI completa com a senha URL-encoded
    const dbUrl = process.env.DB_URL_POOLER;

    if (!dbUrl) {
        console.error('ERRO: Variável de ambiente DB_URL_POOLER não definida.');
        registrarStatus('FAILURE', 'Variável DB_URL_POOLER ausente');
        return;
    }

    // Comando pg_dump com --dbname e modo verbose (-v)
    const comando = `pg_dump --dbname="${dbUrl}" -f "${arquivoBackup}" -v`;

    console.log('Executando pg_dump...');
    // Omitimos a impressão do comando completo por segurança (contém a senha)

    exec(comando, async (error, stdout, stderr) => {
        let status = 'SUCCESS';
        let errorMessage = null;

        if (error) {
            console.error(`ERRO CRÍTICO no pg_dump: ${error.message}`);
            status = 'FAILURE';
            errorMessage = error.message;
        } else {
            if (fs.existsSync(arquivoBackup)) {
                const stats = fs.statSync(arquivoBackup);
                if (stats.size === 0) {
                    console.error('ERRO: O arquivo de backup foi criado, mas está vazio!');
                    status = 'FAILURE';
                    errorMessage = 'Arquivo de backup vazio';
                } else {
                    console.log(`Backup realizado com sucesso! Arquivo: ${arquivoBackup} (${stats.size} bytes).`);
                }
            } else {
                console.error('ERRO: O arquivo de backup não foi criado!');
                status = 'FAILURE';
                errorMessage = 'Arquivo não criado';
            }
        }

        // Registra o status no Supabase
        await registrarStatus(status, errorMessage);
    });
}

/**
 * Atualiza o status do backup no Supabase para observabilidade
 */
async function registrarStatus(status, errorMessage) {
    try {
        const payload = {
            last_backup_date: new Date().toISOString(),
            status: status,
            error_message: errorMessage
        };

        const { error } = await supabase
            .from('system_settings')
            .upsert({
                key: 'backup_status',
                value: payload,
                environment: process.env.NEXT_PUBLIC_APP_ENV || 'production'
            }, {
                onConflict: 'key,environment'
            });

        if (error) {
            console.error('Erro ao registrar status no Supabase:', error.message);
        } else {
            console.log(`Status de backup (${status}) registrado no Supabase.`);
        }
    } catch (supaError) {
        console.error('Erro na integração com Supabase:', supaError);
    }
}

// Verifica agendamentos a cada 1 minuto
setInterval(agendarBackups, 60000);

// Execução inicial
console.log('Agente de Backup (InoveJuris) iniciado.');
agendarBackups();
