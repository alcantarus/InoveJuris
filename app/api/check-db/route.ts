import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const views = ['vw_process_velocity', 'vw_cash_flow_forecast', 'vw_area_efficiency'];
  const results = {};

  for (const view of views) {
    const { data, error } = await supabase.from(view).select('*').limit(5);
    results[view] = { data, error };
  }

  return NextResponse.json(results);
}
