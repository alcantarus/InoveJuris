import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://jhlxzqsgmudkbjkynqdl.supabase.co";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Missing env credentials", url: supabaseUrl, hasKey: !!supabaseServiceKey }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const sqlToRun = `
CREATE OR REPLACE FUNCTION process_contract_cancellation(
  p_contract_id BIGINT,
  p_reason TEXT,
  p_user_id BIGINT
) RETURNS JSONB AS $$
DECLARE
  v_has_payments BOOLEAN;
  v_old_obs TEXT;
BEGIN
  -- Validação de segurança para p_user_id (evitar violação de FK se o ID for inválido)
  IF p_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    p_user_id := NULL;
  END IF;

  -- 1. Check if there are any invalid installments (paid, reversed, etc.)
  -- Permitindo cancelamento de parcelas 'Prorrogada', 'Prorrogado', 'Estornado', 'Cancelada' ou 'Cancelado' desde que amountPaid = 0
  SELECT COALESCE(bool_or("amountPaid" > 0 OR lower(status) NOT IN ('aberto', 'atrasada', 'prorrogada', 'prorrogado', 'estornado', 'cancelada', 'cancelado')), false) INTO v_has_payments 
  FROM installments 
  WHERE contract_id = p_contract_id;
  
  IF v_has_payments THEN
    RAISE EXCEPTION 'Não é possível cancelar um contrato com parcelas recebidas ou em status inválido.';
  END IF;

  -- 2. Update contract
  SELECT observations INTO v_old_obs FROM contracts WHERE id = p_contract_id;
  
  UPDATE contracts 
  SET status = 'Cancelado',
      observations = COALESCE(v_old_obs, '') || E'\\n\\n' || '[CANCELAMENTO]: ' || p_reason,
      updated_by = p_user_id,
      "commissionValue" = 0,
      "commissionPaid" = FALSE
  WHERE id = p_contract_id;

  -- 3. Update all installments
  UPDATE installments 
  SET status = 'Cancelada',
      updated_by = p_user_id
  WHERE contract_id = p_contract_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
    `;

    console.log('[Fix Cancellation] Executing SQL via exec_sql...');
    
    // Try executing with 'sql' first
    let res = await supabase.rpc('exec_sql', { sql: sqlToRun });
    let error = res.error;
    let data = res.data;

    if (error) {
      console.error('[Fix Cancellation] Error:', error);
      return NextResponse.json({ success: false, error, attempt: 'sql' });
    }

    console.log('[Fix Cancellation] Success! RPC recreated.');
    return NextResponse.json({ success: true, message: "RPC recreated successfully!", data });
  } catch (err: any) {
    console.error('[Fix Cancellation] Catch Error:', err);
    return NextResponse.json({ success: false, error: err.message });
  }
}
