import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { google } from 'googleapis';
import oauth2Client from '@/utils/google';
import { Readable } from 'stream';

export async function POST(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { merchant, amount, date, category } = body;

        // Parse date to YYYY-MM-DD
        let formattedDate = new Date().toISOString().split('T')[0];
        try {
            // Very simple date parse attempt based on es-CL locale typical matches
            if (date.includes('/')) {
                const parts = date.split('/');
                if (parts.length === 3) {
                    if (parts[2].length === 2) parts[2] = '20' + parts[2]; // yy -> yyyy
                    formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            } else if (date.includes('-')) {
                const parts = date.split('-');
                if (parts.length === 3) {
                    if (parts[2].length === 2) parts[2] = '20' + parts[2];
                    formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
        } catch (e) { console.error("Could not parse date", e); }


        const cleanAmount = amount.replace(/[^\d.,]/g, '').replace(',', '.'); // Allow only digits and a dot

        // Buscar el administrador afiliado al trabajador y su token de Google
        // En esta PWA sencilla, usamos el primer admin disponible que tenga tokens (lo ideal es vincular worker->admin en una app mutitenant)
        const { data: adminToken } = await supabaseSession
            .from('google_integrations')
            .select('*')
            .limit(1)
            .single();

        let driveImageUrl = '';

        // Si hay integración de Google, subimos el archivo a Drive y lo listamos en Sheets
        if (adminToken && adminToken.access_token) {
            try {
                oauth2Client.setCredentials({
                    access_token: adminToken.access_token,
                    refresh_token: adminToken.refresh_token,
                });

                const drive = google.drive({ version: 'v3', auth: oauth2Client });
                const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

                const folderId = adminToken.settings?.driveFolderId;
                const sheetId = adminToken.settings?.spreadsheetId;

                // 1. Subir a Google Drive
                if (folderId && body.imageBase64) {
                    // Extraer los datos base64 quitando el prefijo mime (data:image/jpeg;base64,...)
                    const matches = body.imageBase64.match(/^data:(.+);base64,(.+)$/);
                    if (matches && matches.length === 3) {
                        const mimeType = matches[1];
                        const base64Data = matches[2];
                        const buffer = Buffer.from(base64Data, 'base64');

                        const driveRes = await drive.files.create({
                            requestBody: {
                                name: `Recibo_${merchant}_${formattedDate}`,
                                parents: [folderId],
                            },
                            media: {
                                mimeType: mimeType,
                                body: Readable.from(buffer),
                            },
                            fields: 'id, webViewLink'
                        });

                        if (driveRes.data && driveRes.data.webViewLink) {
                            driveImageUrl = driveRes.data.webViewLink;

                            // Hacer el archivo público dentro de la app para que el admin pueda verlo sin problemas
                            await drive.permissions.create({
                                fileId: driveRes.data.id!,
                                requestBody: { role: 'reader', type: 'anyone' }
                            });
                        }
                    }
                }

                // 2. Escribir a Google Sheets
                if (sheetId) {
                    await sheets.spreadsheets.values.append({
                        spreadsheetId: sheetId,
                        range: 'Registros!A:F', // Asegurado de que la hoja se llame Registros
                        valueInputOption: 'USER_ENTERED',
                        requestBody: {
                            values: [
                                [
                                    formattedDate,
                                    merchant,
                                    category,
                                    cleanAmount,
                                    user.email || user.id,
                                    driveImageUrl
                                ]
                            ]
                        }
                    }).catch(err => console.error("Error escribiendo a Sheets (quizás la hoja no se llama 'Registros'):", err));
                }

            } catch (googleError) {
                console.error("No se pudo contactar APIs de Google (Ignorando, se guardará en BD local):", googleError);
            }
        }

        const { error } = await supabaseSession
            .from('receipts')
            .insert([
                {
                    worker_id: user.id,
                    merchant: merchant,
                    amount: parseFloat(cleanAmount) || 0,
                    date: formattedDate,
                    category: category,
                    image_url: driveImageUrl
                }
            ]);

        if (error) throw error;

        return NextResponse.json({ success: true, warning: adminToken ? null : "Gasto guardado en DB pero el Administrador no ha enlazado o configurado Google Drive aún." });
    } catch (error: any) {
        console.error("Error inserting receipt:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
