import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    // Para pruebas locales o Vercel. Asegurarse de tener el origin correcto:
    process.env.NODE_ENV === 'production'
        ? 'https://facilita-gastos.vercel.app/api/auth/google/callback'
        : 'http://localhost:3000/api/auth/google/callback'
);

export default oauth2Client;
