import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/roles';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function PATCH(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user || !isAdmin(user)) {
        return NextResponse.json({ error: 'No autorizado: se requiere rol de administrador.' }, { status: 401 });
    }

    try {
        const { id, status, rejection_reason } = await request.json();

        if (!id || !status) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
        }

        const updateData: any = { status };
        if (rejection_reason !== undefined) {
            updateData.rejection_reason = rejection_reason;
        }

        const { data, error } = await supabaseSession
            .from('receipts')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;

        // Auditoría
        const adminDbClient = getAdminSupabase();
        await adminDbClient.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Cambio Estado',
            details: `Recibo ID ${id} -> Estado: ${status}`
        }]);

        return NextResponse.json({ success: true, receipt: data[0] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
