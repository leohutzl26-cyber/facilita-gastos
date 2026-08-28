import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { enhanceComprobanteImage } from '@/utils/imageEnhance';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

function verifyMailgunSignature(timestamp: string, token: string, signature: string): boolean {
    const signingKey = process.env.MAILGUN_SIGNING_KEY;
    if (!signingKey) return false;
    const hmac = crypto.createHmac('sha256', signingKey).update(timestamp + token).digest('hex');
    return hmac === signature;
}

// Mailgun "Inbound Route" webhook: https://documentation.mailgun.com/en/latest/user_manual.html#receiving-forwarding-and-storing-messages
export async function POST(request: Request) {
    try {
        const formData = await request.formData();

        const timestamp = formData.get('timestamp') as string | null;
        const token = formData.get('token') as string | null;
        const signature = formData.get('signature') as string | null;

        if (!timestamp || !token || !signature || !verifyMailgunSignature(timestamp, token, signature)) {
            return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
        }

        const sender = (formData.get('sender') as string) || (formData.get('from') as string) || 'desconocido';
        const attachmentCount = parseInt((formData.get('attachment-count') as string) || '0', 10);

        const adminDb = getAdminSupabase();

        if (attachmentCount === 0) {
            return NextResponse.json({ success: true, message: 'Correo sin adjuntos, ignorado' });
        }

        let createdCount = 0;

        for (let i = 1; i <= attachmentCount; i++) {
            const file = formData.get(`attachment-${i}`) as File | null;
            if (!file) continue;

            const originalMimeType = file.type || 'application/octet-stream';
            if (!originalMimeType.startsWith('image/') && originalMimeType !== 'application/pdf') continue;

            const originalBuffer = Buffer.from(await file.arrayBuffer());
            const { buffer, mimeType } = await enhanceComprobanteImage(originalBuffer, originalMimeType);

            const fileExt = mimeType.split('/')[1] || 'bin';
            const fileType = mimeType === 'application/pdf' ? 'pdf' : 'image';
            const fileName = `email/${Date.now()}_${i}.${fileExt}`;

            const { error: uploadError } = await adminDb.storage
                .from('payment-proofs')
                .upload(fileName, buffer, { contentType: mimeType, upsert: false });

            if (uploadError) {
                console.error('Error subiendo adjunto de correo:', uploadError);
                continue;
            }

            const { data: urlData } = adminDb.storage.from('payment-proofs').getPublicUrl(fileName);

            const { error: insertError } = await adminDb
                .from('payments')
                .insert([{
                    file_url: urlData.publicUrl,
                    file_type: fileType,
                    source: 'email',
                    status: 'pendiente',
                    uploaded_by_email: sender
                }]);

            if (insertError) {
                console.error('Error creando payment desde correo:', insertError);
                continue;
            }

            createdCount++;
        }

        await adminDb.from('audit_logs').insert([{
            user_email: sender,
            action: 'Comprobante Recibido por Correo',
            details: `${createdCount} comprobante(s) creado(s) desde correo entrante.`
        }]);

        return NextResponse.json({ success: true, created: createdCount });
    } catch (error: any) {
        console.error('Error procesando webhook de Mailgun:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
