import Link from "next/link";
import { Receipt, ShieldUser } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1C2D54] via-[#121D38] to-[#121D38]">
      <div className="absolute top-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-[40%] -left-[10%] w-[70%] h-[70%] rounded-full bg-[#8CC63F]/10 blur-[120px]" />
        <div className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-[#3EAE49]/10 blur-[120px]" />
      </div>

      <div className="max-w-3xl w-full space-y-8 text-center">
        <div className="space-y-4 flex flex-col items-center">
          {/* Logo Oficial Facilita */}
          <div className="flex flex-col items-center mb-6">
            <img
              src="/logo.png"
              alt="Facilita Capacitación y Consultoría"
              className="h-28 md:h-36 object-contain drop-shadow-2xl"
            />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white drop-shadow-sm mt-4">
            Registro de Gastos
          </h1>
          <p className="text-[#8CC63F] font-medium text-lg md:text-xl max-w-xl mx-auto leading-relaxed">
            Captura, procesa y sincroniza recibos automáticamente.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto pt-8">
          <Link href="/worker/login" className="group relative overflow-hidden rounded-3xl bg-white/5 p-8 border border-white/10 hover:bg-[#8CC63F]/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-[#8CC63F]/20">
            <div className="absolute inset-0 bg-gradient-to-br from-[#8CC63F]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="p-4 bg-[#8CC63F]/20 rounded-2xl text-[#8CC63F] group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                <Receipt className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2 text-white">Trabajadores</h2>
                <p className="text-sm text-zinc-300">Captura recibos y registra tus gastos diarios de forma rápida</p>
              </div>
            </div>
          </Link>

          <Link href="/admin/login" className="group relative overflow-hidden rounded-3xl bg-white/5 p-8 border border-white/10 hover:bg-[#3EAE49]/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-[#3EAE49]/20">
            <div className="absolute inset-0 bg-gradient-to-br from-[#3EAE49]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="p-4 bg-[#3EAE49]/20 rounded-2xl text-[#8CC63F] group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                <ShieldUser className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2 text-white">Administración</h2>
                <p className="text-sm text-zinc-300">Gestiona usuarios y revisa el historial de gastos corporativo</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
