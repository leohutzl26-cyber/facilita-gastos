import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { enhanceComprobanteImage } from '@/utils/imageEnhance';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function POST(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.redirect(new URL('/admin/login', request.url), 303);
    }

    try {
        const formData = await request.formData();
        const file = formData.get('comprobante') as File | null;

        if (!file || file.size === 0) {
            return NextResponse.redirect(new URL('/admin/dashboard?share_error=archivo_vacio', request.url), 303);
        }

        const originalMimeType = file.type || 'application/octet-stream';
        const originalBuffer = Buffer.from(await file.arrayBuffer());

        // Las fotos compartidas desde el celular suelen llegar comprimidas
        // por la app de origen; las mejoramos un poco (nitidez, contraste,
        // tamaño mínimo) sin dejar que el archivo crezca demasiado.
        const { buffer, mimeType } = await enhanceComprobanteImage(originalBuffer, originalMimeType);

        const fileExt = mimeType.split('/')[1] || 'bin';
        const fileType = mimeType === 'application/pdf' ? 'pdf' : 'image';
        const fileName = `${user.id}/${Date.now()}_comprobante.${fileExt}`;

        const { error: uploadError } = await supabaseSession.storage
            .from('payment-proofs')
            .upload(fileName, buffer, {
                contentType: mimeType,
                upsert: false
            });

        if (uploadError) {
            console.error('Fallo subiendo comprobante compartido:', uploadError);
            return NextResponse.redirect(new URL('/admin/dashboard?share_error=fallo_subida', request.url), 303);
        }

        const { data: urlData } = supabaseSession.storage
            .from('payment-proofs')
            .getPublicUrl(fileName);

        const { data: payment, error: insertError } = await supabaseSession
            .from('payments')
            .insert([{
                file_url: urlData.publicUrl,
                file_type: fileType,
                source: 'share_target',
                status: 'pendiente',
                uploaded_by: user.id,
                uploaded_by_email: user.email
            }])
            .select()
            .single();

        if (insertError) throw insertError;

        const adminDbClient = getAdminSupabase();
        await adminDbClient.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Comprobante Compartido',
            details: `Comprobante de pago recibido vía compartir del sistema (${fileType}).`
        }]);

        return NextResponse.redirect(new URL(`/admin/comprobantes/${payment.id}`, request.url), 303);
    } catch (error) {
        console.error('Error procesando comprobante compartido:', error);
        return NextResponse.redirect(new URL('/admin/dashboard?share_error=error_interno', request.url), 303);
    }
}
