import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CircleCheck, ArrowLeft, Share2, Mail, Upload } from 'lucide-react';

const SOURCE_LABELS: Record<string, { label: string; icon: typeof Share2 }> = {
    share_target: { label: 'Compartido desde el celular', icon: Share2 },
    email: { label: 'Recibido por correo', icon: Mail },
    manual: { label: 'Subido manualmente', icon: Upload },
    whatsapp: { label: 'Recibido por WhatsApp', icon: Share2 },
};

export default async function ComprobanteDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/admin/login');
    }

    const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('id', id)
        .single();

    if (!payment) {
        return (
            <div className="min-h-screen bg-[#121D38] text-zinc-50 font-sans flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <p className="text-zinc-400">No se encontró el comprobante.</p>
                    <Link href="/admin/dashboard" className="text-[#8CC63F] hover:underline text-sm">
                        Volver al panel
                    </Link>
                </div>
            </div>
        );
    }

    const isPdf = payment.file_type === 'pdf';
    const source = SOURCE_LABELS[payment.source] || SOURCE_LABELS.manual;
    const SourceIcon = source.icon;

    return (
        <div className="min-h-screen bg-[#121D38] text-zinc-50 font-sans p-6">
            <div className="max-w-xl mx-auto space-y-6">
                <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Volver al panel
                </Link>

                <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/10 rounded-2xl p-6 shadow-xl space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#8CC63F]/20 rounded-lg text-[#8CC63F]">
                            <CircleCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold">Comprobante recibido</h1>
                            <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                                <SourceIcon className="w-3.5 h-3.5" />
                                {source.label}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-zinc-950/40 overflow-hidden h-96">
                        {isPdf ? (
                            <iframe
                                src={`${payment.file_url}#toolbar=1&navpanes=0`}
                                className="w-full h-full border-none"
                                title="Comprobante de pago"
                            />
                        ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={payment.file_url}
                                alt="Comprobante de pago"
                                className="w-full h-full object-contain"
                            />
                        )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-400 border-t border-white/5 pt-4">
                        <span>Estado: <span className="text-yellow-400 font-medium">Pendiente de asociar</span></span>
                        <span>{new Date(payment.created_at).toLocaleString('es-CL')}</span>
                    </div>

                    <p className="text-xs text-zinc-500">
                        Próximamente podrás asociar este comprobante a una o más boletas desde el panel de administración.
                    </p>
                </div>
            </div>
        </div>
    );
}
