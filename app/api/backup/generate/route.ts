import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import archiver from 'archiver';
import nodemailer from 'nodemailer';
import { defaultUrlProd, defaultKeyProd } from '@/lib/supabase';

// Helper to convert stream to buffer
async function streamToBuffer(stream: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on('data', (chunk: any) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sendEmail, smtpConfig, userId } = body;
    
    const cookieStore = await cookies();
    
    // Initialize Supabase Client
    // Try to use service role key if available to bypass RLS
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    const supabaseKey = serviceRoleKey || defaultKeyProd;
    
    const supabase = createClient(defaultUrlProd, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });

    // 1. Get list of tables in public schema
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    // Note: querying information_schema might fail with anon key if permissions are tight.
    // If so, we might need a hardcoded list or service role key.
    // Let's assume anon key has access or we use a fallback list.
    
    let tableNames: string[] = [];
    
    if (tablesError || !tables) {
      console.warn('Could not fetch tables from information_schema, using fallback list.', tablesError);
      // Fallback list of known tables
      tableNames = [
        'users', 
        'clients', 
        'sales', 
        'products', 
        'financial_records', 
        'system_settings',
        'audit_logs'
      ];
    } else {
      tableNames = tables.map((t: any) => t.table_name);
    }

    // 2. Create Archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    // Create a promise to handle the archiving process
    const archivePromise = streamToBuffer(archive);

    // 3. Fetch data and append to archive
    for (const tableName of tableNames) {
      let query = supabase.from(tableName).select('*');
      
      // Apply environment filter for all tables except 'users'
      if (tableName !== 'users') {
        // No longer filtering by environment
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching data for ${tableName}:`, error);
        // Add error log to zip?
        archive.append(JSON.stringify({ error: error.message }), { name: `${tableName}_error.json` });
      } else {
        // Format as JSON
        const jsonContent = JSON.stringify(data, null, 2);
        archive.append(jsonContent, { name: `${tableName}.json` });
        
        // Optional: Also add CSV?
        // For simplicity, just JSON as requested "JSON/CSV" (user said "JSON or CSV", JSON is easier to structure).
      }
    }

    // Finalize the archive
    archive.finalize();

    // Wait for buffer
    const zipBuffer = await archivePromise;

    // 4. Send Email if requested
    if (sendEmail && smtpConfig && smtpConfig.host) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpConfig.host,
          port: Number(smtpConfig.port) || 587,
          secure: smtpConfig.secure || false,
          auth: {
            user: smtpConfig.user,
            pass: smtpConfig.password,
          },
          tls: { rejectUnauthorized: false }
        });

        await transporter.sendMail({
          from: smtpConfig.from_email || smtpConfig.user,
          to: smtpConfig.user, // Send to self
          subject: `Backup do Sistema - ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
          text: `Segue em anexo o backup do sistema gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
          attachments: [
            {
              filename: `backup_${new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}.zip`,
              content: zipBuffer
            }
          ]
        });
        console.log('Email sent successfully');
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // We don't fail the request if email fails, just log it. 
        // The user will get the download anyway.
      }
    }

    // 4.5. Log to audit_logs and update backup_status
    let backupStatus = {
      last_backup_date: new Date().toISOString(),
      status: 'SUCCESS',
      error_message: null
    };

    try {
      await supabase.from('audit_logs').insert([{
        table_name: 'backups',
        action: 'generate',
        performed_by: Number(userId),
        new_data: {
          generated_at: new Date().toISOString()
        }
      }]);
      console.log('Backup registered in audit_logs');

      await supabase.from('backup_logs').insert([{
        user_id: userId || null,
        status: 'success',
        file_name: `backup_${new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}.zip`,
        message: 'Backup realizado com sucesso.'
      }]);
      console.log('Backup registered in backup_logs');
    } catch (auditError) {
      console.error('Error registering backup in audit_logs:', auditError);
      // Não falhamos o backup por causa do log
    } finally {
      // Update backup_status in system_settings
      console.log('Updating backup_status in system_settings:', backupStatus);
      const { error: updateError } = await supabase
        .from('system_settings')
        .upsert({
          key: 'backup_status',
          value: JSON.stringify(backupStatus)
        }, {
          onConflict: 'key'
        });
      
      if (updateError) {
        console.error('Error updating backup_status in system_settings:', updateError);
      } else {
        console.log('backup_status updated in system_settings successfully');
      }
    }

    // 5. Return the zip file
    return new NextResponse(zipBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="backup_${new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}.zip"`,
      },
    });

  } catch (error: any) {
    console.error('Backup Generation Error:', error);
    
    // Log failure to backup_status in system_settings
    try {
      const cookieStore = await cookies();
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
      const supabase = createClient(defaultUrlProd, serviceRoleKey || defaultKeyProd, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      await supabase
        .from('system_settings')
        .upsert({
          key: 'backup_status',
          value: JSON.stringify({ 
            last_backup_date: new Date().toISOString(),
            status: 'FAILURE',
            error_message: error.message || 'Falha desconhecida ao gerar backup'
          })
        }, {
          onConflict: 'key'
        });
      console.log('Backup failure logged to system_settings');
    } catch (logError) {
      console.error('Error logging backup failure to system_settings:', logError);
    }

    return NextResponse.json(
      { error: error.message || 'Falha ao gerar backup' },
      { status: 500 }
    );
  }
}
