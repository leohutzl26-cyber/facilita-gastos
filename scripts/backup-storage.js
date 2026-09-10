// Descarga todos los archivos de los buckets de Supabase Storage a una
// carpeta local, preservando la estructura de carpetas, para incluirlos en
// el respaldo periódico junto con el dump de la base de datos.
//
// Uso: node scripts/backup-storage.js <carpeta-destino>
// Requiere las variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const BUCKETS = ['receipts', 'payment-proofs'];

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Supabase Storage no distingue "carpeta" de "archivo" en la respuesta de list():
// una entrada sin metadata (id === null) es una carpeta, hay que bajar un nivel más.
async function listAllFiles(bucket, prefix = '') {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) throw error;

    let files = [];
    for (const item of data || []) {
        const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null) {
            const nested = await listAllFiles(bucket, itemPath);
            files = files.concat(nested);
        } else {
            files.push(itemPath);
        }
    }
    return files;
}

async function downloadBucket(bucket, outDir) {
    const files = await listAllFiles(bucket);
    console.log(`${bucket}: ${files.length} archivo(s)`);

    for (const filePath of files) {
        const { data, error } = await supabase.storage.from(bucket).download(filePath);
        if (error) {
            console.error(`  error descargando ${bucket}/${filePath}: ${error.message}`);
            continue;
        }
        const destPath = path.join(outDir, bucket, filePath);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        const buffer = Buffer.from(await data.arrayBuffer());
        fs.writeFileSync(destPath, buffer);
    }
}

async function main() {
    const outDir = process.argv[2];
    if (!outDir) throw new Error('Falta el directorio de salida (uso: node backup-storage.js <carpeta>)');
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Faltan las variables de entorno SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    }

    fs.mkdirSync(outDir, { recursive: true });

    for (const bucket of BUCKETS) {
        await downloadBucket(bucket, outDir);
    }

    console.log('Descarga de Storage completa.');
}

main().catch(err => {
    console.error('Fallo el respaldo de Storage:', err);
    process.exit(1);
});
