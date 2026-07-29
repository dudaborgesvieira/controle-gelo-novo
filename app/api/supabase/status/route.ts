import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.trim() === '' || url.includes('YOUR_SUPABASE_URL')) {
    return NextResponse.json({
      configured: false,
      message: 'Supabase URLs e chaves não configuradas no Secrets/.env.example',
      envVars: {
        NEXT_PUBLIC_SUPABASE_URL: Boolean(url),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(key),
      },
    });
  }

  try {
    const supabase = createClient(url, key);
    const { count, error } = await supabase.from('settings').select('*', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json({
        configured: true,
        connected: false,
        error: error.message,
        hint: 'Verifique se executou o arquivo supabase/schema.sql no SQL Editor do seu projeto Supabase.',
      });
    }

    return NextResponse.json({
      configured: true,
      connected: true,
      settingsCount: count,
      message: 'Conectado com sucesso ao banco de dados Supabase!',
    });
  } catch (err: any) {
    return NextResponse.json({
      configured: true,
      connected: false,
      error: err.message || 'Erro ao conectar com Supabase.',
    }, { status: 500 });
  }
}
