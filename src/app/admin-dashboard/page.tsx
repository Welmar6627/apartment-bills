'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface Payment {
  id: number;
  reference_number: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  tenant_name: string;
  bill_title: string;
  per_person_amount: string;
  receipt_image: string | null;
}

interface BillOverview {
  id: number;
  title: string;
  total_amount: string;
  per_person_amount: string;
  due_date: string;
  tenants: { id: number; name: string; payment_status: string }[];
}

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const pin = searchParams.get('pin');
  const correctPin = process.env.NEXT_PUBLIC_ADMIN_PIN || '1234';

  const [authorized, setAuthorized] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const [activeTab, setActiveTab] = useState<'create' | 'review' | 'overview'>('overview');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [overview, setOverview] = useState<BillOverview[]>([]);
  const [loading, setLoading] = useState(false);

  // Bill creation form
  const [billTitle, setBillTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [createStatus, setCreateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [createMessage, setCreateMessage] = useState('');

  // Action states for approve/reject
  const [actionStates, setActionStates] = useState<Record<number, 'idle' | 'loading'>>({});
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  useEffect(() => {
    if (pin === correctPin) {
      setAuthorized(true);
    }
  }, [pin, correctPin]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, oRes] = await Promise.all([
        fetch('/api/payments'),
        fetch('/api/bills/overview'),
      ]);
      const [pData, oData] = await Promise.all([pRes.json(), oRes.json()]);
      if (Array.isArray(pData)) {
        setPayments(pData);
      } else {
        console.error('Failed to fetch payments:', pData);
      }
      if (Array.isArray(oData)) {
        setOverview(oData);
      } else {
        console.error('Failed to fetch overview:', oData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authorized) fetchData();
  }, [authorized, fetchData]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === correctPin) {
      setAuthorized(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billTitle || !totalAmount || !dueDate) return;
    setCreateStatus('loading');
    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: billTitle, total_amount: parseFloat(totalAmount), due_date: dueDate }),
      });
      if (!res.ok) throw new Error('Failed to create bill');
      setCreateStatus('success');
      setCreateMessage(`Bill "${billTitle}" created! Each tenant owes ₱${(parseFloat(totalAmount) / 8).toFixed(2)}.`);
      setBillTitle('');
      setTotalAmount('');
      setDueDate('');
      fetchData();
    } catch {
      setCreateStatus('error');
      setCreateMessage('Failed to create bill. Please try again.');
    }
  };

  const handleAction = async (paymentId: number, status: 'approved' | 'rejected') => {
    setActionStates((p) => ({ ...p, [paymentId]: 'loading' }));
    try {
      await fetch(`/api/payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionStates((p) => ({ ...p, [paymentId]: 'idle' }));
    }
  };

  const pendingPayments = Array.isArray(payments) ? payments.filter((p) => p.status === 'pending') : [];
  const perPersonAmount = totalAmount ? (parseFloat(totalAmount) / 8).toFixed(2) : '0.00';

  // PIN Gate
  if (!authorized) {
    return (
      <main className="bg-animated min-h-screen flex items-center justify-center px-4">
        <div className="glass-card-bright neon-border p-8 w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center mb-4">
              <span className="text-3xl">🔐</span>
            </div>
            <h1 className="text-xl font-bold text-white">Admin Access</h1>
            <p className="text-slate-400 text-sm mt-1">Enter your PIN to continue</p>
          </div>
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <input
              id="admin-pin-input"
              type="password"
              inputMode="numeric"
              placeholder="Enter PIN"
              value={pinInput}
              onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
              className={`w-full bg-white/5 border text-white rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none transition-all ${pinError ? 'border-red-500/60 focus:border-red-500' : 'border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30'}`}
            />
            {pinError && <p className="text-red-400 text-xs text-center">Incorrect PIN. Try again.</p>}
            <button
              id="admin-pin-submit"
              type="submit"
              className="w-full py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-all active:scale-[0.98]"
            >
              Enter Dashboard
            </button>
          </form>
          <p className="text-slate-600 text-xs text-center">Tip: You can also pass <code className="text-indigo-400">?pin=YOUR_PIN</code> in the URL.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-animated min-h-screen">
      {/* Receipt Image Viewer Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setViewingImage(null)}
              className="absolute -top-10 right-0 text-white/60 hover:text-white text-sm"
            >
              ✕ Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewingImage}
              alt="Receipt"
              className="w-full rounded-2xl border border-white/10 shadow-2xl"
            />
          </div>
        </div>
      )}
      {/* Header */}
      <header className="glass-card rounded-none border-x-0 border-t-0 px-4 py-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
              <span className="text-indigo-400 text-sm">⚡</span>
            </div>
            <span className="font-bold text-white text-lg tracking-tight">ApartmentBills</span>
          </div>
          <div className="flex items-center gap-3">
            {pendingPayments.length > 0 && (
              <span className="bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs px-2.5 py-1 rounded-full font-medium">
                {pendingPayments.length} pending
              </span>
            )}
            <span className="text-xs text-slate-500 font-mono">Admin</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Tabs */}
        <div className="glass-card p-1 flex gap-1">
          {([
            { key: 'overview', label: '📊 Overview' },
            { key: 'review', label: `📋 Review${pendingPayments.length > 0 ? ` (${pendingPayments.length})` : ''}` },
            { key: 'create', label: '➕ New Bill' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && activeTab !== 'create' && (
          <div className="text-center py-10">
            <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Create Bill Tab */}
        {activeTab === 'create' && (
          <div className="glass-card-bright neon-border p-6 space-y-5">
            <h2 className="text-lg font-bold text-white">Create New Bill</h2>
            <form onSubmit={handleCreateBill} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Bill Name</label>
                <input
                  id="bill-title-input"
                  type="text"
                  placeholder="e.g. August Wi-Fi, July Electricity"
                  value={billTitle}
                  onChange={(e) => { setBillTitle(e.target.value); setCreateStatus('idle'); }}
                  required
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder-slate-600"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Amount (₱)</label>
                <input
                  id="bill-amount-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 2400.00"
                  value={totalAmount}
                  onChange={(e) => { setTotalAmount(e.target.value); setCreateStatus('idle'); }}
                  required
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder-slate-600"
                />
                {totalAmount && (
                  <p className="text-indigo-400 text-xs mt-1">
                    → Per person: <span className="font-bold text-indigo-300">₱{perPersonAmount}</span> (Total ÷ 8)
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Due Date</label>
                <input
                  id="bill-duedate-input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => { setDueDate(e.target.value); setCreateStatus('idle'); }}
                  required
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
              </div>
              {createMessage && (
                <div className={`p-3 rounded-xl text-sm ${createStatus === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                  {createMessage}
                </div>
              )}
              <button
                id="create-bill-btn"
                type="submit"
                disabled={createStatus === 'loading'}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {createStatus === 'loading' ? 'Creating...' : 'Create Bill'}
              </button>
            </form>
          </div>
        )}

        {/* Review Payments Tab */}
        {activeTab === 'review' && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Review Payments</h2>
              <button onClick={fetchData} className="text-xs text-indigo-400 hover:text-indigo-300 transition-all">↻ Refresh</button>
            </div>

            {payments.length === 0 ? (
              <div className="glass-card p-10 text-center">
                <div className="text-5xl mb-3">📭</div>
                <p className="text-white font-semibold">No payments yet</p>
                <p className="text-slate-500 text-sm mt-1">Tenant submissions will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className={`glass-card p-4 border transition-all ${payment.status === 'pending' ? 'border-yellow-500/15' : payment.status === 'approved' ? 'border-green-500/15' : 'border-red-500/15'}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white text-sm">{payment.tenant_name}</span>
                          <span className="text-slate-600 text-xs">·</span>
                          <span className="text-slate-400 text-xs truncate">{payment.bill_title}</span>
                        </div>
                        <p className="text-slate-500 text-xs mt-1 font-mono">Ref: {payment.reference_number}</p>
                        <p className="text-slate-600 text-xs mt-0.5">
                          {new Date(payment.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold text-white">₱{parseFloat(payment.per_person_amount).toFixed(2)}</div>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 badge-${payment.status}`}>
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    {/* Receipt Image Thumbnail */}
                    {payment.receipt_image ? (
                      <button
                        onClick={() => setViewingImage(payment.receipt_image!)}
                        className="w-full mb-3 rounded-xl overflow-hidden border border-white/10 hover:border-indigo-500/50 transition-all group relative"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={payment.receipt_image}
                          alt="Receipt"
                          className="w-full h-32 object-cover object-top group-hover:opacity-80 transition-opacity"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                          <span className="text-white text-xs font-semibold bg-black/60 px-3 py-1.5 rounded-full">🔍 View Full Receipt</span>
                        </div>
                      </button>
                    ) : (
                      <div className="w-full mb-3 rounded-xl border border-white/5 bg-white/3 h-16 flex items-center justify-center text-slate-600 text-xs">
                        No receipt image
                      </div>
                    )}

                    {payment.status === 'pending' && (
                      <div className="flex gap-2 pt-2 border-t border-white/5">
                        <button
                          id={`approve-${payment.id}`}
                          onClick={() => handleAction(payment.id, 'approved')}
                          disabled={actionStates[payment.id] === 'loading'}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30 transition-all disabled:opacity-50"
                        >
                          {actionStates[payment.id] === 'loading' ? '...' : '✓ Approve'}
                        </button>
                        <button
                          id={`reject-${payment.id}`}
                          onClick={() => handleAction(payment.id, 'rejected')}
                          disabled={actionStates[payment.id] === 'loading'}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
                        >
                          ✗ Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Bill Status Overview</h2>
              <button onClick={fetchData} className="text-xs text-indigo-400 hover:text-indigo-300 transition-all">↻ Refresh</button>
            </div>

            {overview.length === 0 ? (
              <div className="glass-card p-10 text-center">
                <div className="text-5xl mb-3">📝</div>
                <p className="text-white font-semibold">No active bills</p>
                <p className="text-slate-500 text-sm mt-1">Create a bill to get started.</p>
              </div>
            ) : (
              overview.map((bill) => {
                const approvedCount = bill.tenants.filter((t) => t.payment_status === 'approved').length;
                const pendingCount = bill.tenants.filter((t) => t.payment_status === 'pending').length;
                const unpaidCount = bill.tenants.filter((t) => t.payment_status === 'unpaid').length;
                const progressPct = Math.round((approvedCount / 7) * 100);

                return (
                  <div key={bill.id} className="glass-card-bright p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-white text-base">{bill.title}</h3>
                        <p className="text-slate-500 text-xs mt-0.5">
                          Due: {new Date(bill.due_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold text-white">₱{parseFloat(bill.total_amount).toFixed(2)}</div>
                        <div className="text-xs text-slate-500">total · ₱{parseFloat(bill.per_person_amount).toFixed(2)}/person</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                        <span>{approvedCount}/7 paid</span>
                        <span>{progressPct}%</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-green-500 rounded-full transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <div className="flex gap-3 mt-2 text-xs">
                        <span className="text-green-400">{approvedCount} approved</span>
                        <span className="text-yellow-400">{pendingCount} pending</span>
                        <span className="text-slate-500">{unpaidCount} unpaid</span>
                      </div>
                    </div>

                    {/* Tenant grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {bill.tenants.map((tenant) => (
                        <div
                          key={tenant.id}
                          className={`rounded-xl p-2.5 text-center text-xs border transition-all
                            ${tenant.payment_status === 'approved' ? 'bg-green-500/10 border-green-500/30 text-green-300' :
                              tenant.payment_status === 'pending' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' :
                              'bg-white/3 border-white/8 text-slate-500'}`}
                        >
                          <div className="font-medium truncate">{tenant.name.split(' ')[0]}</div>
                          <div className="mt-0.5 opacity-80 capitalize">{tenant.payment_status}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        <footer className="text-center pb-6 pt-2">
          <p className="text-slate-600 text-xs">ApartmentBills Admin · Secured by PIN</p>
        </footer>
      </div>
    </main>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={
      <div className="bg-animated min-h-screen flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}
