import React from 'react';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../context/AuthContext';
import { Wifi, WifiOff, RefreshCw, ShieldCheck, Scale, BarChart3, LogOut, User } from 'lucide-react';

export function Navbar({ activeMode, setActiveMode, openAuthModal }) {
  const { isOnline, isSyncing, pendingCount, triggerSync } = useSync();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-[#1E4620] text-white shadow-md border-b border-[#2C662F]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#D4A373] text-[#1E4620] flex items-center justify-center font-black text-xl shadow-inner">
            🌴
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-tight font-sans">
              BUB MAKEKAL HULU
            </h1>
            <p className="text-xs text-[#D4A373] font-medium hidden sm:block">
              Sistem Timbangan & Perdagangan Sawit Orang Rimba
            </p>
          </div>
        </div>

        {/* Mode Switcher Buttons */}
        <div className="flex items-center bg-[#153417] p-1 rounded-xl border border-[#2C662F]/60">
          <button
            data-testid="mode-field-operator-btn"
            onClick={() => setActiveMode('OPERATOR')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeMode === 'OPERATOR'
                ? 'bg-[#D4A373] text-[#1E4620] shadow-md font-bold'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Timbangan Lapangan</span>
          </button>

          <button
            data-testid="mode-manager-dashboard-btn"
            onClick={() => setActiveMode('MANAGER')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeMode === 'MANAGER'
                ? 'bg-[#D4A373] text-[#1E4620] shadow-md font-bold'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Dashboard Pengelola</span>
          </button>
        </div>

        {/* Sync & Connection Status + Auth */}
        <div className="flex items-center gap-2">
          {/* Sync status indicator badge */}
          <div
            data-testid="sync-status-badge"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isOnline
                ? pendingCount > 0
                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                  : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                : 'bg-red-500/20 text-red-200 border-red-400/40'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-red-400" />
                <span className="hidden md:inline">Offline</span>
              </>
            )}

            {pendingCount > 0 && (
              <span
                data-testid="pending-sync-count"
                className="ml-1 px-1.5 py-0.2 bg-amber-400 text-gray-900 text-[10px] font-black rounded-full"
                title={`${pendingCount} transaksi belum tersinkron`}
              >
                {pendingCount}
              </span>
            )}
          </div>

          {/* Sync Now Trigger */}
          <button
            data-testid="manual-sync-btn"
            onClick={() => triggerSync(true)}
            disabled={isSyncing}
            className="p-1.5 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-50"
            title="Sinkronkan data sekarang"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#D4A373]' : ''}`} />
          </button>

          {/* Auth Button for Manager */}
          {user ? (
            <div className="flex items-center gap-2 pl-1 border-l border-white/20">
              <span className="text-xs text-[#D4A373] hidden lg:inline font-medium">
                {user.name} ({user.role})
              </span>
              <button
                data-testid="logout-btn"
                onClick={logout}
                className="p-1.5 text-red-300 hover:text-red-100 hover:bg-red-900/40 rounded-lg transition-all text-xs flex items-center gap-1"
                title="Keluar / Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              data-testid="open-login-btn"
              onClick={openAuthModal}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 transition-all"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Login Admin</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
