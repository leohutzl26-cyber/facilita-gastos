import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveReceiptDate, todayISO } from '@/utils/expenseDate';

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

        // Obtener la parte limpia de Base64 y el mimeType
        const matches = imageBase64.match(/^data:(.*?);base64,(.+)$/);

        let mimeType = "image/jpeg";
        let base64Data = imageBase64;

        if (matches && matches.length === 3) {
            mimeType = matches[1];
            base64Data = matches[2];
        } else {
            // Fallback si viene mal formateado (asumimos imagen antigua)
            base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        }

        const fallbackModels = [
            // Newer models that the user's key specifically supports
            "gemini-2.5-flash",
            "gemini-2.5-pro",
            "gemini-2.0-flash",
            "gemini-2.0-flash-001",
            "gemini-2.5-flash-lite",
            "gemini-3.1-pro-preview",
            // Standard/older fallbacks for completeness
            "gemini-1.5-flash",
            "gemini-1.5-pro",
            "gemini-pro-vision"
        ];

        let responseText = "";
        let lastError = null;

        // 2. Fetch active categories from DB to inject into the AI prompt
        const { data: dbCategories, error: dbError } = await supabaseSession
            .from('categories')
            .select('name');

        let categoryNamesList = "Alimentación, Transporte, Combustible, Hospedaje, Suministros Oficina, Mantenimiento, Otros"; // fallback
        if (!dbError && dbCategories && dbCategories.length > 0) {
            categoryNamesList = dbCategories.map(c => c.name).join(', ');
        }

        const today = todayISO();
        const year = today.slice(0, 4);
        const yy = year.slice(2);

        const prompt = `Eres un asistente experto en contabilidad.
Extrae los datos de esta imagen de documento (recibo, factura o boleta) y devuélvelos estrictamente en el siguiente formato JSON puro (sin formato markdown ni explicaciones adicionales):

{
  "merchant": "Nombre del comercio o de la empresa proveedora",
  "merchant_rut": "RUT de la empresa proveedora o comercio emisor (ej: '76.123.456-K' o '19456789-2'). Si no lo encuentras, devuelve cadena vacía.",
  "document_type": "Clasifica el tipo de documento. Debe ser estrictamente 'factura', 'boleta', 'boleta de honorarios', o 'comprobante de pago'. Si no estás seguro, usa 'boleta'.",
  "document_number": "Número del documento, folio de la factura o número impreso de la boleta (ej: '1459', '000122'). Si no hay número, devuelve cadena vacía.",
  "date_raw": "La fecha de emisión EXACTAMENTE como está impresa en el documento, copiada carácter por carácter (ej: '06/10/26', '15-06-2026', '11 de Septiembre de 2026'). No la conviertas ni la corrijas. Si hay varias fechas, usa la de emisión de la boleta o factura (no la de vencimiento ni la de resolución del SII). Si no hay ninguna fecha visible, devuelve cadena vacía.",
  "date": "La misma fecha convertida a formato YYYY-MM-DD, siguiendo las reglas de fechas de abajo. Cadena vacía si no hay fecha visible.",
  "amount": "Monto total en pesos chilenos (CLP), como SOLO DÍGITOS sin puntos, comas ni símbolos (ej: si el documento muestra $15.500, devuelve 15500). CLP no usa decimales/centavos: ignora cualquier ',00' o '.00' final.",
  "category": "Estrictamente UNA de estas opciones exactas, la que mejor describa la compra: ${categoryNamesList}"
}

REGLAS DE FECHAS (documentos de Chile):
- Hoy es ${today}. Los gastos son recientes: casi siempre del año ${year}.
- El orden impreso es DÍA/MES/AÑO, nunca año primero. '06/10/${yy}' significa 6 de octubre de ${year}, NO el ${yy} de octubre del año 2006. '23/06/${yy}' es 23 de junio de ${year}.
- Un año de 2 dígitos ('${yy}') es 20 + esos dígitos (${year}). Nunca lo tomes como día ni como mes.
- Si la fecha que obtienes quedaría en el futuro o con más de un año de antigüedad, probablemente confundiste el día con el año: vuelve a leerla.
- No inventes la fecha. Si el documento no la trae (por ejemplo un pasaje de bus sin fecha), devuelve cadena vacía en 'date' y en 'date_raw'.

Si otro dato no es visible, infiérelo con cuidado. Si es completamente ilegible, devuelve cadena vacía para ese campo. Elige la categoría que mejor encaje según el comercio y los items.`;

        const imageParts = [
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            }
        ];

        // 3. Ejecutar la llamada iterando sobre los modelos de respaldo
        for (const modelName of fallbackModels) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { temperature: 0 } });
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

            // La fecha impresa se interpreta con reglas fijas y se valida; la IA solo
            // aporta el texto. Una fecha que no sea confiable se devuelve vacía para
            // que la persona la escriba, en vez de guardar una equivocada.
            const resolved = resolveReceiptDate({ raw: parsedData.date_raw, aiDate: parsedData.date }, today);
            if (resolved.date !== parsedData.date) {
                console.warn(`[OCR] Fecha corregida: IA="${parsedData.date}" impresa="${parsedData.date_raw}" -> "${resolved.date}"`);
            }
            parsedData.date = resolved.date;
            parsedData.date_note = resolved.note || '';

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
