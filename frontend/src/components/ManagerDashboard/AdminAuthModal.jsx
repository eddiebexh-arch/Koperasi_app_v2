import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Lock, UserCheck, KeyRound, ShieldAlert, X } from 'lucide-react';

export function AdminAuthModal({ isOpen, onClose }) {
  const { isInitialized, login, setupAdmin } = useAuth();

  const [mode, setMode] = useState(isInitialized ? 'LOGIN' : 'SETUP');
  const [name, setName] = useState('Pengelola BUB Makekal');
  const [email, setEmail] = useState('admin@makekal.id');
  const [password, setPassword] = useState('SawitMakekal2026!');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      if (mode === 'SETUP') {
        await setupAdmin(name, email, password);
        toast.success('Akun Pengelola berhasil diinisialisasi!');
      } else {
        await login(email, password);
        toast.success('Berhasil login sebagai Pengelola!');
      }
      onClose();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Gagal autentikasi. Periksa email & password.';
      toast.error(typeof msg === 'string' ? msg : 'Gagal autentikasi');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border-2 border-[#1E4620]">
        {/* Header */}
        <div className="bg-[#1E4620] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-[#D4A373]" />
            <h3 className="text-lg font-bold">
              {mode === 'SETUP' ? 'Inisialisasi Akun Pengelola Pertama' : 'Login Dashboard Pengelola'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-white hover:bg-white/20 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === 'SETUP' && (
            <div>
              <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-1">
                Nama Lengkap Pengelola
              </label>
              <input
                type="text"
                data-testid="admin-setup-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pengelola BUB Makekal"
                className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-300 focus:border-[#1E4620] outline-none text-sm font-semibold"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-1">
              Alamat Email Pengelola
            </label>
            <input
              type="email"
              data-testid="admin-email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@makekal.id"
              className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-300 focus:border-[#1E4620] outline-none text-sm font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-1">
              Kata Sandi (Password)
            </label>
            <input
              type="password"
              data-testid="admin-password-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-300 focus:border-[#1E4620] outline-none text-sm font-semibold"
              required
            />
          </div>

          {/* Preset Helper Text */}
          <div className="bg-[#FEFAE0] p-3 rounded-xl text-xs text-gray-700 border border-[#D4A373]/60">
            <p className="font-bold">Akun Default Terpasang:</p>
            <p className="font-mono text-[11px] text-gray-600 mt-0.5">
              Email: <code>admin@makekal.id</code> | Pass: <code>SawitMakekal2026!</code>
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="submit-auth-btn"
            className="w-full py-3.5 px-4 rounded-xl bg-[#1E4620] hover:bg-[#2C662F] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <UserCheck className="w-4 h-4 text-[#D4A373]" />
            <span>{isSubmitting ? 'Memproses...' : mode === 'SETUP' ? 'Inisialisasi & Masuk' : 'Masuk Dashboard'}</span>
          </button>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => setMode(mode === 'SETUP' ? 'LOGIN' : 'SETUP')}
              className="text-xs font-semibold text-[#1E4620] hover:underline"
            >
              {mode === 'SETUP' ? 'Sudah punya akun? Login di sini' : 'Belum inisialisasi? Buat akun baru'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
