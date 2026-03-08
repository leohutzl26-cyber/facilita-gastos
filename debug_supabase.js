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
        const { data: integrations, error } = await supabase.from('google_integrations').select('*');
        if (error) {
            console.error("Supabase Query Error:", error);
        } else {
            console.log("GOOGLE INTEGRATIONS TABLE:");
            console.log(JSON.stringify(integrations, null, 2));
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}
check();
