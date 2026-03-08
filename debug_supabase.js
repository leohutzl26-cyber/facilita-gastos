const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: adminToken, error } = await supabase.from('google_integrations').select('*');
    console.log("GOOGLE INTEGRATIONS TABLE:");
    console.log(JSON.stringify(adminToken, null, 2));

    const { data: receipts } = await supabase.from('receipts').select('*');
    console.log("\nRECEIPTS TABLE:");
    console.log(JSON.stringify(receipts, null, 2));
}
check();
