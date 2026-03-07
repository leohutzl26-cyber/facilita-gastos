import { NextResponse } from 'next/server';
import oauth2Client from '@/utils/google';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.redirect(new URL('/admin/login', process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:3000'));
    }

    const scopes = [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets'
    ];

    const authorizationUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Necesario para obtener el refresh_token
        prompt: 'consent', // Forzamos el consent screen para asegurarnos de que Google devuelva un refresh token
        scope: scopes,
        include_granted_scopes: true
    });

    return NextResponse.redirect(authorizationUrl);
}
