import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAdmin } from '@/utils/roles';

export async function GET() {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user || !isAdmin(user)) {
        return NextResponse.json({ error: 'No autorizado: se requiere rol de administrador.' }, { status: 401 });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY || '';
        if (!apiKey) {
            return NextResponse.json({ error: "La variable GEMINI_API_KEY no está configurada en este entorno." }, { status: 400 });
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
