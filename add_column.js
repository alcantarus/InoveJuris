const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumn() {
  console.log('Adding environment column to product_diseases...');
  
  const { error } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE product_diseases ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'production';`
  });

  if (error) {
    console.error('Error adding column:', error);
  } else {
    console.log('Column added successfully or already exists.');
  }
}

addColumn();
