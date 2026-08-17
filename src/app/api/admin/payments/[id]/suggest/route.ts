import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { parseCLPAmount } from '@/utils/currency';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const FALLBACK_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const { data: payment, error: paymentError } = await supabaseSession
            .from('payments')
            .select('*')
            .eq('id', id)
            .single();

        if (paymentError || !payment) {
            return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
        }

        // Si ya tiene monto y fecha, no volvemos a llamar a la IA
        if (payment.amount && payment.paid_at) {
            return NextResponse.json({ success: true, amount: payment.amount, paid_at: payment.paid_at, cached: true });
        }

        const fileResponse = await fetch(payment.file_url);
        if (!fileResponse.ok) {
            return NextResponse.json({ error: 'No se pudo descargar el comprobante' }, { status: 400 });
        }

        const mimeType = fileResponse.headers.get('content-type') || (payment.file_type === 'pdf' ? 'application/pdf' : 'image/jpeg');
        const buffer = Buffer.from(await fileResponse.arrayBuffer());
        const base64Data = buffer.toString('base64');

        const prompt = `Eres un asistente experto en contabilidad. Analiza este comprobante de transferencia o pago electrónico y devuelve estrictamente el siguiente JSON puro (sin markdown ni explicaciones):

{
  "amount": "Monto total transferido/pagado en pesos chilenos (CLP), como SOLO DÍGITOS sin puntos, comas ni símbolos (ej: si el comprobante muestra $45.000, devuelve 45000). CLP no usa decimales/centavos: ignora cualquier ',00' o '.00' final.",
  "paid_at": "Fecha en que se realizó la transferencia, formato YYYY-MM-DD"
}

Si algún dato no es visible o no estás seguro, devuelve cadena vacía para ese campo.`;

        let responseText = '';
        let lastError: any = null;

        for (const modelName of FALLBACK_MODELS) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent([
                    prompt,
                    { inlineData: { data: base64Data, mimeType } }
                ]);
                responseText = result.response.text();
                lastError = null;
                break;
            } catch (err: any) {
                console.warn(`[Payment Suggest] Fallo con modelo ${modelName}:`, err.message);
                lastError = err;
            }
        }

        if (lastError) throw lastError;

        const cleanJsonString = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJsonString);

        const extractedAmount = parsed.amount ? parseCLPAmount(parsed.amount) : null;
        const extractedDate = parsed.paid_at || null;

        const updateData: Record<string, any> = {};
        if (extractedAmount && !payment.amount) updateData.amount = extractedAmount;
        if (extractedDate && !payment.paid_at) updateData.paid_at = extractedDate;

        if (Object.keys(updateData).length > 0) {
            await supabaseSession.from('payments').update(updateData).eq('id', id);
        }

        return NextResponse.json({
            success: true,
            amount: updateData.amount ?? payment.amount ?? null,
            paid_at: updateData.paid_at ?? payment.paid_at ?? null,
            cached: false
        });
    } catch (error: any) {
        console.error('Error sugiriendo datos de comprobante:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
