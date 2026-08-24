'use client';
import { X, FileText, Calendar, User, Tag, FolderOpen, MapPin, Hash, AlertCircle } from 'lucide-react';

type DeletedRecord = {
    id: string;
    table_name: 'receipts' | 'projects' | 'categories' | 'workers';
    original_id: string;
    data: any;
    deleted_at: string;
    deleted_by: string;
};

export default function RecycleBinDetailModal({ record, onClose }: { record: DeletedRecord; onClose: () => void }) {
    const { table_name, data } = record;
    const isPdf = data?.image_url?.toLowerCase().split('?')[0].endsWith('.pdf');

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-[#121D38] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
                    <div>
                        <h3 className="text-sm font-semibold text-white">Detalle del elemento eliminado</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">
                            Eliminado el {new Date(record.deleted_at).toLocaleString('es-CL')} por {record.deleted_by}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 space-y-4">
                    {table_name === 'receipts' && (
                        <>
                            {data?.image_url && data.image_url.startsWith('http') && (
                                <div className="rounded-xl border border-white/5 bg-zinc-950/40 overflow-hidden h-72">
                                    {isPdf ? (
                                        <iframe src={`${data.image_url}#toolbar=1&navpanes=0`} className="w-full h-full border-none" title="Boleta" />
                                    ) : (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={data.image_url} alt="Boleta" className="w-full h-full object-contain" />
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <Field icon={Tag} label="Comercio" value={data?.merchant} />
                                <Field icon={Hash} label="RUT" value={data?.merchant_rut} />
                                <Field icon={FileText} label="Documento" value={`${data?.document_type || 'boleta'}${data?.document_number ? ` Nº ${data.document_number}` : ''}`} />
                                <Field icon={Calendar} label="Fecha" value={data?.date} />
                                <Field icon={Tag} label="Categoría" value={data?.category} />
                                <Field icon={FileText} label="Monto" value={data?.amount ? `$${Number(data.amount).toLocaleString('es-CL')}` : undefined} />
                                <Field icon={User} label="Trabajador" value={data?.worker_email} />
                                <Field icon={AlertCircle} label="Estado antes de eliminar" value={data?.status} />
                                <Field icon={FolderOpen} label="Proyecto (ID)" value={data?.project_id} />
                                <Field icon={MapPin} label="Ubicación" value={data?.location ? 'Registrada' : undefined} />
                            </div>
                            {data?.rejection_reason && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-xs text-red-300">
                                    Motivo de rechazo: {data.rejection_reason}
                                </div>
                            )}
                        </>
                    )}

                    {table_name === 'projects' && (
                        <div className="grid grid-cols-2 gap-3">
                            <Field icon={FolderOpen} label="Nombre" value={data?.name} />
                            <Field icon={AlertCircle} label="Activo" value={data?.active ? 'Sí' : 'No'} />
                            <div className="col-span-2">
                                <Field icon={FileText} label="Descripción" value={data?.description} />
                            </div>
                        </div>
                    )}

                    {table_name === 'categories' && (
                        <div className="grid grid-cols-2 gap-3">
                            <Field icon={Tag} label="Nombre" value={data?.name} />
                            <Field icon={Tag} label="Color" value={data?.color} />
                            <Field
                                icon={AlertCircle}
                                label="Límite de alerta"
                                value={data?.max_amount_alert ? `$${Number(data.max_amount_alert).toLocaleString('es-CL')}` : 'Sin tope'}
                            />
                        </div>
                    )}

                    {table_name === 'workers' && (
                        <div className="grid grid-cols-2 gap-3">
                            <Field icon={User} label="Nombre" value={data?.user_metadata?.name} />
                            <Field icon={FileText} label="Email" value={data?.email} />
                            <Field icon={Tag} label="Rol" value={data?.user_metadata?.role || 'colaborador'} />
                            <Field icon={AlertCircle} label="Suspendido" value={data?.user_metadata?.is_suspended ? 'Sí' : 'No'} />
                        </div>
                    )}

                    <div className="pt-2 border-t border-white/5">
                        <p className="text-[10px] text-zinc-600">ID original: {record.original_id}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Field({ icon: Icon, label, value }: { icon: any; label: string; value?: string | number | null }) {
    return (
        <div className="bg-[#1C2D54]/40 border border-white/5 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-zinc-500 flex items-center gap-1 uppercase tracking-wide">
                <Icon className="w-3 h-3" />
                {label}
            </p>
            <p className="text-xs text-zinc-200 mt-1 break-words">{value || value === 0 ? value : '—'}</p>
        </div>
    );
}
