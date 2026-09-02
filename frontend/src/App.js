import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { Navbar } from './components/Navbar';
import { WeighingEntry } from './components/FieldOperator/WeighingEntry';
import { StockPoolView } from './components/FieldOperator/StockPoolView';
import { SalesTripEntry } from './components/FieldOperator/SalesTripEntry';
import { OperationalExpenseEntry } from './components/FieldOperator/OperationalExpenseEntry';
import { LocalHistoryView } from './components/FieldOperator/LocalHistoryView';
import { ManagerDashboard } from './components/ManagerDashboard/ManagerDashboard';
import { AdminAuthModal } from './components/ManagerDashboard/AdminAuthModal';
import { Toaster } from 'sonner';
import { Scale, Layers, Truck, Receipt, History, AlertCircle } from 'lucide-react';
import './App.css';

function MainContent() {
  const [activeMode, setActiveMode] = useState('OPERATOR'); // 'OPERATOR' | 'MANAGER'
  const [operatorTab, setOperatorTab] = useState('WEIGHING'); // 'WEIGHING' | 'POOL' | 'TRIP' | 'EXPENSE' | 'HISTORY'
  const [prefilledTripKg, setPrefilledTripKg] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleSelectTripDispatch = (kg) => {
    setPrefilledTripKg(kg);
    setOperatorTab('TRIP');
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-gray-900 font-sans flex flex-col">
      <Navbar
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        openAuthModal={() => setIsAuthModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-6">
        {activeMode === 'OPERATOR' ? (
          <div className="space-y-6">
            {/* Operator Tablet Sub-Nav (Big Touch Targets) */}
            <div className="bg-white p-2 rounded-2xl shadow-md border border-gray-200 flex flex-wrap items-center justify-between gap-1 sm:gap-2">
              {[
                { id: 'WEIGHING', label: '1. Timbang Petani', icon: Scale },
                { id: 'POOL', label: '2. Pool Stok (WAC)', icon: Layers },
                { id: 'TRIP', label: '3. Kirim ke Loading', icon: Truck },
                { id: 'EXPENSE', label: '4. Biaya Lapangan', icon: Receipt },
                { id: 'HISTORY', label: '5. Riwayat Tablet', icon: History }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = operatorTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    data-testid={`operator-tab-${tab.id.toLowerCase()}`}
                    onClick={() => setOperatorTab(tab.id)}
                    className={`flex-1 min-w-[130px] py-3 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all border-2 ${
                      isActive
                        ? 'bg-[#1E4620] text-white border-[#1E4620] shadow-md ring-2 ring-[#D4A373]'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Operator Active Tab Views */}
            {operatorTab === 'WEIGHING' && <WeighingEntry />}
            {operatorTab === 'POOL' && <StockPoolView onSelectTripDispatch={handleSelectTripDispatch} />}
            {operatorTab === 'TRIP' && <SalesTripEntry prefilledDispatchedKg={prefilledTripKg} />}
            {operatorTab === 'EXPENSE' && <OperationalExpenseEntry />}
            {operatorTab === 'HISTORY' && <LocalHistoryView />}
          </div>
        ) : (
          <ManagerDashboard />
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 py-4 px-6 text-center text-xs text-gray-500">
        <p className="font-semibold text-gray-700">
          BUB Makekal Hulu • Pos Timbangan Sawit Orang Rimba
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Progressive Web App Offline-First • IndexedDB & Fast Synchronizer
        </p>
      </footer>

      <AdminAuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <MainContent />
      </SyncProvider>
    </AuthProvider>
  );
}
