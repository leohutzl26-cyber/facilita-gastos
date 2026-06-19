import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

// DELETE: Eliminar un gasto por el colaborador
export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const resolvedParams = await context.params;
        const receiptId = resolvedParams.id;

        // 1. Obtener el recibo para validar dueño y estado
        const { data: receipt, error: fetchError } = await supabaseSession
            .from('receipts')
            .select('*')
            .eq('id', receiptId)
            .single();

        if (fetchError || !receipt) {
            return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
        }

        // 2. Validar que el recibo pertenezca al usuario
        if (receipt.worker_id !== user.id) {
            return NextResponse.json({ error: 'No tienes permisos para eliminar este gasto' }, { status: 403 });
        }

        // 3. Validar estado (sólo Pendiente, Por Visar o Rechazado)
        const allowedStatuses = ['Pendiente', 'Por Visar', 'Rechazado'];
        if (receipt.status && !allowedStatuses.includes(receipt.status)) {
            return NextResponse.json({ error: 'No se puede eliminar un gasto aprobado o pagado' }, { status: 400 });
        }

        const adminSupabase = getAdminSupabase();

        // Guardar en la papelera
        const { error: binError } = await adminSupabase
            .from('deleted_records')
            .insert([{
                table_name: 'receipts',
                original_id: receiptId,
                data: receipt,
                deleted_by: user.email
            }]);
        if (binError) console.error("Error backing up worker receipt to recycle bin:", binError);

        // 4. Eliminar el recibo
        const { error: deleteError } = await adminSupabase
            .from('receipts')
            .delete()
            .eq('id', receiptId);

        if (deleteError) throw deleteError;

        // Registrar en logs de auditoría
        await adminSupabase.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Eliminar Recibo Colaborador',
            details: `El colaborador envió a la papelera su propio recibo ID: ${receiptId} (Estado previo: ${receipt.status || 'Pendiente'}, Comercio: ${receipt.merchant}, Monto: ${receipt.amount})`
        }]);

        return NextResponse.json({ success: true, message: 'Gasto eliminado correctamente' });
    } catch (error: any) {
        console.error("Error al eliminar recibo del colaborador:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Editar un gasto por el colaborador
export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const resolvedParams = await context.params;
        const receiptId = resolvedParams.id;

        const body = await request.json();
        const { merchant, merchant_rut, document_type, document_number, amount, date, category, project_id, location } = body;

        // 1. Obtener el recibo para validar dueño y estado
        const { data: receipt, error: fetchError } = await supabaseSession
            .from('receipts')
            .select('*')
            .eq('id', receiptId)
            .single();

        if (fetchError || !receipt) {
            return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
        }

        // 2. Validar que el recibo pertenezca al usuario
        if (receipt.worker_id !== user.id) {
            return NextResponse.json({ error: 'No tienes permisos para modificar este gasto' }, { status: 403 });
        }

        // 3. Validar estado (sólo Pendiente, Por Visar o Rechazado)
        const allowedStatuses = ['Pendiente', 'Por Visar', 'Rechazado'];
        if (receipt.status && !allowedStatuses.includes(receipt.status)) {
            return NextResponse.json({ error: 'No se puede editar un gasto aprobado o pagado' }, { status: 400 });
        }

        const adminSupabase = getAdminSupabase();

        // 4. Preparar datos de actualización
        const updateData: any = {};
        if (merchant !== undefined) updateData.merchant = merchant;
        if (merchant_rut !== undefined) updateData.merchant_rut = merchant_rut || null;
        if (document_type !== undefined) updateData.document_type = document_type || 'boleta';
        if (document_number !== undefined) updateData.document_number = document_number || null;
        if (amount !== undefined) {
            const cleanAmount = String(amount).replace(/[^\d.,]/g, '').replace(',', '.');
            updateData.amount = parseFloat(cleanAmount) || 0;
        }
        if (date !== undefined) updateData.date = date;
        if (category !== undefined) updateData.category = category;
        if (project_id !== undefined) updateData.project_id = project_id === '' ? null : project_id;
        if (location !== undefined) updateData.location = location || null;

        // Si el recibo estaba Rechazado, al editarlo vuelve a Pendiente de revisión
        if (receipt.status === 'Rechazado') {
            updateData.status = 'Pendiente';
            updateData.rejection_reason = null; // Limpiar motivo anterior
        }

        const { data: updatedReceipt, error: updateError } = await adminSupabase
            .from('receipts')
            .update(updateData)
            .eq('id', receiptId)
            .select('*, projects(id, name)')
            .single();

        if (updateError) throw updateError;

        // Auditoría
        const changes: string[] = [];
        if (merchant && merchant !== receipt.merchant) changes.push(`Comercio: ${receipt.merchant} -> ${merchant}`);
        if (amount && parseFloat(updateData.amount) !== parseFloat(receipt.amount)) changes.push(`Monto: $${receipt.amount} -> $${updateData.amount}`);
        if (category && category !== receipt.category) changes.push(`Categoría: ${receipt.category} -> ${category}`);
        if (receipt.status === 'Rechazado') changes.push(`Estado: Rechazado -> Pendiente`);

        const changeDetails = changes.length > 0 
            ? `El colaborador editó su propio recibo ID ${receiptId}. Cambios: ${changes.join(', ')}` 
            : `El colaborador editó su propio recibo ID ${receiptId}.`;

        await adminSupabase.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Editar Recibo Colaborador',
            details: changeDetails
        }]);

        return NextResponse.json({ success: true, receipt: updatedReceipt });
    } catch (error: any) {
        console.error("Error al actualizar recibo del colaborador:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
