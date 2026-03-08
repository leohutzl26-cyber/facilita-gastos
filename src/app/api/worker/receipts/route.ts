import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { merchant, amount, date, category } = body;

        // Parse date to YYYY-MM-DD
        let formattedDate = new Date().toISOString().split('T')[0];
        try {
            // Very simple date parse attempt based on es-CL locale typical matches
            if (date.includes('/')) {
                const parts = date.split('/');
                if (parts.length === 3) {
                    if (parts[2].length === 2) parts[2] = '20' + parts[2]; // yy -> yyyy
                    formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            } else if (date.includes('-')) {
                const parts = date.split('-');
                if (parts.length === 3) {
                    if (parts[2].length === 2) parts[2] = '20' + parts[2];
                    formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
        } catch (e) { console.error("Could not parse date", e); }


        const cleanAmount = amount.replace(/[^\d.,]/g, '').replace(',', '.'); // Allow only digits and a dot

        const { error } = await supabaseSession
            .from('receipts')
            .insert([
                {
                    worker_id: user.id,
                    merchant: merchant,
                    amount: parseFloat(cleanAmount) || 0,
                    date: formattedDate,
                    category: category
                }
            ]);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error inserting receipt:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
