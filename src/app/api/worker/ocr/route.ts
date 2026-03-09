import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Instanciar el SDK de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    // 1. Validar autenticación
    if (!user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { imageBase64 } = body;

        if (!imageBase64) {
            return NextResponse.json({ error: 'No se envió ninguna imagen' }, { status: 400 });
        }

        // Obtener la parte limpia de Base64
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        const fallbackModels = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest",
            "gemini-2.0-flash",
            "gemini-1.5-pro"
        ];

        let responseText = "";
        let lastError = null;

        const prompt = `Eres un asistente experto en contabilidad.
Extrae los datos de esta imagen de recibo o boleta de compra y devuélvelos estrictamente en el siguiente formato JSON puro (sin formato markdown ni explicaciones adicionales):

{
  "merchant": "Nombre del comercio o tienda",
  "date": "Fecha en formato YYYY-MM-DD",
  "amount": "Monto total como texto numérico limpio (solo números y coma/punto, ej: 15500 o 150.50)",
  "category": "Una de estas: Alimentación, Transporte, Combustible, Hospedaje, Suministros Oficina, Mantenimiento, Otros"
}

Si un dato no es visible, infiérelo (ej. la fecha suele estar cerca del monto final o al principio). Si es ilegible, devuelve un string vacío para ese campo. Elige la categoría que mejor encaje según el comercio y los items.`;

        const imageParts = [
            {
                inlineData: {
                    data: base64Data,
                    mimeType: "image/jpeg" // Asumimos JPEG por la compresión previa del lado del cliente
                }
            }
        ];

        // 3. Ejecutar la llamada iterando sobre los modelos de respaldo
        for (const modelName of fallbackModels) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent([prompt, ...imageParts]);
                responseText = result.response.text();
                lastError = null;
                break; // Si es exitoso, salimos del bucle
            } catch (err: any) {
                console.warn(`[OCR] Fallo con modelo ${modelName}:`, err.message);
                lastError = err;
            }
        }

        if (lastError) {
            throw lastError; // Si todos fallan, lanza el último error
        }

        // Limpieza de posibles etiquetas codeblock (```json ... ```) si el modelo decidiera incluirlas a pesar del prompt
        const cleanJsonString = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

        // 4. Parsear respuesta y devolver al cliente
        try {
            const parsedData = JSON.parse(cleanJsonString);
            return NextResponse.json({ success: true, data: parsedData });
        } catch (parseError) {
            console.error("Error parseando respuesta de IA:", responseText);
            return NextResponse.json({ error: 'La IA no pudo estructurar correctamente la información del recibo' }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Error procesando OCR IA:", error);
        return NextResponse.json({ error: error.message || 'Error interno procesando imagen' }, { status: 500 });
    }
}
