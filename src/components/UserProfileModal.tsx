import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { UserProfile, UserRole, ModuleOperation, RolePermissionsConfig } from '../types';
import { defaultRolePermissions, defaultUserModulePermissions } from '../data/initialData';
import { formatCOP, formatDateTimeBogota } from '../utils/format';
import { hashPinPBKDF2 } from '../utils/cryptoAuth';
import { 
  User, 
  Camera, 
  Upload, 
  Check, 
  X, 
  Shield, 
  Phone, 
  Mail, 
  Clock, 
  KeyRound, 
  Users, 
  Plus, 
  Award, 
  Trash2, 
  Sparkles,
  RefreshCw,
  AlertCircle,
  Sliders,
  DollarSign,
  FileCheck,
  FileText,
  Boxes,
  ShieldCheck
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'profile' | 'directory' | 'create' | 'permissions';
}

const PRESET_AVATARS = [
  '/src/assets/images/avatar_chef_patron_1792183524504.jpg',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&h=300&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&h=300&q=80',
  'https://images.unsplash.com/photo-1583394293214-28ded15ee548?auto=format&fit=crop&w=300&h=300&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&h=300&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&h=300&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&h=300&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=300&h=300&q=80'
];

const ROLE_LABELS: Record<UserRole, { label: string; desc: string }> = {
  administrador: {
    label: 'Administrador / Dueño',
    desc: 'Acceso total a caja, turnos, costos, libro mayor, configuración y anulación auditada.',
  },
  cajero: {
    label: 'Cajero(a)',
    desc: 'Cobros exactos con billetes COP, aperturas/cierres de caja, arqueos y comprobantes.',
  },
  mesero: {
    label: 'Mesero(a) de Salón',
    desc: 'Toma de pedidos en mesas, notas de cocina, adición de platos y consulta de cuentas.',
  },
  cocina_bar: {
    label: 'Cocina & Bar (KDS)',
    desc: 'Gestión de comandas en pantalla compartida: recibido, en preparación, listo y entregado.',
  },
  inventario_contabilidad: {
    label: 'Inventario & Costos',
    desc: 'Entrada de compras, escandallos de recetas, mermas, traslados y libro mayor.',
  },
};

