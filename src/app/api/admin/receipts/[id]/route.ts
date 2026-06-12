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

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    // Requisito: Sólo un Admin logueado puede editar recibos
    if (!user || user.user_metadata?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
    }

    try {
        const resolvedParams = await context.params;
        const receiptId = resolvedParams.id;

        const body = await request.json();
        const { merchant, merchant_rut, document_type, document_number, amount, date, category, project_id, location, status } = body;

        const adminSupabase = getAdminSupabase();

        // Obtener el estado anterior para registrar cambios en el log
        const { data: oldReceipt, error: fetchError } = await adminSupabase
            .from('receipts')
            .select('*')
            .eq('id', receiptId)
            .single();

        if (fetchError || !oldReceipt) {
            return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 444 });
        }

        const updateData: any = {};
        if (merchant !== undefined) updateData.merchant = merchant;
        if (merchant_rut !== undefined) updateData.merchant_rut = merchant_rut;
        if (document_type !== undefined) updateData.document_type = document_type;
        if (document_number !== undefined) updateData.document_number = document_number;
        if (amount !== undefined) updateData.amount = parseFloat(amount) || 0;
        if (date !== undefined) updateData.date = date;
        if (category !== undefined) updateData.category = category;
        if (project_id !== undefined) updateData.project_id = project_id === '' ? null : project_id;
        if (location !== undefined) updateData.location = location;
        if (status !== undefined) updateData.status = status;

        const { data: updatedReceipt, error: updateError } = await adminSupabase
            .from('receipts')
            .update(updateData)
            .eq('id', receiptId)
            .select('*, projects(id, name)')
            .single();

        if (updateError) throw updateError;

        // Construir detalles de cambios para la auditoría
        const changes: string[] = [];
        if (merchant && merchant !== oldReceipt.merchant) changes.push(`Comercio: ${oldReceipt.merchant} -> ${merchant}`);
        if (amount && parseFloat(amount) !== parseFloat(oldReceipt.amount)) changes.push(`Monto: $${oldReceipt.amount} -> $${amount}`);
        if (category && category !== oldReceipt.category) changes.push(`Categoría: ${oldReceipt.category} -> ${category}`);
        if (status && status !== oldReceipt.status) changes.push(`Estado: ${oldReceipt.status} -> ${status}`);
        if (date && date !== oldReceipt.date) changes.push(`Fecha: ${oldReceipt.date} -> ${date}`);

        const changeDetails = changes.length > 0 
            ? `Se editó el Recibo ID ${receiptId}. Cambios: ${changes.join(', ')}` 
            : `Se editó el Recibo ID ${receiptId} (sin cambios significativos en montos/estados).`;

        // Registrar en logs de auditoría
        await adminSupabase.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Editar Recibo',
            details: changeDetails
        }]);

        return NextResponse.json({ success: true, receipt: updatedReceipt });
    } catch (error: any) {
        console.error("Error updating individual receipt:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

