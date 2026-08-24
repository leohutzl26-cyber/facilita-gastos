import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAdmin } from '@/utils/roles';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user || !isAdmin(user)) {
        return NextResponse.json({ error: 'No autorizado: se requiere rol de administrador.' }, { status: 401 });
    }

    try {
        const { id } = await context.params;

        // Obtener datos del proyecto antes de eliminarlo
        const { data: project, error: fetchError } = await supabaseSession
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) {
            console.error("Error fetching project before delete:", fetchError);
        } else if (project) {
            // Guardar en la papelera
            const { error: binError } = await supabaseSession
                .from('deleted_records')
                .insert([{
                    table_name: 'projects',
                    original_id: id,
                    data: project,
                    deleted_by: user.email
                }]);
            if (binError) console.error("Error backing up project to recycle bin:", binError);
        }

        const { error } = await supabaseSession
            .from('projects')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user || !isAdmin(user)) {
        return NextResponse.json({ error: 'No autorizado: se requiere rol de administrador.' }, { status: 401 });
    }

    try {
        const { id } = await context.params;
        const body = await request.json();
        const { name, description, active } = body;

        const updateData: any = {};
        if (name !== undefined) {
            if (!name && name !== '') {
                return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
            }
            updateData.name = name;
        }
        if (description !== undefined) {
            updateData.description = description;
        }
        if (active !== undefined) {
            updateData.active = active;
        }

        const { data, error } = await supabaseSession
            .from('projects')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;
        return NextResponse.json({ success: true, project: data[0] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