const BIO_TEMPLATES: Record<UserRole, string[]> = {
  administrador: [
    'Administradora de 90 Grados. Velando por la excelencia en carnes a la brasa, servicio cálido y gestión financiera transparente.',
    'Propietario y parrillero. Enfocado en la tradición gastronómica de Cundinamarca y control riguroso de calidad.',
  ],
  cajero: [
    'Cajera principal con atención rápida y cordial. Especialista en conteo ágil de billetes y arqueos sin discrepancias.',
    'Responsable de cobros en caja y facturación con comprobantes. Servicio con calidez y precisión.',
  ],
  mesero: [
    'Mesero apasionado por el servicio al cliente y las recomendaciones de cortes a la llanera y picadas para compartir.',
    'Atención rápida en salón y terraza. Comprometido con la experiencia familiar en 90 Grados.',
  ],
  cocina_bar: [
    'Jefe de cocina especializado en carnes al carbón, pescados tradicionales y sazón colombiana.',
    'Bartender del turno nocturno. Control estricto de cervezas y licores, coctelería y bebidas frías.',
  ],
  inventario_contabilidad: [
    'Encargada de compras de insumos, auditoría de recetas y control de mermas en bodega y bar.',
    'Supervisión de libro mayor gerencial, conciliación de licores por turno y costos operativos.',
  ],
};

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, defaultTab = 'profile' }) => {
  const { 
    currentUser, 
    allUsers, 
    updateUserProfile, 
    addUserProfile, 
    deleteUserProfile, 
    switchUser,
    config,
    updateRolePermission
  } = useApp();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'directory' | 'create' | 'permissions'>(defaultTab);
  
  // Current user edit state
  const [username, setUsername] = useState(currentUser.username);
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [role, setRole] = useState<UserRole>(currentUser.role);
  const [pin, setPin] = useState('');
  const [phone, setPhone] = useState(currentUser.phone);
  const [email, setEmail] = useState(currentUser.email);
  const [assignedShift, setAssignedShift] = useState(currentUser.assignedShift);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Create new user state
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newAvatarUrl, setNewAvatarUrl] = useState(PRESET_AVATARS[2]);
  const [newBio, setNewBio] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('mesero');
  const [newPin, setNewPin] = useState('');
  const [newPhone, setNewPhone] = useState('310 000 0000');
  const [newEmail, setNewEmail] = useState('');
  const [newShift, setNewShift] = useState<'matutino' | 'nocturno' | 'ambos'>('matutino');
  const [createSuccess, setCreateSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle image upload from computer (Base64 Data URL)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isNew: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor selecciona un archivo de imagen válido (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('La imagen supera el límite de 5MB. Por favor elige una imagen más ligera.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (isNew) {
        setNewAvatarUrl(base64);
      } else {
        setAvatarUrl(base64);
      }
      setErrorMsg('');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Sanitize username
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) {
      setErrorMsg('El nombre de usuario debe tener mínimo 3 caracteres (letras, números o guion bajo).');
      return;
    }

    // Check username uniqueness
    const exists = allUsers.some(u => u.id !== currentUser.id && u.username === cleanUsername);
    if (exists) {
      setErrorMsg(`El nombre de usuario "@${cleanUsername}" ya está en uso por otro miembro.`);
      return;
    }

    if (!fullName.trim()) {
      setErrorMsg('El nombre completo es obligatorio.');
      return;
    }

    const updates: Partial<UserProfile> = {
      username: cleanUsername,
      fullName: fullName.trim(),
      avatarUrl,
      bio: bio.trim(),
      role,
      phone: phone.trim(),
      email: email.trim(),
      assignedShift,
    };

    if (pin.trim()) {
      if (!/^\d{4,6}$/.test(pin.trim())) {
        setErrorMsg('El PIN de seguridad debe contener entre 4 y 6 dígitos numéricos.');
        return;
      }
      try {
        const { pinHash, pinSalt } = await hashPinPBKDF2(pin.trim());
        updates.pinHash = pinHash;
        updates.pinSalt = pinSalt;
      } catch (err: any) {
        setErrorMsg(err.message || 'Error al derivar el PIN.');
        return;
      }
    }

    updateUserProfile(currentUser.id, updates);

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUsername = newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) {
      setErrorMsg('El nombre de usuario debe tener mínimo 3 caracteres.');
      return;
    }

    const exists = allUsers.some(u => u.username === cleanUsername);
    if (exists) {
      setErrorMsg(`El usuario "@${cleanUsername}" ya existe.`);
      return;
    }

    if (!newFullName.trim()) {
      setErrorMsg('El nombre completo es requerido.');
      return;
    }

    if (!/^\d{4,6}$/.test(newPin.trim())) {
      setErrorMsg('El PIN para el nuevo perfil debe tener entre 4 y 6 dígitos numéricos.');
      return;
    }

    try {
      const { pinHash, pinSalt } = await hashPinPBKDF2(newPin.trim());
      addUserProfile({
        username: cleanUsername,
        fullName: newFullName.trim(),
        avatarUrl: newAvatarUrl,
        bio: newBio.trim(),
        role: newRole,
        pinHash,
        pinSalt,
        phone: newPhone.trim(),
        email: newEmail.trim() || `${cleanUsername}@90grados.local`,
        assignedShift: newShift,
        lastLogin: new Date().toISOString(),
        isWhitelisted: true,
        isActive: true,
        modulePermissions: defaultUserModulePermissions[newRole],
      });

      setCreateSuccess(true);
      setTimeout(() => {
        setCreateSuccess(false);
        setActiveTab('directory');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el PIN.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#121524] border border-[#1E2338] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl text-[#EBE1D5] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#23294C] panel-header-gradient">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#151946] border border-[#7C170D] flex items-center justify-center text-white shadow">
              <User className="w-5 h-5 text-[#EBE1D5]" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">Sistema de Perfiles de Usuario</h2>
              <div className="flex items-center gap-2 text-xs text-[#A6AFCA]">
                <span>90 Grados POS</span>
                <span aria-hidden="true">·</span>
                <span>Restaurante & Bar</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#EBE1D5] font-mono font-medium">@{currentUser.username}</span>
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-[#A6AFCA] hover:text-[#EBE1D5] rounded-lg hover:bg-[#151946] transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[#1E2338] bg-[#0E1120]">
          <button
            onClick={() => { setActiveTab('profile'); setErrorMsg(''); }}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-[#7C170D] text-white font-bold'
                : 'border-transparent text-[#71788E] hover:text-[#EBE1D5]'
            }`}
          >
            <User className="w-4 h-4" />
            Mi Perfil (@{currentUser.username})
          </button>
          <button
            onClick={() => { setActiveTab('directory'); setErrorMsg(''); }}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'directory'
                ? 'border-[#7C170D] text-white font-bold'
                : 'border-transparent text-[#71788E] hover:text-[#EBE1D5]'
            }`}
          >
            <Users className="w-4 h-4" />
            Directorio del Equipo ({allUsers.length})
          </button>
          <button
            onClick={() => { setActiveTab('create'); setErrorMsg(''); }}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'create'
                ? 'border-[#7C170D] text-white font-bold'
                : 'border-transparent text-[#71788E] hover:text-[#EBE1D5]'
            }`}
          >
            <Plus className="w-4 h-4" />
            Nuevo Perfil
          </button>
          <button
            onClick={() => { setActiveTab('permissions'); setErrorMsg(''); }}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'permissions'
                ? 'border-[#7C170D] text-white font-bold'
                : 'border-transparent text-[#71788E] hover:text-[#EBE1D5]'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Permisos por Rol
          </button>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-950/60 border border-red-800/80 rounded-lg flex items-center gap-2 text-sm text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TAB 1: MI PERFIL */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="p-6 space-y-6">
            
            {/* Top row: Avatar upload & Username preview */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-4 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20">
              
              {/* Avatar with Upload button */}
              <div className="relative group shrink-0">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#7C170D] shadow-lg bg-[#0D1024] flex items-center justify-center">
                  <img 
                    src={avatarUrl} 
                    alt={fullName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback if broken
                      (e.target as HTMLImageElement).src = PRESET_AVATARS[0];
                    }}
                  />
                </div>
                
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-[#7C170D] hover:bg-[#961D12] text-white rounded-full shadow-lg transition-transform active:scale-95 cursor-pointer border border-[#EBE1D5]/30"
                  title="Subir foto de perfil desde el equipo"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={(e) => handleFileUpload(e, false)}
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                />
              </div>

              {/* Bio & Handle header info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-white">{fullName}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-[#151946] border border-[#EBE1D5]/30 text-[#EBE1D5] font-mono">
                    @{username || 'usuario'}
                  </span>
                </div>
                <p className="text-xs text-[#EBE1D5] font-semibold mt-1">
                  {ROLE_LABELS[role].label}
                </p>
                <p className="text-xs text-[#A6AFCA] mt-2 line-clamp-2">
                  {bio || 'Sin biografía configurada. Escribe una descripción breve abajo.'}
                </p>

                {/* Upload or Preset Picker toggle */}
                <div className="flex items-center gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-[#EBE1D5] hover:text-white flex items-center gap-1.5 py-1 px-2.5 rounded bg-[#151946] border border-[#EBE1D5]/20 hover:bg-[#1E235E] transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#EBE1D5]" />
                    Subir foto local
                  </button>
                  <span className="text-xs text-[#A6AFCA]">o elige un avatar:</span>
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    {PRESET_AVATARS.slice(0, 4).map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatarUrl(preset)}
                        className={`w-6 h-6 rounded-full overflow-hidden border transition-all cursor-pointer ${
                          avatarUrl === preset ? 'ring-2 ring-[#7C170D] scale-110' : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={preset} alt="preset" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Username Input */}
              <div>
                <label className="block text-xs font-semibold text-[#EBE1D5] uppercase tracking-wider mb-1.5">
                  Nombre de Usuario (Handle POS) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-[#A6AFCA] font-mono text-sm">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="ej. diana_caja"
                    maxLength={20}
                    className="w-full pl-8 pr-3 py-2 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white placeholder-[#71788E] focus:outline-none focus:border-[#7C170D] font-mono"
                    required
                  />
                </div>
                <p className="text-[11px] text-[#A6AFCA] mt-1">
                  Aparece en tickets, comandas y registros de auditoría. Solo letras minúsculas, números y _
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-[#EBE1D5] uppercase tracking-wider mb-1.5">
                  Nombre y Apellidos *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="ej. Diana Paola Torres"
                  className="w-full px-3 py-2 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white placeholder-[#71788E] focus:outline-none focus:border-[#7C170D]"
                  required
                />
              </div>

              {/* Short Bio Textarea with Character Counter */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#EBE1D5] uppercase tracking-wider">
                    Biografía Corta (Perfil del Empleado)
                  </label>
                  <span className={`text-[11px] font-mono ${bio.length > 220 ? 'text-[#7C170D]' : 'text-[#A6AFCA]'}`}>
                    {bio.length} / 240 caracteres
                  </span>
                </div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 240))}
                  rows={2}
                  placeholder="Escribe una breve descripción de tu rol, especialidad culinaria o experiencia en servicio en 90 Grados..."
                  className="w-full px-3 py-2 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white placeholder-[#71788E] focus:outline-none focus:border-[#7C170D] resize-none"
                />
                
                {/* Bio quick templates */}
                <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                  <span className="text-[#A6AFCA] flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#EBE1D5]" /> Plantillas sugeridas:
                  </span>
                  {BIO_TEMPLATES[role]?.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setBio(tmpl)}
                      className="text-[11px] px-2 py-0.5 rounded bg-[#151946] text-[#EBE1D5] hover:text-white hover:bg-[#1E235E] border border-[#EBE1D5]/20 transition-colors truncate max-w-xs cursor-pointer"
                      title={tmpl}
                    >
                      "{tmpl.slice(0, 42)}..."
                    </button>
                  ))}
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-[#EBE1D5] uppercase tracking-wider mb-1.5">
                  Rol en el Restaurante *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#7C170D]"
                >
                  <option value="administrador">Administrador / Dueño</option>
                  <option value="cajero">Cajero(a)</option>
                  <option value="mesero">Mesero(a)</option>
                  <option value="cocina_bar">Cocina & Bar (KDS)</option>
                  <option value="inventario_contabilidad">Inventario & Contabilidad</option>
                </select>
                <p className="text-[11px] text-[#A6AFCA] mt-1">
                  {ROLE_LABELS[role].desc}
                </p>
              </div>

              {/* 4-digit PIN */}
              <div>
                <label className="block text-xs font-semibold text-[#EBE1D5] uppercase tracking-wider mb-1.5">
                  PIN Rápido Terminal (4 dígitos) *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Dejar vacío para conservar actual"
                    className="w-full px-3 py-2 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white font-mono tracking-widest focus:outline-none focus:border-[#7C170D]"
                  />
                  <KeyRound className="w-4 h-4 text-[#A6AFCA] absolute right-3 top-2.5" />
                </div>
                <p className="text-[11px] text-[#A6AFCA] mt-1">
                  Ingresa 4 a 6 dígitos numéricos para actualizar el PIN del terminal.
                </p>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-[#EBE1D5] uppercase tracking-wider mb-1.5">
                  Teléfono / WhatsApp
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="313 276 41 50"
                    className="w-full pl-9 pr-3 py-2 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#7C170D]"
                  />
                  <Phone className="w-4 h-4 text-[#A6AFCA] absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Turno asignado */}
              <div>
                <label className="block text-xs font-semibold text-[#EBE1D5] uppercase tracking-wider mb-1.5">
                  Turno Operativo Habitual
                </label>
                <select
                  value={assignedShift}
                  onChange={(e) => setAssignedShift(e.target.value as 'matutino' | 'nocturno' | 'ambos')}
                  className="w-full px-3 py-2 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#7C170D]"
                >
                  <option value="matutino">Restaurante Matutino (Día)</option>
                  <option value="nocturno">Bar Nocturno (Tarde / Noche)</option>
                  <option value="ambos">Ambos turnos (Rotativo / Gerencia)</option>
                </select>
              </div>
            </div>

            {/* Performance Statistics Card */}
            <div className="p-4 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#EBE1D5] mb-3 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-[#7C170D]" />
                Estadísticas Operativas del Perfil
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-2 rounded-lg bg-[#121524] border border-[#EBE1D5]/20">
                  <span className="text-xl font-bold text-white font-mono tabular-nums">
                    {currentUser.stats?.ordersCreated ?? 0}
                  </span>
                  <p className="text-[11px] text-[#A6AFCA] mt-0.5">Órdenes Tomadas</p>
                </div>
                <div className="p-2 rounded-lg bg-[#121524] border border-[#EBE1D5]/20">
                  <span className="text-xl font-bold text-[#EBE1D5] font-mono tabular-nums">
                    {formatCOP(currentUser.stats?.totalSoldCOP ?? 0)}
                  </span>
                  <p className="text-[11px] text-[#A6AFCA] mt-0.5">Total Cobrado</p>
                </div>
                <div className="p-2 rounded-lg bg-[#121524] border border-[#EBE1D5]/20">
                  <span className="text-xl font-bold text-emerald-400 font-mono tabular-nums">
                    {currentUser.stats?.shiftsClosed ?? 0}
                  </span>
                  <p className="text-[11px] text-[#A6AFCA] mt-0.5">Cierres Z Conducidos</p>
                </div>
              </div>
            </div>

            {/* Save Buttons & Feedback */}
            <div className="flex items-center justify-between pt-2 border-t border-[#EBE1D5]/15">
              <div className="text-xs text-[#A6AFCA]">
                {savedSuccess && (
                  <span className="text-emerald-400 font-medium flex items-center gap-1.5 animate-in fade-in">
                    <Check className="w-4 h-4" /> ¡Perfil actualizado exitosamente!
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-[#A6AFCA] hover:text-white bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#7C170D] hover:bg-[#961D12] rounded-lg transition-colors shadow-md flex items-center gap-2 cursor-pointer border border-[#EBE1D5]/30"
                >
                  <Check className="w-4 h-4" />
                  Guardar Perfil
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: DIRECTORIO DEL EQUIPO */}
        {activeTab === 'directory' && (
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[#A6AFCA]">
                Personal activo de 90 Grados. Haz clic en "Cambiar a este usuario" para operar el POS bajo su nombre.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="text-xs px-3.5 py-1.5 rounded-lg bg-[#7C170D] hover:bg-[#961D12] text-white font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 border border-[#EBE1D5]/30 shadow-md"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Miembro
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allUsers.map((user) => {
                const isCurrent = user.id === currentUser.id;
                return (
                  <div 
                    key={user.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isCurrent 
                        ? 'bg-[#151946] border-[#7C170D] shadow-md ring-1 ring-[#7C170D]/40'
                        : 'bg-[#0E1120] border-[#EBE1D5]/20 hover:border-[#EBE1D5]/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          <img 
                            src={user.avatarUrl} 
                            alt={user.fullName}
                            className="w-12 h-12 rounded-full object-cover border border-[#EBE1D5]/30 bg-[#0D1024]"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = PRESET_AVATARS[1];
                            }}
                          />
                          {isCurrent && (
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#121524]" title="Sesión activa" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-sm font-bold text-white truncate">{user.fullName}</h4>
                            <span className="text-[11px] font-mono text-[#EBE1D5] shrink-0">
                              @{user.username}
                            </span>
                          </div>
                          <span className="inline-block text-[11px] text-[#A6AFCA]">
                            {ROLE_LABELS[user.role]?.label || user.role}
                          </span>
                        </div>
                      </div>

                      {/* Bio preview */}
                      <p className="text-xs text-[#A6AFCA] mt-2.5 line-clamp-2 bg-[#121524] p-2 rounded-lg border border-[#EBE1D5]/15">
                        {user.bio || 'Sin biografía registrada.'}
                      </p>

                      {/* Metadata */}
                      <div className="flex items-center gap-3 text-[11px] text-[#A6AFCA] mt-2.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#EBE1D5]" /> Turno: {user.assignedShift}
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-[#EBE1D5]" /> {user.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#EBE1D5]/15">
                      {isCurrent ? (
                        <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Usuario Activo
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            switchUser(user.id);
                            onClose();
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg bg-[#151946] hover:bg-[#1E235E] border border-[#EBE1D5]/20 text-[#EBE1D5] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3 text-[#EBE1D5]" />
                          Cambiar a este usuario
                        </button>
                      )}

                      {allUsers.length > 1 && !isCurrent && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`¿Seguro que deseas eliminar el perfil de @${user.username}?`)) {
                              deleteUserProfile(user.id);
                            }
                          }}
                          className="p-1.5 text-[#A6AFCA] hover:text-red-400 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: NUEVO PERFIL */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateProfile} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="p-3 bg-[#151946]/50 border border-[#EBE1D5]/20 rounded-xl text-xs text-[#EBE1D5] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#EBE1D5] shrink-0" />
              <span>Registra un nuevo integrante para el restaurante o bar 90 Grados. Asigna su foto, username y rol operativo.</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-[#0E1120] rounded-xl border border-[#EBE1D5]/20">
              <div className="relative group shrink-0">
                <img 
                  src={newAvatarUrl} 
                  alt="avatar" 
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#7C170D] bg-[#0D1024]"
                />
                <button
                  type="button"
                  onClick={() => newFileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-1.5 bg-[#7C170D] hover:bg-[#961D12] text-white rounded-full shadow cursor-pointer border border-[#EBE1D5]/30"
                  title="Subir foto"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input 
                  type="file" 
                  ref={newFileInputRef}
                  onChange={(e) => handleFileUpload(e, true)}
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                />
              </div>

              <div className="flex-1 w-full">
                <span className="text-xs text-[#A6AFCA] block mb-2">Selecciona un avatar o sube su fotografía:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_AVATARS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setNewAvatarUrl(preset)}
                      className={`w-8 h-8 rounded-full overflow-hidden border transition-all cursor-pointer ${
                        newAvatarUrl === preset ? 'ring-2 ring-[#7C170D] scale-110' : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={preset} alt="preset" className="w-full h-full object-cover" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => newFileInputRef.current?.click()}
                    className="text-xs px-2.5 py-1 rounded bg-[#151946] border border-[#EBE1D5]/20 text-[#EBE1D5] hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3 text-[#EBE1D5]" /> Subir archivo
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#EBE1D5] mb-1">Nombre de Usuario (@username) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-[#A6AFCA] font-mono text-sm">@</span>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="ej. santiago_parrilla"
                    className="w-full pl-8 pr-3 py-2 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-[#7C170D]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#EBE1D5] mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="ej. Santiago Cruz"
                  className="w-full px-3 py-2 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#7C170D]"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#EBE1D5]">Biografía Corta</label>
                  <span className="text-[11px] font-mono text-[#A6AFCA]">{newBio.length}/240</span>
                </div>
                <textarea
                  value={newBio}
                  onChange={(e) => setNewBio(e.target.value.slice(0, 240))}
                  rows={2}
                  placeholder="Breve reseña sobre experiencia o función en el restaurante..."
                  className="w-full px-3 py-2 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white placeholder-[#71788E] focus:outline-none focus:border-[#7C170D] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#EBE1D5] mb-1">Rol Operativo *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#7C170D]"
                >
                  <option value="mesero">Mesero(a)</option>
                  <option value="cajero">Cajero(a)</option>
                  <option value="cocina_bar">Cocina & Bar (KDS)</option>
                  <option value="inventario_contabilidad">Inventario & Contabilidad</option>
                  <option value="administrador">Administrador(a)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#EBE1D5] mb-1">PIN POS (4-6 dígitos) *</label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="****"
                  className="w-full px-3 py-2 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white font-mono tracking-widest focus:outline-none focus:border-[#7C170D]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#EBE1D5] mb-1">Teléfono</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="310 123 4567"
                  className="w-full px-3 py-2 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#7C170D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#EBE1D5] mb-1">Turno Asignado</label>
                <select
                  value={newShift}
                  onChange={(e) => setNewShift(e.target.value as 'matutino' | 'nocturno' | 'ambos')}
                  className="w-full px-3 py-2 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#7C170D]"
                >
                  <option value="matutino">Restaurante Matutino</option>
                  <option value="nocturno">Bar Nocturno</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EBE1D5]/15">
              {createSuccess && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="w-4 h-4" /> ¡Perfil creado! Redirigiendo...
                </span>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('directory')}
                className="px-4 py-2 text-xs font-medium text-[#A6AFCA] hover:text-white bg-white/5 rounded-lg hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-[#7C170D] hover:bg-[#961D12] rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md border border-[#EBE1D5]/30"
              >
                <Plus className="w-4 h-4" /> Crear Perfil
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: PERMISOS POR ROL */}
        {activeTab === 'permissions' && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#EBE1D5]/15 pb-3">
              <div>
                <h4 className="font-bold text-white text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#EBE1D5]" />
                  <span>Matriz de Permisos por Rol (Almacenado en Contexto)</span>
                </h4>
                <p className="text-xs text-[#A6AFCA] mt-0.5">
                  Defina qué roles tienen autorización para registrar gastos, aprobar pagos, ver reportes y gestionar inventario.
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                currentUser.role === 'administrador'
                  ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#151946] text-[#EBE1D5] border border-[#EBE1D5]/30'
              }`}>
                {currentUser.role === 'administrador' ? 'Modo Edición (Admin)' : 'Solo Lectura'}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#EBE1D5]/20">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#151946] border-b border-[#EBE1D5]/20 text-[#EBE1D5] uppercase text-[11px]">
                    <th className="p-3">Operación en Módulo</th>
                    <th className="p-3 text-center">Administrador</th>
                    <th className="p-3 text-center">Cajero(a)</th>
                    <th className="p-3 text-center">Mesero(a)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBE1D5]/10">
                  {[
                    {
                      id: 'registrar_gastos' as ModuleOperation,
                      title: 'Registrar Gastos',
                      desc: 'Registrar egresos de caja y compras operativas',
                      icon: DollarSign,
                    },
                    {
                      id: 'aprobar_pagos' as ModuleOperation,
                      title: 'Aprobar Pagos',
                      desc: 'Autorizar egresos pendientes o mayores al umbral',
                      icon: FileCheck,
                    },
                    {
                      id: 'ver_reportes' as ModuleOperation,
                      title: 'Ver Reportes',
                      desc: 'Consultar balances, comparativas y reportes',
                      icon: FileText,
                    },
                    {
                      id: 'gestionar_inventario' as ModuleOperation,
                      title: 'Gestionar Inventario',
                      desc: 'Ajuste de stock físico, escandallos y mermas',
                      icon: Boxes,
                    },
                  ].map((op) => {
                    const Icon = op.icon;
                    const perms = config.rolePermissions || defaultRolePermissions;

                    return (
                      <tr key={op.id} className="hover:bg-[#151946]/20 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded bg-[#151946] border border-[#EBE1D5]/20 text-[#EBE1D5]">
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="font-bold text-white block">{op.title}</span>
                              <span className="text-[11px] text-[#A6AFCA]">{op.desc}</span>
                            </div>
                          </div>
                        </td>

                        {(['administrador', 'cajero', 'mesero'] as UserRole[]).map((r) => {
                          const allowed = !!perms[r]?.[op.id];
                          const canEdit = currentUser.role === 'administrador';

                          return (
                            <td key={r} className="p-3 text-center align-middle">
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => {
                                  if (!canEdit) return;
                                  updateRolePermission(r, op.id, !allowed);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                  canEdit ? 'active:scale-95' : 'opacity-70 cursor-not-allowed'
                                } ${
                                  allowed
                                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                                    : 'bg-[#0E1120] border-[#EBE1D5]/20 text-[#A6AFCA] hover:text-white'
                                }`}
                              >
                                {allowed ? (
                                  <span className="flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-400" /> Permitido
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <X className="w-3 h-3 text-[#A6AFCA]" /> Bloqueado
                                  </span>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20 flex items-center justify-between text-xs text-[#A6AFCA]">
              <span>Para configurar parámetros avanzados, acuda al panel superior de <strong>⚙️ Configuración</strong>.</span>
              <span className="font-mono text-emerald-400 font-bold">✓ Almacenado en Contexto</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
