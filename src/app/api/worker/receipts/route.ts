import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function GET() {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const { data: receipts, error } = await supabaseSession
            .from('receipts')
            .select('*')
            .eq('worker_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ receipts });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

export async function POST(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { merchant, merchant_rut, document_type, amount, date, category, imageBase64, project_id, location } = body;

        let formattedDate = date;
        const cleanAmount = amount.replace(/[^\d.,]/g, '').replace(',', '.'); // Permite solo dígitos y punto
        const parsedAmount = parseFloat(cleanAmount) || 0;

        // 0. Evitar Duplicados: Check si este mismo trabajador ya subió este exacto gasto
        const { data: existingReceipts, error: checkError } = await supabaseSession
            .from('receipts')
            .select('id')
            .eq('worker_id', user.id)
            .eq('merchant', merchant)
            .eq('date', formattedDate)
            .eq('amount', parsedAmount)
            .limit(1);

        if (!checkError && existingReceipts && existingReceipts.length > 0) {
            return NextResponse.json({
                error: 'Posible duplicado: Ya has registrado un recibo idéntico con esta fecha, comercio y monto.'
            }, { status: 409 });
        }

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
                    merchant_rut: merchant_rut || null,
                    document_type: document_type || 'boleta',
                    amount: parsedAmount,
                    date: formattedDate,
                    category: category,
                    image_url: supabaseImageUrl,
                    project_id: project_id || null,
                    location: location || null
                }
            ]);

        if (insertError) throw insertError;

        // Auditoría
        const adminDbClient = getAdminSupabase();
        await adminDbClient.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Envío de Gasto',
            details: `Subió ${document_type || 'boleta'} de ${merchant} por monto ${parsedAmount}`
        }]);

        return NextResponse.json({ success: true, message: "Gasto registrado exitosamente." });
    } catch (error: any) {
        console.error("Error al registrar el recibo:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
