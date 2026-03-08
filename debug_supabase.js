const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase URL or Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    try {
        const { data: receipts, error } = await supabase.from('receipts').select('*').order('created_at', { ascending: false }).limit(3);
        if (error) {
            console.error("Supabase Query Error:", error);
        } else {
            console.log("RECEIPTS TABLE (Last 3):");
            console.log(JSON.stringify(receipts, null, 2));
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}
check();
