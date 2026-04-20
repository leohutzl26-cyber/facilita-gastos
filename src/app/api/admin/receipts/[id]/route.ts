import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    // Requisito: Sólo un Admin logueado puede eliminar recibos
    if (!user || user.user_metadata?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
    }

    try {
        const adminSupabase = getAdminSupabase();

        // 1. Extraer ID asíncronamente (Next.js 15+)
        const resolvedParams = await context.params;
        const receiptId = resolvedParams.id;

        // 2. Eliminar el recibo específico de la tabla `receipts`
        const { error: deleteError } = await adminSupabase
            .from('receipts')
            .delete()
            .eq('id', receiptId);

        if (deleteError) throw deleteError;

        // Auditoría
        await adminSupabase.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Eliminar Recibo',
            details: `Se eliminó permanentemente el recibo ID: ${receiptId}`
        }]);

        return NextResponse.json({ success: true, message: 'Recibo eliminado correctamente' });
    } catch (error: any) {
        console.error("Error deleting individual receipt:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
