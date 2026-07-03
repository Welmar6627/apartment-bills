'use client';

import { useState, useEffect, useCallback, useOptimistic, useTransition, useRef } from 'react';
import Image from 'next/image';

interface Tenant {
  id: number;
  name: string;
  room_number: string | null;
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

type BillAction =
  | { type: 'submit'; billId: number; reference: string }
  | { type: 'revert'; billId: number; previous: Bill };

const GCASH_NUMBER = '09302374431';
const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function compressImageToBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scale = Math.min(1, MAX_WIDTH / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
          'image/jpeg',
          0.6
        );
      };
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = ev.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function TenantPortal() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [bills, setBills] = useState<Bill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [receiptFiles, setReceiptFiles] = useState<Record<number, File | null>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});
  const [dragOver, setDragOver] = useState<Record<number, boolean>>({});
  const [submitStates, setSubmitStates] = useState<Record<number, 'idle' | 'loading' | 'success' | 'error'>>({});
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [, startTransition] = useTransition();
  const previewUrlsRef = useRef(previewUrls);

  previewUrlsRef.current = previewUrls;

  const [optimisticBills, addOptimisticBill] = useOptimistic(
    bills,
    (current: Bill[], action: BillAction) => {
      if (action.type === 'revert') {
        return current.map((b) => (b.id === action.billId ? action.previous : b));
      }
      return current.map((b) =>
        b.id === action.billId
          ? { ...b, payment_status: 'pending', reference_number: action.reference }
          : b
      );
    }
  );

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetch('/api/tenants')
      .then((r) => r.json())
      .then(setTenants)
      .catch(console.error);
  }, []);

  useEffect(() => {
    return () => {
      Object.values(previewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
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

  const clearReceipt = (billId: number) => {
    setReceiptFiles((prev) => ({ ...prev, [billId]: null }));
    setPreviewUrls((prev) => {
      if (prev[billId]) URL.revokeObjectURL(prev[billId]);
      const next = { ...prev };
      delete next[billId];
      return next;
    });
  };

  const assignReceiptFile = (billId: number, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file (PNG, JPG, etc.).', 'error');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast('Image must be under 5MB.', 'error');
      return;
    }
    setReceiptFiles((prev) => ({ ...prev, [billId]: file }));
    setPreviewUrls((prev) => {
      if (prev[billId]) URL.revokeObjectURL(prev[billId]);
      return { ...prev, [billId]: URL.createObjectURL(file) };
    });
    setSubmitStates((prev) => ({ ...prev, [billId]: 'idle' }));
  };

  const handleTenantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedTenantId(id);
    setBills([]);
    Object.values(previewUrls).forEach((url) => URL.revokeObjectURL(url));
    setReceiptFiles({});
    setPreviewUrls({});
    setDragOver({});
    setSubmitStates({});
    if (id) fetchBills(id);
  };

  const copyGCash = () => {
    navigator.clipboard.writeText(GCASH_NUMBER.replace(/-/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmitPayment = async (bill: Bill) => {
    const file = receiptFiles[bill.id];
    if (!file) {
      showToast('Please upload your GCash receipt first.', 'error');
      return;
    }

    const previousBill = { ...bill };
    const savedFile = file;
    setSubmitStates((prev) => ({ ...prev, [bill.id]: 'loading' }));

    startTransition(() => {
      addOptimisticBill({ type: 'submit', billId: bill.id, reference: 'PENDING' });
    });

    setBills((prev) =>
      prev.map((b) =>
        b.id === bill.id ? { ...b, payment_status: 'pending', reference_number: 'PENDING' } : b
      )
    );
    clearReceipt(bill.id);
    showToast(`Receipt submitted for ${bill.title} — verification pending.`, 'success');

    try {
      const compressed = await compressImageToBlob(savedFile);
      const formData = new FormData();
      formData.append('billId', String(bill.id));
      formData.append('tenantId', selectedTenantId);
      formData.append('receipt', compressed, 'receipt.jpg');

      const res = await fetch('/api/payments/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }

      const data = await res.json();
      setBills((prev) =>
        prev.map((b) =>
          b.id === bill.id
            ? { ...b, payment_status: 'pending', reference_number: data.reference_number || 'PENDING' }
            : b
        )
      );
      setSubmitStates((prev) => ({ ...prev, [bill.id]: 'success' }));
    } catch (e) {
      console.error(e);
      startTransition(() => {
        addOptimisticBill({ type: 'revert', billId: bill.id, previous: previousBill });
      });
      setBills((prev) => prev.map((b) => (b.id === bill.id ? previousBill : b)));
      setReceiptFiles((prev) => ({ ...prev, [bill.id]: savedFile }));
      setPreviewUrls((prev) => ({ ...prev, [bill.id]: URL.createObjectURL(savedFile) }));
      setSubmitStates((prev) => ({ ...prev, [bill.id]: 'error' }));
      showToast(
        e instanceof Error ? e.message : `Failed to upload receipt for ${bill.title}.`,
        'error'
      );
    }
  };

  const selectedTenant = tenants.find((t) => t.id === parseInt(selectedTenantId));

  const unpaidBills = optimisticBills.filter(
    (b) => !b.payment_status || b.payment_status === 'rejected'
  );
  const pendingBills = optimisticBills.filter((b) => b.payment_status === 'pending');
  const approvedBills = optimisticBills.filter((b) => b.payment_status === 'approved');

  return (
    <main className="bg-animated min-h-screen">
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
        <section className="glass-card-bright neon-border p-5 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">Welcome 👋</h1>
            <p className="text-slate-400 text-sm">Select your room to see your utility bills.</p>
          </div>
          <div className="relative">
            <select
              id="tenant-select"
              value={selectedTenantId}
              onChange={handleTenantChange}
              className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all pr-10"
            >
              <option value="" className="bg-slate-900 text-slate-400">
                — Select your room / name —
              </option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                  {t.room_number ? `${t.room_number} — ` : ''}
                  {t.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              ▼
            </div>
          </div>
          {selectedTenant && (
            <p className="text-xs text-slate-500">
              Logged in as{' '}
              <span className="text-indigo-400 font-medium">{selectedTenant.name}</span>
              {selectedTenant.room_number && (
                <> · <span className="text-slate-400">{selectedTenant.room_number}</span></>
              )}
            </p>
          )}
        </section>

        {selectedTenantId && (
          <>
            {loadingBills ? (
              <div className="text-center py-10">
                <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400 mt-3 text-sm">Loading your bills...</p>
              </div>
            ) : (
              <>
                {optimisticBills.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Unpaid', count: unpaidBills.length, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                      { label: 'Pending', count: pendingBills.length, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
                      { label: 'Approved', count: approvedBills.length, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className={`glass-card border ${stat.bg} p-3 text-center transition-all duration-300`}
                      >
                        <div className={`text-2xl font-bold ${stat.color}`}>{stat.count}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {unpaidBills.length > 0 && (
                  <section className="glass-card neon-border-cyan p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                      <span>💳</span> GCash Payment Info
                    </h2>
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative w-44 h-44 rounded-2xl overflow-hidden ring-2 ring-cyan-500/30 shadow-lg shadow-cyan-500/10">
                        <Image src="/gcash-qr.jpg" alt="GCash QR Code" fill className="object-cover" />
                      </div>
                      <div className="text-center space-y-2 w-full">
                        <p className="text-slate-400 text-xs">Send payment to this GCash number:</p>
                        <div className="flex items-center gap-2 glass-card p-3 rounded-xl justify-between">
                          <span className="text-white font-mono text-lg font-bold tracking-wider">{GCASH_NUMBER}</span>
                          <button
                            id="copy-gcash-btn"
                            onClick={copyGCash}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              copied
                                ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                                : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 hover:bg-indigo-500/30'
                            }`}
                          >
                            {copied ? '✓ Copied!' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-slate-500 text-xs">
                          After paying, upload your GCash receipt screenshot below.
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {unpaidBills.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider px-1">
                      📋 Bills to Pay
                    </h2>
                    {unpaidBills.map((bill) => (
                      <div
                        key={bill.id}
                        className="glass-card p-5 space-y-4 border border-red-500/10 transition-all duration-300"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-white text-base">{bill.title}</h3>
                            <p className="text-slate-500 text-xs mt-0.5">
                              Due:{' '}
                              {new Date(bill.due_date).toLocaleDateString('en-PH', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-2xl font-bold text-red-400">
                              ₱{parseFloat(bill.per_person_amount).toFixed(2)}
                            </div>
                            <div className="text-xs text-slate-500">your share</div>
                          </div>
                        </div>

                        {bill.payment_status === 'rejected' && (
                          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                            <span className="text-red-400 text-sm">❌</span>
                            <p className="text-red-400 text-xs">
                              Your previous receipt was rejected. Please upload a new one.
                            </p>
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-xs font-medium text-slate-400">
                            Upload GCash Receipt
                          </label>
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOver((prev) => ({ ...prev, [bill.id]: true }));
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault();
                              setDragOver((prev) => ({ ...prev, [bill.id]: false }));
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOver((prev) => ({ ...prev, [bill.id]: false }));
                              const dropped = e.dataTransfer.files?.[0];
                              if (dropped) assignReceiptFile(bill.id, dropped);
                            }}
                            className={`relative flex flex-col items-center justify-center w-full min-h-[8rem] border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                              dragOver[bill.id]
                                ? 'border-cyan-400 bg-cyan-500/10'
                                : previewUrls[bill.id]
                                  ? 'border-indigo-500/50 bg-slate-900/50'
                                  : 'border-indigo-500/30 bg-slate-900/50 hover:bg-slate-800/50 hover:border-indigo-500/50'
                            }`}
                          >
                            <input
                              id={`receipt-${bill.id}`}
                              type="file"
                              accept="image/*"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={(e) => {
                                const picked = e.target.files?.[0] || null;
                                if (picked) assignReceiptFile(bill.id, picked);
                                e.target.value = '';
                              }}
                              disabled={submitStates[bill.id] === 'loading'}
                            />
                            {previewUrls[bill.id] ? (
                              <div className="flex flex-col items-center gap-2 p-3 pointer-events-none">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={previewUrls[bill.id]}
                                  alt="Receipt preview"
                                  className="max-h-24 rounded-lg object-contain"
                                />
                                <p className="text-xs text-indigo-400 font-medium truncate max-w-[200px]">
                                  {receiptFiles[bill.id]?.name}
                                </p>
                                <p className="text-xs text-slate-500">Tap or drop to replace</p>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-6 pointer-events-none">
                                <span className="text-3xl mb-2">{dragOver[bill.id] ? '📥' : '📸'}</span>
                                <p className="text-sm text-slate-400">
                                  <span className="font-semibold text-indigo-400">
                                    {dragOver[bill.id] ? 'Drop receipt here' : 'Drag & drop'}
                                  </span>
                                  {!dragOver[bill.id] && ' or click to upload'}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 5MB</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          disabled={!receiptFiles[bill.id] || submitStates[bill.id] === 'loading'}
                          onClick={() => handleSubmitPayment(bill)}
                          className={`w-full py-3.5 rounded-xl font-semibold shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                            receiptFiles[bill.id]
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
                            'Submit Payment'
                          )}
                        </button>
                      </div>
                    ))}
                  </section>
                )}

                {pendingBills.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider px-1">
                      ⏳ Verification Pending
                    </h2>
                    {pendingBills.map((bill) => (
                      <div
                        key={bill.id}
                        className="glass-card p-4 border border-yellow-500/20 flex items-center justify-between gap-3 transition-all duration-300"
                      >
                        <div>
                          <h3 className="font-medium text-white text-sm">{bill.title}</h3>
                          <p className="text-yellow-400/80 text-xs mt-1">Awaiting admin verification</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="badge-pending px-2.5 py-1 rounded-full text-xs font-medium">
                            Pending
                          </span>
                          <p className="text-slate-500 text-xs mt-1">
                            ₱{parseFloat(bill.per_person_amount).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </section>
                )}

                {approvedBills.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider px-1">
                      ✅ Approved
                    </h2>
                    {approvedBills.map((bill) => (
                      <div
                        key={bill.id}
                        className="glass-card p-4 border border-green-500/10 flex items-center justify-between gap-3 opacity-75"
                      >
                        <div>
                          <h3 className="font-medium text-white text-sm">{bill.title}</h3>
                          <p className="text-slate-500 text-xs mt-0.5">
                            ₱{parseFloat(bill.per_person_amount).toFixed(2)}
                          </p>
                        </div>
                        <span className="badge-approved px-2.5 py-1 rounded-full text-xs font-medium shrink-0">
                          Approved
                        </span>
                      </div>
                    ))}
                  </section>
                )}

                {optimisticBills.length === 0 && (
                  <div className="glass-card p-10 text-center">
                    <div className="text-5xl mb-3">🎉</div>
                    <p className="text-white font-semibold">No active bills!</p>
                    <p className="text-slate-500 text-sm mt-1">
                      You&apos;re all caught up, {selectedTenant?.name}.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <footer className="text-center pb-6 pt-2">
          <p className="text-slate-600 text-xs">ApartmentBills · Powered by GCash</p>
        </footer>
      </div>

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl transition-all ${
            toast.type === 'error'
              ? 'bg-red-500/20 border border-red-500/30 text-red-400'
              : 'bg-green-500/20 border border-green-500/30 text-green-400'
          }`}
        >
          <span>{toast.type === 'error' ? '❌' : '⚡'}</span>
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}
    </main>
  );
}
