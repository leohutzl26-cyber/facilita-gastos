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
            .select('*, projects(id, name)')
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
        const { merchant, merchant_rut, document_type, document_number, amount, date, category, imageBase64, project_id, location } = body;

        let formattedDate = date;
        const cleanAmount = amount.replace(/[^\d.,]/g, '').replace(',', '.'); // Permite solo dígitos y punto
        const parsedAmount = parseFloat(cleanAmount) || 0;

        // 0.1 Check de Fraude Global: Comprobar si este mismo Folio ya fue usado por CUALQUIER usuario
        // Solo chequeamos si tenemos un número de documento válido subido.
        if (document_number && String(document_number).trim() !== '') {
            let query = supabaseSession
                .from('receipts')
                .select('id, worker_email')
                .eq('document_number', document_number);
            
            // Preferimos el RUT para exactitud, sino caemos en el nombre del comercio
            if (merchant_rut && String(merchant_rut).trim() !== '') {
                query = query.eq('merchant_rut', merchant_rut);
            } else if (merchant && String(merchant).trim() !== '') {
                query = query.eq('merchant', merchant);
            }

            const { data: globalDuplicates, error: globalError } = await query.limit(1);

            if (!globalError && globalDuplicates && globalDuplicates.length > 0) {
                return NextResponse.json({
                    error: `ALERTA FRAUDE/DUPLICADO: El documento N° ${document_number} ya fue ingresado anteriormente por el usuario ${globalDuplicates[0].worker_email}. El sistema prohíbe el doble reembolso de un mismo folio.`
                }, { status: 409 });
            }
        }

        // 0.2 Evitar dobles envíos por error del mismo usuario (ej: apretar enviar dos veces)
        // Mismo monto, comercio, fecha en el mismo usuario.
        const { data: existingReceipts, error: checkError } = await supabaseSession
            .from('receipts')
            .select('id')
            .eq('worker_id', user.id)
            .eq('merchant', merchant)
            .eq('date', formattedDate)
            .eq('amount', parsedAmount)
            .limit(1);

        if (!checkError && existingReceipts && existingReceipts.length > 0) {
            // Si además tiene el mismo folio, el check 0.1 ya lo debió atrapar, pero por si acaso.
            return NextResponse.json({
                error: 'Posible duplicado: Ya has registrado un recibo idéntico con esta misma fecha, comercio y monto exacto.'
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
                    document_number: document_number || null,
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
            details: `Subió ${document_type || 'boleta'} Nº ${document_number || '-'} de ${merchant} por monto ${parsedAmount}`
        }]);

        return NextResponse.json({ success: true, message: "Gasto registrado exitosamente." });
    } catch (error: any) {
        console.error("Error al registrar el recibo:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
