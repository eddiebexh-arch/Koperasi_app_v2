import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { WeighingEntry } from './FieldOperator/WeighingEntry';
import { SalesTripEntry } from './FieldOperator/SalesTripEntry';
import { OperationalExpenseEntry } from './FieldOperator/OperationalExpenseEntry';

/**
 * EditTransactionModal
 * Wraps entry forms in edit mode.
 * type: 'PURCHASE' | 'TRIP' | 'EXPENSE'
 */
export function EditTransactionModal({ type, item, onClose, onSaved }) {
  const handleDone = () => {
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b-2 border-[#D4A373] p-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-base font-black text-gray-900 uppercase">Mode Edit Transaksi</h3>
              <p className="text-[11px] text-gray-500">
                Perubahan akan tersimpan ulang & sinkron otomatis. Modal WAC pool ikut dihitung ulang.
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-edit-modal-btn"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        <div className="p-3 sm:p-5">
          {type === 'PURCHASE' && <WeighingEntry initialData={item} onDone={handleDone} />}
          {type === 'TRIP' && <SalesTripEntry initialData={item} onDone={handleDone} />}
          {type === 'EXPENSE' && <OperationalExpenseEntry initialData={item} onDone={handleDone} />}
        </div>
      </div>
    </div>
  );
}
