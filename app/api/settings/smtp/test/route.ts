import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const config = await request.json();

    if (!config.host || !config.user || !config.password) {
      return NextResponse.json(
        { error: 'Configurações incompletas. Preencha host, usuário e senha.' },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: Number(config.port) || 587,
      secure: config.secure || false, // true for 465, false for other ports
      auth: {
        user: config.user,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: false // Helps with self-signed certs in dev/test
      }
    });

    await transporter.verify();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('SMTP Connection Error:', error);
    return NextResponse.json(
      { error: error.message || 'Falha ao conectar ao servidor SMTP' },
      { status: 500 }
    );
  }
}
