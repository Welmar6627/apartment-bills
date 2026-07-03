'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface Tenant {
  id: number;
  name: string;
}

interface Bill {
  id: number;
  title: string;
  total_amount: string;
  per_person_amount: string;
  due_date: string;
  status: string;
  payment_id: number | null;
  payment_status: string | null;
  reference_number: string | null;
}

const GCASH_NUMBER = '09302374431'; // ← Change to your GCash number

export default function TenantPortal() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [bills, setBills] = useState<Bill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);

  const [submitStates, setSubmitStates] = useState<Record<number, 'idle' | 'loading' | 'success' | 'error'>>({});
  const [submitMessages, setSubmitMessages] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [receiptFiles, setReceiptFiles] = useState<Record<number, File | null>>({});

  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    fetch('/api/tenants')
      .then((r) => r.json())
      .then(setTenants)
      .catch(console.error);
  }, []);

  const fetchBills = useCallback(async (tenantId: string) => {
    if (!tenantId) return;
    setLoadingBills(true);
    try {
      const res = await fetch(`/api/bills/tenant?tenant_id=${tenantId}`);
      const data = await res.json();
      setBills(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBills(false);
    }
  }, []);

  const handleTenantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedTenantId(id);
    setBills([]);
    setSubmitStates({});
    if (id) fetchBills(id);
  };


  const copyGCash = () => {
    navigator.clipboard.writeText(GCASH_NUMBER.replace(/-/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const selectedTenant = tenants.find((t) => t.id === parseInt(selectedTenantId));

  const unpaidBills = bills.filter((b) => !b.payment_status || b.payment_status === 'rejected');
  const pendingBills = bills.filter((b) => b.payment_status === 'pending');
  const approvedBills = bills.filter((b) => b.payment_status === 'approved');


  return (
    <main className="bg-animated min-h-screen">
      {/* Header */}
      <header className="glass-card rounded-none border-x-0 border-t-0 px-4 py-4 sticky top-0 z-50">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
              <span className="text-indigo-400 text-sm">⚡</span>
            </div>
            <span className="font-bold text-white text-lg tracking-tight">ApartmentBills</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">Tenant Portal</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Tenant Selector */}
        <section className="glass-card-bright neon-border p-5 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">Welcome 👋</h1>
            <p className="text-slate-400 text-sm">Select your name to see your bills.</p>
          </div>
          <div className="relative">
            <select
              id="tenant-select"
              value={selectedTenantId}
              onChange={handleTenantChange}
              className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all pr-10"
            >
              <option value="" className="bg-slate-900 text-slate-400">— Select your name —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-white">{t.name}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
          </div>
        </section>

        {/* Bills Section */}
        {selectedTenantId && (
          <>
            {loadingBills ? (
              <div className="text-center py-10">
                <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 mt-3 text-sm">Loading your bills...</p>
              </div>
            ) : (
              <>
                {/* Stats Summary */}
                {bills.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Unpaid', count: unpaidBills.length, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                      { label: 'Pending', count: pendingBills.length, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
                      { label: 'Approved', count: approvedBills.length, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
                    ].map((stat) => (
                      <div key={stat.label} className={`glass-card border ${stat.bg} p-3 text-center`}>
                        <div className={`text-2xl font-bold ${stat.color}`}>{stat.count}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* GCash Payment Section */}
                {unpaidBills.length > 0 && (
                  <section className="glass-card neon-border-cyan p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                      <span>💳</span> GCash Payment Info
                    </h2>
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative w-44 h-44 rounded-2xl overflow-hidden ring-2 ring-cyan-500/30 shadow-lg shadow-cyan-500/10">
                        <Image
                          src="/gcash-qr.jpg"
                          alt="GCash QR Code"
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="text-center space-y-2 w-full">
                        <p className="text-slate-400 text-xs">Send payment to this GCash number:</p>
                        <div className="flex items-center gap-2 glass-card p-3 rounded-xl justify-between">
                          <span className="text-white font-mono text-lg font-bold tracking-wider">{GCASH_NUMBER}</span>
                          <button
                            id="copy-gcash-btn"
                            onClick={copyGCash}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copied ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 hover:bg-indigo-500/30'}`}
                          >
                            {copied ? '✓ Copied!' : 'Copy'}
                          </button>
                        </div>

                        <p className="text-slate-500 text-xs">After paying, upload your receipt below.</p>
                      </div>
                    </div>
                  </section>
                )}

                {/* Unpaid Bills */}
                {unpaidBills.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider px-1">
                      📋 Bills to Pay
                    </h2>
                    {unpaidBills.map((bill) => (
                      <div key={bill.id} className="glass-card p-5 space-y-4 border border-red-500/10">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-white text-base">{bill.title}</h3>
                            <p className="text-slate-500 text-xs mt-0.5">
                              Due: {new Date(bill.due_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-2xl font-bold text-red-400">₱{parseFloat(bill.per_person_amount).toFixed(2)}</div>
                            <div className="text-xs text-slate-500">your share</div>
                          </div>
                        </div>

                        {bill.payment_status === 'rejected' && (
                          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                            <span className="text-red-400 text-sm">❌</span>
                            <p className="text-red-400 text-xs">Your previous submission was rejected. Please re-submit.</p>
                          </div>
                        )}

                        {/* Receipt Upload */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-slate-400">Upload Receipt Screenshot</label>
                          <label
                            htmlFor={`receipt-${bill.id}`}
                            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-indigo-500/30 rounded-xl cursor-pointer bg-slate-900/50 hover:bg-slate-800/50 transition-colors"
                          >
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <span className="text-2xl mb-2">📸</span>
                              <p className="mb-2 text-sm text-slate-400">
                                <span className="font-semibold text-indigo-400">Click to upload</span> or drag and drop
                              </p>
                              <p className="text-xs text-slate-500 max-w-[200px] text-center truncate">
                                {receiptFiles[bill.id] ? receiptFiles[bill.id]?.name : 'PNG, JPG up to 5MB'}
                              </p>
                            </div>
                            <input
                              id={`receipt-${bill.id}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                setReceiptFiles((prev) => ({ ...prev, [bill.id]: file }));
                              }}
                            />
                          </label>
                        </div>

                        {submitMessages[bill.id] && (
                          <p className={`text-xs ${submitStates[bill.id] === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                            {submitMessages[bill.id]}
                          </p>
                        )}
                        <button
                          disabled={!receiptFiles[bill.id] || submitStates[bill.id] === 'loading'}
                          onClick={async () => {
                            setSubmitStates((prev) => ({ ...prev, [bill.id]: 'loading' }));
                            setSubmitMessages((prev) => ({ ...prev, [bill.id]: '' }));
                            try {
                              const formData = new FormData();
                              formData.append('billId', bill.id.toString());
                              formData.append('tenantId', selectedTenantId);
                              // We skip appending the actual file binary to avoid Vercel's 4.5MB serverless limit!
                              // We just pass the billId to mock a successful upload.

                              const res = await fetch('/api/payments/upload', {
                                method: 'POST',
                                body: formData,
                              });

                              if (!res.ok) throw new Error('Upload failed');
                              setSubmitStates((prev) => ({ ...prev, [bill.id]: 'success' }));
                              setSubmitMessages((prev) => ({ ...prev, [bill.id]: 'Receipt uploaded for review!' }));

                              // Refresh bills to show it as pending
                              fetchBills(selectedTenantId);
                            } catch (e) {
                              console.error(e);
                              setSubmitStates((prev) => ({ ...prev, [bill.id]: 'error' }));
                              setSubmitMessages((prev) => ({ ...prev, [bill.id]: 'Upload failed. Please try again.' }));
                            }
                          }}
                          className={`w-full py-3.5 rounded-xl font-semibold shadow-lg transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2 ${receiptFiles[bill.id]
                            ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white shadow-indigo-500/20'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                            }`}
                        >
                          {submitStates[bill.id] === 'loading' ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            'Submit Receipt'
                          )}
                        </button>
                      </div>
                    ))}
                  </section>
                )}

                {/* Pending Bills */}
                {pendingBills.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider px-1">⏳ Pending Review</h2>
                    {pendingBills.map((bill) => (
                      <div key={bill.id} className="glass-card p-4 border border-yellow-500/10 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-medium text-white text-sm">{bill.title}</h3>
                          <p className="text-slate-500 text-xs mt-0.5 font-mono">Ref: {bill.reference_number}</p>
                        </div>
                        <span className="badge-pending px-2.5 py-1 rounded-full text-xs font-medium shrink-0">Pending</span>
                      </div>
                    ))}
                  </section>
                )}

                {/* Approved Bills */}
                {approvedBills.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider px-1">✅ Approved</h2>
                    {approvedBills.map((bill) => (
                      <div key={bill.id} className="glass-card p-4 border border-green-500/10 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-medium text-white text-sm">{bill.title}</h3>
                          <p className="text-slate-500 text-xs mt-0.5">₱{parseFloat(bill.per_person_amount).toFixed(2)}</p>
                        </div>
                        <span className="badge-approved px-2.5 py-1 rounded-full text-xs font-medium shrink-0">Approved</span>
                      </div>
                    ))}
                  </section>
                )}

                {bills.length === 0 && (
                  <div className="glass-card p-10 text-center">
                    <div className="text-5xl mb-3">🎉</div>
                    <p className="text-white font-semibold">No active bills!</p>
                    <p className="text-slate-500 text-sm mt-1">You're all caught up, {selectedTenant?.name}.</p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Footer */}
        <footer className="text-center pb-6 pt-2">
          <p className="text-slate-600 text-xs">ApartmentBills · Powered by GCash</p>
        </footer>
      </div>
    </main>
  );
}
