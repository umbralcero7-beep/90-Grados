import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Eye, 
  EyeOff, 
  AlertCircle,
  HelpCircle,
  X
} from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login } = useApp();

  const [identifierInput, setIdentifierInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [twoFactorCodeInput, setTwoFactorCodeInput] = useState('');
  const [is2FAStep, setIs2FAStep] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await login(identifierInput, pinInput, is2FAStep ? twoFactorCodeInput : undefined);
      setIsLoading(false);

      if (res.requires2FA && !is2FAStep) {
        setIs2FAStep(true);
        setTwoFactorCodeInput('');
        setErrorMsg(null);
        return;
      }

      if (!res.success) {
        setErrorMsg('No fue posible iniciar sesión. Verifica tus datos o solicita ayuda al administrador.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMsg('Error de conexión o verificación de credenciales.');
    }
  };

  const handleBackToCredentials = () => {
    setIs2FAStep(false);
    setTwoFactorCodeInput('');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen w-screen bg-[#000100] text-[#F4F1F1] flex flex-col justify-center items-center p-4 sm:p-6 font-sans selection:bg-[#C53747] selection:text-white relative">
      
      {/* Background Ambience Accent */}
      <div 
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#200607]/80 via-[#010102] to-black"
      />

      {/* Main Login Card */}
      <div className="relative z-10 w-full max-w-md bg-[#200607] border border-[#4B3438] rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-9 backdrop-blur-sm">
        
        {/* Subtle Brand Accent Stripe */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#200607] via-[#C53747] to-[#200607]" />

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3 mb-7">
          <div className="w-16 h-16 rounded-2xl bg-[#000100] border border-[#4B3438] flex items-center justify-center p-1 shadow-xl overflow-hidden">
            <img 
              src="/assets/aistudio/FullLogo_dd4cd38a.jpg" 
              alt="90 Grados Gastro Bar" 
              className="w-full h-full object-cover rounded-xl" 
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Iniciar sesión
            </h1>
            <p className="text-xs text-[#C4C0C5] mt-1 font-mono">
              90 Grados
            </p>
          </div>
        </div>

        {/* Generic Error Message Banner */}
        {errorMsg && (
          <div 
            role="alert"
            className="mb-5 p-3.5 rounded-xl bg-[#C53747]/20 border border-[#C53747] text-xs text-[#F4F1F1] flex items-start gap-2.5 animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 text-[#C53747] shrink-0 mt-0.5" />
            <p className="leading-relaxed font-medium">
              {errorMsg}
            </p>
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!is2FAStep ? (
            <>
              {/* Identifier Field: Username or Email */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="identifier" 
                  className="block text-xs font-semibold text-[#F4F1F1]"
                >
                  Usuario o correo
                </label>
                <input
                  id="identifier"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={identifierInput}
                  onChange={(e) => setIdentifierInput(e.target.value)}
                  placeholder="Usuario o correo"
                  className="w-full px-3.5 py-2.5 bg-[#010102] border border-[#4B3438] rounded-xl text-sm text-white placeholder-[#666992] focus:outline-none focus:border-[#C53747] focus:ring-1 focus:ring-[#C53747] transition-colors"
                />
              </div>

              {/* Password / PIN Field with Visibility Toggle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="password" 
                    className="block text-xs font-semibold text-[#F4F1F1]"
                  >
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="text-[11px] text-[#C4C0C5] hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                    aria-label={showPin ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-[#C53747]" />}
                    <span>{showPin ? 'Ocultar' : 'Mostrar'}</span>
                  </button>
                </div>

                <input
                  id="password"
                  type={showPin ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Contraseña"
                  className="w-full px-3.5 py-2.5 bg-[#010102] border border-[#4B3438] rounded-xl text-sm text-white placeholder-[#666992] focus:outline-none focus:border-[#C53747] focus:ring-1 focus:ring-[#C53747] transition-colors tracking-wider"
                />
              </div>
            </>
          ) : (
            /* 2FA Step */
            <div className="space-y-3 animate-in fade-in">
              <div className="space-y-1.5">
                <label 
                  htmlFor="twoFactorCode" 
                  className="block text-xs font-semibold text-[#F4F1F1]"
                >
                  Código de verificación
                </label>
                <input
                  id="twoFactorCode"
                  type="text"
                  required
                  maxLength={6}
                  autoFocus
                  autoComplete="one-time-code"
                  value={twoFactorCodeInput}
                  onChange={(e) => setTwoFactorCodeInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Código de 6 dígitos"
                  className="w-full px-3.5 py-3 text-center bg-[#010102] border border-[#C53747] rounded-xl text-xl font-mono text-white tracking-[0.3em] focus:outline-none focus:ring-1 focus:ring-[#C53747]"
                />
              </div>

              <button
                type="button"
                onClick={handleBackToCredentials}
                className="text-xs text-[#C4C0C5] hover:text-white transition-colors block text-center mx-auto cursor-pointer"
              >
                Volver a usuario y contraseña
              </button>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || (!is2FAStep ? (!identifierInput.trim() || !pinInput.trim()) : !twoFactorCodeInput.trim())}
              className={`
                w-full py-3 px-4 rounded-xl font-bold text-sm tracking-wide text-white
                flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer
                ${isLoading || (!is2FAStep ? (!identifierInput.trim() || !pinInput.trim()) : !twoFactorCodeInput.trim())
                  ? 'bg-[#010102] text-[#666992] border border-[#4B3438] cursor-not-allowed opacity-60'
                  : 'bg-[#C53747] hover:bg-[#d84354] border border-white/20 active:scale-[0.99] shadow-lg'
                }
              `}
            >
              {isLoading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </div>
        </form>

        {/* Discreet Help Link */}
        <div className="mt-5 pt-4 border-t border-[#4B3438] text-center">
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="text-xs text-[#C4C0C5] hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#666992]" />
            <span>¿Necesitas ayuda?</span>
          </button>
        </div>

      </div>

      {/* Discrete Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#200607] border border-[#4B3438] rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl relative text-[#F4F1F1]">
            <div className="flex items-center justify-between border-b border-[#4B3438] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#C53747]" />
                <span>Asistencia de Acceso</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="text-[#C4C0C5] hover:text-white cursor-pointer p-1"
                aria-label="Cerrar modal de ayuda"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#C4C0C5] leading-relaxed">
              Si olvidaste tus datos de acceso, tu cuenta no está habilitada o necesitas permisos para operar, solicita ayuda directamente al administrador del establecimiento.
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-[#010102] hover:bg-[#200607] text-[#F4F1F1] font-semibold text-xs border border-[#4B3438] cursor-pointer transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
