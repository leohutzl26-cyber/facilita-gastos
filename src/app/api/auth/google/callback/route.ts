import { NextResponse } from 'next/server';
import oauth2Client from '@/utils/google';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    console.log('Google Auth Route Triggered. Code present:', !!code);

    if (!code) {
        console.error('No code found in URL');
        return NextResponse.redirect(new URL('/admin/dashboard?error=NoCodeLog', request.url));
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('User status:', user ? `Found (${user.email})` : 'Not Found', 'Auth Error:', authError);

    if (!user) {
        return NextResponse.redirect(new URL('/admin/dashboard?error=UserNotLoggedIn', request.url));
    }

    try {
        console.log('Requesting tokens from Google...');
        const { tokens } = await oauth2Client.getToken(code);
        console.log('Tokens received from Google successfully.');

        // Almacenamos los tokens en Supabase, asociándolos a este Admin único.
        // Usamos refresh_token o mantenemos el existente si Google no devuelve uno nuevo
        const payload: any = {
            admin_id: user.id,
            access_token: tokens.access_token,
            updated_at: new Date().toISOString()
        };

        if (tokens.refresh_token) {
            payload.refresh_token = tokens.refresh_token;
        }

        const { error } = await supabase
            .from('google_integrations')
            .upsert(payload, { onConflict: 'admin_id' });

        if (error) {
            console.error('Error insertando token a Supabase:', error);
            return NextResponse.redirect(new URL('/admin/dashboard?error=DBError', request.url));
        }

        return NextResponse.redirect(new URL('/admin/dashboard?success=GoogleLinked', request.url));
    } catch (err: any) {
        console.error('Error validando token con Google:', err);
        const errorMessage = err.message ? encodeURIComponent(err.message) : 'GoogleAuthFailed';
        return NextResponse.redirect(new URL(`/admin/dashboard?error=${errorMessage}`, request.url));
    }
}
