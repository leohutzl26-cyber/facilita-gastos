import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { google } from 'googleapis';
import oauth2Client from '@/utils/google';

export async function GET() {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Obtener el token de Google para este admin
        const { data: integration, error: dbError } = await supabaseSession
            .from('google_integrations')
            .select('access_token, refresh_token')
            .eq('admin_id', user.id)
            .single();

        if (dbError || !integration || !integration.access_token) {
            return NextResponse.json({ error: 'Not linked to Google' }, { status: 400 });
        }

        oauth2Client.setCredentials({
            access_token: integration.access_token,
            refresh_token: integration.refresh_token,
        });

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Buscar solo carpetas
        const response = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields: 'files(id, name)',
            spaces: 'drive',
            orderBy: 'name',
            pageSize: 50
        });

        let folders = response.data.files || [];

        // Si el scope es drive.file, la API solo ve carpetas creadas por la app.
        // Autocreamos una de inmediato para beneficio del usuario si hay 0 res.
        if (folders.length === 0) {
            console.log("No app-owned folders found. Creating default one...");
            const folderMetadata = {
                name: 'Facilita_Gastos_App',
                mimeType: 'application/vnd.google-apps.folder'
            };
            const newFolder = await drive.files.create({
                requestBody: folderMetadata,
                fields: 'id, name'
            });

            if (newFolder.data) {
                folders = [newFolder.data];
            }
        }

        return NextResponse.json({ folders });
    } catch (error: any) {
        console.error("Error fetching drive folders:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
