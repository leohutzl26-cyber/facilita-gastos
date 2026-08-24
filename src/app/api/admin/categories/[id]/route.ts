import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAdmin } from '@/utils/roles';

export async function PUT(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isAdmin(user)) return NextResponse.json({ error: 'No autorizado: se requiere rol de administrador.' }, { status: 401 });

    try {
        // Next.js 15 requires awaiting params
        const params = await context.params;
        const id = params.id;
        const body = await request.json();
        const { name, color, max_amount_alert } = body;

        const { data, error } = await supabase
            .from('categories')
            .update({ name, color, max_amount_alert })
            .eq('id', id)
            .select();

        if (error) throw error;
        
        if (!data || data.length === 0) {
            return NextResponse.json(
                { error: 'No se pudo actualizar la categoría. Revisa las políticas RLS de Supabase (te falta permitir UPDATE para la tabla categories).' },
                { status: 403 }
            );
        }

        return NextResponse.json({ category: data[0] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isAdmin(user)) return NextResponse.json({ error: 'No autorizado: se requiere rol de administrador.' }, { status: 401 });

    try {
        const params = await context.params;
        const id = params.id;

        // Obtener datos de la categoría antes de eliminarla
        const { data: category, error: fetchError } = await supabase
            .from('categories')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) {
            console.error("Error fetching category before delete:", fetchError);
        } else if (category) {
            // Guardar en la papelera
            const { error: binError } = await supabase
                .from('deleted_records')
                .insert([{
                    table_name: 'categories',
                    original_id: id,
                    data: category,
                    deleted_by: user.email
                }]);
            if (binError) console.error("Error backing up category to recycle bin:", binError);
        }

        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
