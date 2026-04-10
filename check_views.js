const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Checking views...');
  
  const views = ['vw_process_velocity', 'vw_cash_flow_forecast', 'vw_area_efficiency'];
  
  for (const view of views) {
    const { data, error } = await supabase.from(view).select('*').limit(5);
    if (error) {
      console.error(`Error fetching ${view}:`, error);
    } else {
      console.log(`${view} data:`, data);
    }
  }
}

check();
