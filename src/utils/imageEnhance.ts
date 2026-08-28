import sharp from 'sharp';

// Los comprobantes que llegan compartidos desde el celular (o por correo)
// suelen venir en baja resolución porque la app de origen (banco, galería)
// comprime la imagen antes de compartirla. Esto los sube un poco de tamaño
// y les mejora nitidez/contraste para que el texto se lea, sin dejar que el
// archivo crezca demasiado: el límite de dimensión + la calidad JPEG acotan
// el peso final tanto para imágenes chicas como para fotos de cámara enormes.
const TARGET_MAX_DIMENSION = 1600;
const JPEG_QUALITY = 82;

export async function enhanceComprobanteImage(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; mimeType: string }> {
    // Los PDF no pasan por acá, se guardan tal cual.
    if (!mimeType.startsWith('image/')) {
        return { buffer, mimeType };
    }

    try {
        const enhanced = await sharp(buffer, { failOn: 'none' })
            .rotate() // corrige la orientación según los metadatos EXIF del celular
            .resize({
                width: TARGET_MAX_DIMENSION,
                height: TARGET_MAX_DIMENSION,
                fit: 'inside',
                withoutEnlargement: false, // sí permite agrandar las que llegan chicas
                kernel: 'lanczos3'
            })
            .sharpen({ sigma: 1 })
            .normalize() // estira el contraste, ayuda mucho en fotos de pantalla lavadas
            .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
            .toBuffer();

        return { buffer: enhanced, mimeType: 'image/jpeg' };
    } catch (err) {
        console.warn('No se pudo mejorar la imagen del comprobante, se sube el original:', err);
        return { buffer, mimeType };
    }
}
