import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    const params = await context.params;
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    // Requisito: Sólo un Admin logueado puede resetear
    if (!user || user.user_metadata?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const adminAuthClient = getAdminSupabase();

        // 1. Force the password to 123456
        const { error: updateError } = await adminAuthClient.auth.admin.updateUserById(
            params.id,
            { password: '123456' }
        );

        if (updateError) throw updateError;

        // 2. Fetch current user metadata to preserve it
        const { data: userRecord, error: fetchError } = await adminAuthClient.auth.admin.getUserById(params.id);

        if (fetchError) throw fetchError;

        const currentMetadata = userRecord.user.user_metadata || {};

        // 3. Mark requires_password_change = true again
        const { error: metadataError } = await adminAuthClient.auth.admin.updateUserById(
            params.id,
            { user_metadata: { ...currentMetadata, requires_password_change: true } }
        );

        if (metadataError) throw metadataError;

        return NextResponse.json({ success: true, message: 'Clave reiniciada a 123456' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
