'use client';
import { ShieldUser, LogOut, Users, FileText, LayoutDashboard, Settings, ReceiptText, AlertTriangle, Eye, EyeOff, Folder, Landmark, Glasses } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useState, useEffect, Suspense } from 'react';
import UserCrud from '@/components/admin/UserCrud';
import AdminReceipts from '@/components/admin/AdminReceipts';
import ProjectCrud from '@/components/admin/ProjectCrud';
import DangerZone from '@/components/admin/DangerZone';
import SystemAuditLog from '@/components/admin/SystemAuditLog';
import AdminDashboardCharts from '@/components/admin/AdminDashboardCharts';
import CategoryCrud from '@/components/admin/CategoryCrud';
import RecycleBin from '@/components/admin/RecycleBin';
import AdminPayments from '@/components/admin/AdminPayments';

function AdminDashboardInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') || 'dashboard';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [showDangerZone, setShowDangerZone] = useState(false);
    const [role, setRole] = useState<'admin' | 'revisor' | 'colaborador' | null>(null);
    const readOnly = role === 'revisor';

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            setRole((user?.user_metadata?.role as any) || 'colaborador');
        });
    }, []);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/admin/login');
    };

    const tabs = [
        { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
        { id: 'reports', label: 'Reportes', icon: ReceiptText },
        { id: 'comprobantes', label: 'Comprobantes', icon: Landmark },
        { id: 'workers', label: 'Colaboradores', icon: Users },
        { id: 'projects', label: 'Proyectos', icon: Folder },
        { id: 'categories', label: 'Categorías', icon: Settings },
        { id: 'advanced', label: 'Avanzado', icon: AlertTriangle },
    ];

    return (
        <div className="min-h-screen bg-[#121D38] text-zinc-50 font-sans">
            <nav className="border-b border-[#8CC63F]/10 bg-[#1C2D54]/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#8CC63F]/20 rounded-lg text-[#8CC63F]">
                            <ShieldUser className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-zinc-200">Panel de Administración</span>
                        {readOnly && (
                            <span className="flex items-center gap-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[11px] font-medium px-2.5 py-1 rounded-full">
                                <Glasses className="w-3 h-3" />
                                Modo Revisor · Solo lectura
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Cerrar Sesión
                    </button>
                </div>
                {/* Tabs Header */}
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex gap-1 overflow-x-auto -mb-px">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive
                                            ? 'border-[#8CC63F] text-[#8CC63F]'
                                            : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {activeTab === 'dashboard' && (
                    <div className="animate-in fade-in duration-300">
                        <AdminDashboardCharts />
                    </div>
                )}

                {activeTab === 'comprobantes' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <Landmark className="w-5 h-5 text-[#8CC63F]" />
                            <h2 className="text-xl font-semibold">Comprobantes de Pago</h2>
                        </div>
                        <AdminPayments readOnly={readOnly} />
                    </div>
                )}

                {activeTab === 'workers' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="w-5 h-5 text-[#8CC63F]" />
                            <h2 className="text-xl font-semibold">Gestión de Colaboradores</h2>
                        </div>
                        <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/10 rounded-2xl p-6 shadow-xl">
                            <UserCrud readOnly={readOnly} />
                        </div>
                    </div>
                )}

                {activeTab === 'projects' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <Folder className="w-5 h-5 text-[#8CC63F]" />
                            <h2 className="text-xl font-semibold">Proyectos</h2>
                        </div>
                        <div className="min-h-[400px]">
                            <ProjectCrud readOnly={readOnly} />
                        </div>
                    </div>
                )}

                {activeTab === 'categories' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <Settings className="w-5 h-5 text-[#8CC63F]" />
                            <h2 className="text-xl font-semibold">Categorías y Límites</h2>
                        </div>
                        <div className="min-h-[400px]">
                            <CategoryCrud readOnly={readOnly} />
                        </div>
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5 text-[#8CC63F]" />
                            <h2 className="text-xl font-semibold">Reporte General de Gastos</h2>
                        </div>
                        <div>
                            <AdminReceipts readOnly={readOnly} />
                        </div>
                    </div>
                )}

                {activeTab === 'advanced' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        {/* Panel Colapsable de Zona de Peligro (no disponible en modo revisor) */}
                        {!readOnly && (
                            <div className="bg-[#1C2D54]/20 border border-red-500/10 rounded-2xl p-6 shadow-xl space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5 text-red-400" />
                                            Zona de Peligro del Sistema
                                        </h3>
                                        <p className="text-xs text-zinc-400">
                                            Contiene operaciones destructivas como vaciar bases de datos y restaurar valores iniciales.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowDangerZone(!showDangerZone)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                            showDangerZone
                                                ? 'bg-red-500/10 border-red-500 text-red-400'
                                                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                                        }`}
                                    >
                                        {showDangerZone ? (
                                            <>
                                                <EyeOff className="w-4 h-4" />
                                                Ocultar Opciones Peligrosas
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="w-4 h-4" />
                                                Mostrar Opciones Peligrosas
                                            </>
                                        )}
                                    </button>
                                </div>

                                {showDangerZone && (
                                    <div className="border-t border-red-500/10 pt-4 animate-in slide-in-from-top-2 duration-200">
                                        <DangerZone />
                                    </div>
                                )}
                            </div>
                        )}

                        <RecycleBin readOnly={readOnly} />

                        <SystemAuditLog />
                    </div>
                )}
            </main>
        </div>
    );
}

export default function AdminDashboard() {
    return (
        <Suspense fallback={null}>
            <AdminDashboardInner />
        </Suspense>
    );
}
