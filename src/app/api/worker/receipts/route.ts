import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { merchant, amount, date, category, imageBase64 } = body;

        let formattedDate = date;
        const cleanAmount = amount.replace(/[^\d.,]/g, '').replace(',', '.'); // Permite solo dígitos y punto

        let supabaseImageUrl = null;

        // 1. Subir a Supabase Storage si viene imagen
        if (imageBase64) {
            const matches = imageBase64.match(/^data:(.*?);base64,(.+)$/);
            
            if (matches && matches.length === 3) {
                const mimeType = matches[1] || 'image/jpeg';
                const base64Data = matches[2];
                const buffer = Buffer.from(base64Data, 'base64');
                
                // Generar nombre de archivo único
                const fileExt = mimeType.split('/')[1] || 'jpg';
                const fileName = `${user.id}/${Date.now()}_${merchant.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`;

                const { error: uploadError } = await supabaseSession.storage
                    .from('receipts')
                    .upload(fileName, buffer, {
                        contentType: mimeType,
                        upsert: false
                    });

                if (uploadError) {
                    console.error("Fallo subiendo imagen a Supabase Storage:", uploadError);
                    supabaseImageUrl = "Error de Subida a Storage: " + uploadError.message;
                } else {
                    // Obtener la URL pública inmediatamente
                    const { data: urlData } = supabaseSession.storage
                        .from('receipts')
                        .getPublicUrl(fileName);
                    
                    supabaseImageUrl = urlData.publicUrl;
                }
            } else {
                supabaseImageUrl = "Error Formato B64";
            }
        }

        // 2. Insertar registro en la Base de Datos
        const { error: insertError } = await supabaseSession
            .from('receipts')
            .insert([
                {
                    worker_id: user.id,
                    worker_email: user.email,
                    merchant: merchant,
                    amount: parseFloat(cleanAmount) || 0,
                    date: formattedDate,
                    category: category,
                    image_url: supabaseImageUrl
                }
            ]);

        if (insertError) throw insertError;

        return NextResponse.json({ success: true, message: "Gasto registrado exitosamente." });
    } catch (error: any) {
        console.error("Error al registrar el recibo:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
