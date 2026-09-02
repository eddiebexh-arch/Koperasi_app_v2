import React from 'react';
import { X, CheckCircle2, Share2, Copy } from 'lucide-react';
import { toast } from 'sonner';

export function DigitalReceiptModal({ data, onClose }) {
  if (!data) return null;

  const isPurchase = !data.loading_name;
  const formattedTotal = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    isPurchase ? data.total_cost || 0 : data.total_revenue || 0
  );

  const copyReceiptText = () => {
    let text = `=========================\n`;
    text += `🌴 NOTA BUB MAKEKAL HULU 🌴\n`;
    text += `=========================\n`;
    if (isPurchase) {
      text += `ID Nota: ${data.local_id}\n`;
      text += `Petani: ${data.farmer_name}\n`;
      text += `Komoditas: ${data.commodity_type}\n`;
      text += `Berat Timbang: ${data.field_weight_kg} Kg\n`;
      text += `Harga / Kg: Rp ${Number(data.price_per_kg).toLocaleString('id-ID')}\n`;
      text += `TOTAL BAYAR: ${formattedTotal}\n`;
      text += `Status: ${data.status} (Tunai)\n`;
      text += `Waktu: ${new Date(data.timestamp || Date.now()).toLocaleString('id-ID')}\n`;
    } else {
      text += `ID Trip: ${data.local_id}\n`;
      text += `Loading: ${data.loading_name}\n`;
      text += `No. Nota: ${data.nota_number}\n`;
      text += `Berat Lapangan: ${data.dispatched_weight_kg} Kg\n`;
      text += `Berat Loading: ${data.loading_weight_kg} Kg (Susut: ${data.weight_loss_kg} Kg / ${data.weight_loss_pct}%)\n`;
      text += `Potongan 2%: ${data.deduction_2pct_kg} Kg -> Net: ${data.billable_weight_kg} Kg\n`;
      if (data.grade_b_returned_kg > 0) {
        text += `Grade B Bawa Pulang: ${data.grade_b_returned_kg} Kg (Kembali ke Stok Berondol)\n`;
      }
      text += `Total Pendapatan: ${formattedTotal}\n`;
      text += `Net Margin Trip: Rp ${Number(data.net_margin).toLocaleString('id-ID')}\n`;
      text += `Status: ${data.payment_status}\n`;
    }
    text += `=========================\nTerima Kasih Petani Makekal!`;

    navigator.clipboard.writeText(text);
    toast.success('Ringkasan Nota berhasil disalin ke clipboard!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="bg-[#1E4620] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-[#D4A373]" />
            <h3 className="text-lg font-bold">Ringkasan Nota Digital</h3>
          </div>
          <button
            data-testid="close-receipt-modal-btn"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Content Body */}
        <div className="p-6 space-y-4 font-mono text-sm">
          <div className="text-center pb-3 border-b border-dashed border-gray-300">
            <p className="font-bold text-gray-900 text-base font-sans tracking-wide">BUB MAKEKAL HULU</p>
            <p className="text-xs text-gray-500 font-sans">Koperasi & Pos Penimbangan Sawit Rakyat</p>
            <p className="text-[11px] text-gray-400 mt-1">ID: {data.local_id}</p>
          </div>

          {isPurchase ? (
            <div className="space-y-2 text-gray-700">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Nama Petani:</span>
                <span className="font-bold text-gray-900">{data.farmer_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Komoditas:</span>
                <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                  {data.commodity_type}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Berat Timbang:</span>
                <span className="font-bold text-gray-900">{data.field_weight_kg} Kg</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Harga per Kg:</span>
                <span>Rp {Number(data.price_per_kg).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Status Bayar:</span>
                <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 rounded">
                  {data.status || 'PAID (Tunai)'}
                </span>
              </div>
              <div className="bg-[#FEFAE0] border border-[#D4A373]/50 p-3 rounded-xl mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-sans font-bold text-gray-800">TOTAL DITERIMA:</span>
                  <span className="font-sans font-black text-xl text-[#1E4620]">{formattedTotal}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-gray-700">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Loading RAM:</span>
                <span className="font-bold text-gray-900">{data.loading_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">No. Nota Loading:</span>
                <span className="font-semibold text-gray-800">{data.nota_number}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Berat Lapangan / Loading:</span>
                <span>{data.dispatched_weight_kg} Kg / {data.loading_weight_kg} Kg</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Susut Timbangan:</span>
                <span className={`font-semibold ${data.weight_loss_pct > 5 ? 'text-red-600 font-bold' : 'text-gray-800'}`}>
                  {data.weight_loss_kg} Kg ({data.weight_loss_pct}%)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Potongan Wajib 2%:</span>
                <span>{data.deduction_2pct_kg} Kg (Net: {data.billable_weight_kg} Kg)</span>
              </div>
              {data.grade_b_returned_kg > 0 && (
                <div className="flex justify-between py-1 border-b border-amber-100 bg-amber-50 px-2 rounded">
                  <span className="text-amber-800">Retur Grade B:</span>
                  <span className="font-bold text-amber-900">{data.grade_b_returned_kg} Kg (Ke Stok Berondol)</span>
                </div>
              )}
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl mt-3 space-y-1">
                <div className="flex justify-between items-center text-xs text-gray-600 font-sans">
                  <span>Total Pendapatan:</span>
                  <span className="font-bold text-gray-900">{formattedTotal}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-emerald-200">
                  <span className="font-sans font-bold text-gray-800">MARGIN BERSIH:</span>
                  <span className="font-sans font-black text-lg text-emerald-800">
                    Rp {Number(data.net_margin || 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="text-[11px] text-gray-400 text-center pt-2">
            Tersimpan aman di database lokal & server BUB Makekal.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between gap-3 border-t border-gray-200">
          <button
            data-testid="copy-receipt-btn"
            onClick={copyReceiptText}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-300 bg-white text-gray-700 font-bold text-xs hover:bg-gray-100 transition-all shadow-sm"
          >
            <Copy className="w-4 h-4 text-gray-500" />
            <span>Salin Ringkasan</span>
          </button>
          <button
            data-testid="close-receipt-btn"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#1E4620] hover:bg-[#2C662F] text-white font-bold text-xs transition-all shadow-md"
          >
            Selesai / Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
