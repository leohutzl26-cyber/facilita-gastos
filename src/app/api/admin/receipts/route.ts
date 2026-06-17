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
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // En un esquema real, validaríamos que el 'user' es ADMIN.
        // Aquí extraemos todos los recibos ordenados por fecha descendente
        const { data: receipts, error } = await supabaseSession
            .from('receipts')
            .select('*, projects(id, name)')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        return NextResponse.json({ receipts: receipts || [] });
    } catch (error: any) {
        console.error("Error fetching receipts:", error);
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
        const {
            worker_id,
            worker_email,
            merchant,
            merchant_rut,
            document_type,
            document_number,
            amount,
            date,
            category,
            imageBase64,
            project_id,
            location
        } = body;

        if (!worker_id || !worker_email || !merchant || !amount || !date || !category) {
            return NextResponse.json({ error: 'Datos obligatorios incompletos' }, { status: 400 });
        }

        let formattedDate = date;
        const cleanAmount = String(amount).replace(/[^\d.,]/g, '').replace(',', '.');
        const parsedAmount = parseFloat(cleanAmount) || 0;

        // Comprobación de duplicados
        if (document_number && String(document_number).trim() !== '') {
            let query = supabaseSession
                .from('receipts')
                .select('id, worker_email')
                .eq('document_number', document_number);
            
            if (merchant_rut && String(merchant_rut).trim() !== '') {
                query = query.eq('merchant_rut', merchant_rut);
            } else if (merchant && String(merchant).trim() !== '') {
                query = query.eq('merchant', merchant);
            }

            const { data: globalDuplicates, error: globalError } = await query.limit(1);

            if (!globalError && globalDuplicates && globalDuplicates.length > 0) {
                return NextResponse.json({
                    error: `ALERTA DUPLICADO: El documento N° ${document_number} ya fue ingresado por el usuario ${globalDuplicates[0].worker_email}.`
                }, { status: 409 });
            }
        }

        let supabaseImageUrl = null;

        // Carga de imagen a storage
        if (imageBase64) {
            const matches = imageBase64.match(/^data:(.*?);base64,(.+)$/);

            if (matches && matches.length === 3) {
                const mimeType = matches[1] || 'image/jpeg';
                const base64Data = matches[2];
                const buffer = Buffer.from(base64Data, 'base64');

                const fileExt = mimeType.split('/')[1] || 'jpg';
                // Usamos el ID del colaborador seleccionado para organizar los archivos en su subcarpeta
                const fileName = `${worker_id}/${Date.now()}_${merchant.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`;

                const { error: uploadError } = await supabaseSession.storage
                    .from('receipts')
                    .upload(fileName, buffer, {
                        contentType: mimeType,
                        upsert: false
                    });

                if (uploadError) {
                    console.error("Fallo subiendo imagen:", uploadError);
                    supabaseImageUrl = "Error de Subida a Storage: " + uploadError.message;
                } else {
                    const { data: urlData } = supabaseSession.storage
                        .from('receipts')
                        .getPublicUrl(fileName);

                    supabaseImageUrl = urlData.publicUrl;
                }
            } else {
                supabaseImageUrl = "Error Formato B64";
            }
        }

        // Insertar en la base de datos
        const { data, error: insertError } = await supabaseSession
            .from('receipts')
            .insert([
                {
                    worker_id,
                    worker_email,
                    merchant,
                    merchant_rut: merchant_rut || null,
                    document_type: document_type || 'boleta',
                    document_number: document_number || null,
                    amount: parsedAmount,
                    date: formattedDate,
                    category,
                    image_url: supabaseImageUrl,
                    project_id: project_id || null,
                    location: location || null,
                    status: 'Pendiente' // Se crea en Pendiente por defecto
                }
            ])
            .select();

        if (insertError) throw insertError;

        // Auditoría
        const adminDbClient = getAdminSupabase();
        await adminDbClient.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Envío Gasto Administrador',
            details: `Administrador subió recibo para ${worker_email}. Proveedor: ${merchant}, Monto: ${parsedAmount}`
        }]);

        return NextResponse.json({ success: true, message: "Gasto registrado exitosamente.", receipt: data[0] });
    } catch (error: any) {
        console.error("Error al registrar recibo desde admin:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
