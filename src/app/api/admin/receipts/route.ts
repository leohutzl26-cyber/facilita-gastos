import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // En un esquema real, validaríamos que el 'user' es ADMIN.
        // Aquí extraemos todos los recibos ordenados por fecha descendente
        const { data: receipts, error } = await supabaseSession
            .from('receipts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        return NextResponse.json({ receipts: receipts || [] });
    } catch (error: any) {
        console.error("Error fetching receipts:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
