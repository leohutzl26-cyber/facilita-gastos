import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { canViewAdminPanel, isAdmin } from '@/utils/roles';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function GET(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user || !canViewAdminPanel(user)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        let query = supabaseSession
            .from('payments')
            .select('*, payment_receipts(id, receipt_id, amount_applied, receipts(id, merchant, amount, date, worker_email, status))')
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data: payments, error } = await query;

        if (error) throw error;

        return NextResponse.json({ payments: payments || [] });
    } catch (error: any) {
        console.error('Error fetching payments:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

export async function POST(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user || !isAdmin(user)) {
        return NextResponse.json({ error: 'No autorizado: se requiere rol de administrador.' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { fileBase64, amount, paid_at, notes } = body;

        if (!fileBase64) {
            return NextResponse.json({ error: 'Debes adjuntar un archivo' }, { status: 400 });
        }

        const matches = fileBase64.match(/^data:(.*?);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return NextResponse.json({ error: 'Formato de archivo inválido' }, { status: 400 });
        }

        const mimeType = matches[1] || 'application/octet-stream';
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const fileExt = mimeType.split('/')[1] || 'bin';
        const fileType = mimeType === 'application/pdf' ? 'pdf' : 'image';
        const fileName = `${user.id}/${Date.now()}_manual.${fileExt}`;

        const { error: uploadError } = await supabaseSession.storage
            .from('payment-proofs')
            .upload(fileName, buffer, {
                contentType: mimeType,
                upsert: false
            });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabaseSession.storage
            .from('payment-proofs')
            .getPublicUrl(fileName);

        const { data: payment, error: insertError } = await supabaseSession
            .from('payments')
            .insert([{
                amount: amount ? Number(amount) : null,
                paid_at: paid_at || null,
                file_url: urlData.publicUrl,
                file_type: fileType,
                source: 'manual',
                status: 'pendiente',
                uploaded_by: user.id,
                uploaded_by_email: user.email,
                notes: notes || null
            }])
            .select()
            .single();

        if (insertError) throw insertError;

        const adminDbClient = getAdminSupabase();
        await adminDbClient.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Comprobante Subido Manualmente',
            details: `Comprobante de pago cargado manualmente (${fileType}).`
        }]);

        return NextResponse.json({ success: true, payment });
    } catch (error: any) {
        console.error('Error creating manual payment:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
