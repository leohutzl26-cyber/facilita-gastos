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

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user || !canViewAdminPanel(user)) {
        return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
    }

    try {
        const resolvedParams = await context.params;
        const receiptId = resolvedParams.id;

        const adminSupabase = getAdminSupabase();

        const { data: comments, error } = await adminSupabase
            .from('receipt_comments')
            .select('*')
            .eq('receipt_id', receiptId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ success: true, comments: comments || [] });
    } catch (error: any) {
        console.error("Error fetching comments:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user || !isAdmin(user)) {
        return NextResponse.json({ error: 'No autorizado: se requiere rol de administrador.' }, { status: 401 });
    }

    try {
        const resolvedParams = await context.params;
        const receiptId = resolvedParams.id;

        const { comment } = await request.json();

        if (!comment || !comment.trim()) {
            return NextResponse.json({ error: 'Comentario vacío' }, { status: 400 });
        }

        const adminSupabase = getAdminSupabase();

        // 1. Insertar el comentario
        const { data: newComment, error: insertError } = await adminSupabase
            .from('receipt_comments')
            .insert([{
                receipt_id: receiptId,
                user_id: user.id,
                user_email: user.email,
                comment: comment.trim()
            }])
            .select()
            .single();

        if (insertError) throw insertError;

        // 2. Registrar en log de auditoría
        await adminSupabase.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Comentario Recibo',
            details: `Comentó el Recibo ID ${receiptId}: "${comment.trim().substring(0, 50)}${comment.trim().length > 50 ? '...' : ''}"`
        }]);

        return NextResponse.json({ success: true, comment: newComment });
    } catch (error: any) {
        console.error("Error inserting comment:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
