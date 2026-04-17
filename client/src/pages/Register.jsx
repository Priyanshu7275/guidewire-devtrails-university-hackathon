import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Shield, CheckCircle, ArrowRight, Zap,
  Clock, TrendingUp, Lock, Smartphone, CreditCard, X, Check, Award
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { registerWorker, createPolicy, createPaymentOrder, verifyPayment } from '../services/api.js'
import toast from 'react-hot-toast'

const PLATFORMS = ['Swiggy', 'Zomato', 'Zepto', 'Blinkit', 'Amazon', 'Dunzo', 'Other']
const VEHICLES  = ['Bike', 'Scooter', 'Cycle', 'On Foot', 'Car']

const planTheme = {
  basic:    { gradient: 'from-slate-600 to-slate-800',       badge: 'Affordable',  recommended: false },
  standard: { gradient: 'from-[#082B6B] to-[#0B3B8C]',      badge: 'Recommended', recommended: true  },
  premium:  { gradient: 'from-violet-700 to-purple-800',     badge: 'Best Cover',  recommended: false },
}

const planBenefits = {
  basic:    ['Rs.500 coverage cap', '10 hrs/week protected', 'All 5 trigger types', 'UPI payout in 90s'],
  standard: ['Rs.900 coverage cap', '18 hrs/week protected', 'All 5 trigger types', 'Priority processing', 'Loyalty discount eligible'],
  premium:  ['Rs.1,400 coverage cap', '28 hrs/week protected', 'All 5 trigger types', 'Highest ROI on risk zones', 'Max loyalty discount'],
}

const planWhyBest = {
  standard: [
    'Covers up to 18 hours/week — enough for 3 disrupted workdays',
    'Rs.900 cap = ~1.5 days of earnings fully replaced',
    'Lowest cost-per-hour of protection vs. Basic',
    '80% of GigInsure workers choose Standard',
    'Qualifies for loyalty discounts after 3 months',
  ],
}

/* ── Payment Modal ─────────────────────────────────────────────────── */
function PaymentModal({ plan, amount, workerId, planData, onSuccess, onClose }) {
  const [method,     setMethod]     = useState('upi')
  const [upiId,      setUpiId]      = useState('')
  const [processing, setProcessing] = useState(false)
  const [stage,      setStage]      = useState('form')   // form | processing | success
  const [txnId,      setTxnId]      = useState('')
  const [error,      setError]      = useState(null)

  async function handlePay() {
    if (method === 'upi' && !upiId.includes('@')) {
      setError('Enter a valid UPI ID (e.g. name@upi or 9876543210@paytm)')
      return
    }
    setError(null)
    setProcessing(true)
    setStage('processing')
    try {
      const orderRes = await createPaymentOrder({ worker_id: workerId, plan, amount })
      const orderId  = orderRes.data.order_id
      await new Promise(r => setTimeout(r, 1500))
      const verifyRes = await verifyPayment({
        worker_id:  workerId,
        order_id:   orderId,
        payment_id: `pay_demo_${Date.now()}`,
        upi_id:     upiId || null,
        amount,
      })
      setTxnId(verifyRes.data.transaction_id)
      setStage('success')
    } catch (err) {
      setError(err.response?.data?.error || 'Payment failed. Please try again.')
      setStage('form')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 text-white" style={{ background: 'linear-gradient(135deg,#082B6B,#1A5CB4)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Shield size={16} className="text-blue-200" />
              </div>
              <span className="text-white font-bold text-sm">GigInsure</span>
            </div>
            <button onClick={onClose}
              className="w-7 h-7 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <X size={14} />
            </button>
          </div>
          <p className="text-white/60 text-xs mb-1">Pay for {plan.charAt(0).toUpperCase() + plan.slice(1)} Shield</p>
          <div className="flex items-baseline gap-1">
            <span className="text-white text-sm">₹</span>
            <span className="text-3xl font-bold text-white num">{amount}</span>
            <span className="text-white/50 text-xs">/week</span>
          </div>
        </div>

        {stage === 'success' ? (
          <div className="px-6 py-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={30} className="text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1.5">Payment Successful!</h3>
            <p className="text-slate-500 text-sm mb-4">Your {plan} Shield is now active.</p>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs text-left space-y-2 mb-5">
              {[
                ['Plan',          `${plan.charAt(0).toUpperCase()+plan.slice(1)} Shield`],
                ['Amount Paid',   `₹${amount}`],
                ['Coverage',      `₹${planData?.coverageCap}`],
                ['Transaction ID', txnId?.slice(0, 22) + '…'],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-slate-400">{l}</span>
                  <span className={`font-semibold ${l === 'Amount Paid' ? 'text-emerald-600' : 'text-slate-700'}`}>{v}</span>
                </div>
              ))}
            </div>
            <button onClick={onSuccess} className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2">
              Go to Dashboard <ArrowRight size={14} />
            </button>
          </div>

        ) : stage === 'processing' ? (
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-2 border-blue-200 border-t-navy rounded-full animate-spin" />
            </div>
            <p className="font-semibold text-slate-900 mb-1 text-sm">Processing Payment</p>
            <p className="text-slate-400 text-xs">Verifying your UPI transaction…</p>
          </div>

        ) : (
          <div className="px-6 py-5">
            {/* Method tabs */}
            <div className="flex gap-2 mb-5">
              {[
                { id: 'upi',  label: 'UPI',  icon: <Smartphone size={13} /> },
                { id: 'card', label: 'Card', icon: <CreditCard size={13} /> },
              ].map(m => (
                <button key={m.id} onClick={() => setMethod(m.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                    method === m.id
                      ? 'bg-navy text-white border-navy'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-navy hover:text-navy'
                  }`}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>

            {method === 'upi' ? (
              <div>
                <label className="label">UPI ID</label>
                <input type="text" className="input text-sm"
                  placeholder="yourname@upi or 9876543210@paytm"
                  value={upiId} onChange={e => setUpiId(e.target.value)} />
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {['PhonePe', 'GPay', 'Paytm', 'BHIM'].map(app => (
                    <button key={app} onClick={() => setUpiId(`demo@${app.toLowerCase()}`)}
                      className="text-2xs bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-navy px-2 py-1 rounded-lg transition-colors font-medium">
                      {app}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">Card Number</label>
                  <input type="text" className="input text-sm" readOnly defaultValue="4242 4242 4242 4242" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Expiry</label>
                    <input type="text" className="input text-sm" defaultValue="12/28" readOnly /></div>
                  <div><label className="label">CVV</label>
                    <input type="text" className="input text-sm" defaultValue="•••" readOnly /></div>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-3 text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg border border-rose-200">{error}</p>
            )}

            <button onClick={handlePay} disabled={processing}
              className="btn-primary w-full py-3.5 text-sm mt-4 flex items-center justify-center gap-2">
              <Lock size={14} /> Pay ₹{amount} Securely
            </button>

            <div className="flex items-center justify-center gap-2 mt-3 text-2xs text-slate-400">
              <Lock size={10} />
              <span>256-bit SSL Encrypted</span>
              <span>·</span>
              <span>Sandbox / Demo Mode</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Progress indicator ───────────────────────────────────────────── */
function ProgressBar({ step }) {
  return (
    <div className="flex items-center gap-2">
      {[['1','Your Details'],['2','Choose Plan'],['3','Pay']].map(([n, lbl], i) => {
        const isActive = Number(n) === step
        const isDone   = Number(n) < step
        return (
          <React.Fragment key={n}>
            <div className="flex items-center gap-1.5">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isDone   ? 'bg-emerald-500 text-white'
                : isActive ? 'bg-navy text-white'
                : 'bg-slate-200 text-slate-400'
              }`}>
                {isDone ? <Check size={12} /> : n}
              </span>
              <span className={`text-xs font-medium hidden sm:inline ${isActive ? 'text-slate-700' : 'text-slate-400'}`}>{lbl}</span>
            </div>
            {i < 2 && <div className={`flex-1 h-0.5 rounded ${isDone ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
          </React.Fragment>
        )
      })}
    </div>
  )
}

/* ── Main Register Component ──────────────────────────────────────── */
export default function Register() {
  const { login }  = useAuth()
  const navigate   = useNavigate()

  const [form, setForm] = useState({
    name: '', phone: '', password: '', platform: 'Swiggy',
    pincode: '', city: '', vehicle: 'Bike', daily_income: '',
  })
  const [step,           setStep]           = useState(1)
  const [plans,          setPlans]          = useState(null)
  const [registeredData, setRegisteredData] = useState(null)
  const [selectedPlan,   setSelectedPlan]   = useState(null)
  const [showPayment,    setShowPayment]    = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [loading2,       setLoading2]       = useState(false)
  const [error,          setError]          = useState(null)

  function handleChange(e) { setForm(prev => ({ ...prev, [e.target.name]: e.target.value })) }

  async function handleRegister(e) {
    e.preventDefault()
    setError(null)
    if (form.phone.trim().length < 10)                 { setError('Enter a valid 10-digit phone number.'); return }
    if (form.password.length < 6)                      { setError('Password must be at least 6 characters.'); return }
    if (!form.pincode || isNaN(form.pincode))           { setError('Enter a valid 6-digit pincode.'); return }
    if (!form.daily_income || isNaN(form.daily_income)){ setError('Enter your average daily income.'); return }

    setLoading(true)
    try {
      const payload = { ...form, pincode: String(form.pincode).trim(), daily_income: Number(form.daily_income) }
      const res     = await registerWorker(payload)
      setRegisteredData(res.data)
      setPlans(res.data.plans)
      // CRITICAL: save token BEFORE plan selection so createPolicy auth works
      localStorage.setItem('giginsure_token', res.data.token)
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleChoosePlan(planName) {
    setSelectedPlan(planName)
    setShowPayment(true)
  }

  async function handlePaymentSuccess() {
    setShowPayment(false)
    setLoading2(true)
    setError(null)
    try {
      await createPolicy({
        worker_id:    registeredData.workerId,
        plan:         selectedPlan,
        premium_paid: plans[selectedPlan].finalPremium,
      })
      login(registeredData, registeredData.token)
      toast.success('Policy activated! Welcome to GigInsure')
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Could not activate policy. Please try again.')
    } finally {
      setLoading2(false)
    }
  }

  /* ── Step 1: Registration Form ────────────────────────────────── */
  if (step === 1) {
    return (
      <div className="min-h-screen flex">

        {/* Left decorative panel */}
        <div className="hidden lg:flex lg:w-[42%] flex-col justify-between p-12 relative overflow-hidden"
          style={{ background: 'linear-gradient(145deg,#082B6B 0%,#0B3B8C 55%,#1A5CB4 100%)' }}>

          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-16 right-8   w-64 h-64 rounded-full blur-3xl" style={{ background: 'rgba(26,92,180,.2)' }} />
            <div className="absolute bottom-16 left-8 w-72 h-72 rounded-full blur-3xl" style={{ background: 'rgba(11,59,140,.15)' }} />
          </div>

          <Link to="/" className="relative flex items-center gap-2.5 focus-visible:ring-2 focus-visible:ring-white rounded-lg">
            <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
              <Shield size={18} className="text-blue-300" />
            </div>
            <span className="text-white font-bold text-lg">GigInsure</span>
          </Link>

          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1.5 rounded-full text-xs text-white/80 mb-5">
              <Zap size={11} className="text-yellow-400" />
              Smart risk scoring · Your price, not a flat rate
            </div>
            <h2 className="text-3xl font-bold text-white leading-tight mb-3">
              Join 50,000+<br />protected gig workers
            </h2>
            <p className="text-white/60 text-sm leading-relaxed mb-7">
              Tell us your zone and platform. Our system analyses the actual risk
              level and calculates your personalised weekly premium.
            </p>

            {/* Stat grid */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[['Rs.35', 'Starting from'], ['<90s', 'Payout speed'], ['5', 'Triggers covered'], ['0', 'Paperwork']].map(([v, l]) => (
                <div key={l} className="bg-white/10 rounded-xl p-3.5 border border-white/10">
                  <p className="text-xl font-bold text-white num">{v}</p>
                  <p className="text-2xs text-white/50 mt-0.5 font-medium">{l}</p>
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <div className="bg-white/10 border border-white/15 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex gap-1 mb-2">
                {[1,2,3,4,5].map(i => <div key={i} className="w-2.5 h-2.5 rounded-sm bg-yellow-400" />)}
              </div>
              <p className="text-white/80 text-xs leading-relaxed italic mb-3">
                "Standard Shield is only Rs.45/week — that's the best money I spend all week."
              </p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-navy-light rounded-full flex items-center justify-center text-white font-bold text-xs">AS</div>
                <div>
                  <p className="text-white text-xs font-semibold">Arjun Singh</p>
                  <p className="text-white/40 text-2xs">Blinkit Rider · Mumbai</p>
                </div>
              </div>
            </div>
          </div>

          <p className="relative text-white/30 text-xs">GigInsure · DEVTrails 2026 · Guidewire Challenge</p>
        </div>

        {/* Right form */}
        <div className="w-full lg:w-[58%] bg-surface flex items-start justify-center px-6 py-10 overflow-y-auto">
          <div className="w-full max-w-lg">

            {/* Mobile brand */}
            <div className="lg:hidden flex items-center gap-2 mb-8">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-navy">
                <Shield size={16} className="text-white" />
              </div>
              <span className="font-bold text-lg text-navy">GigInsure</span>
            </div>

            {/* Progress */}
            <div className="mb-6"><ProgressBar step={1} /></div>

            <h1 className="text-2xl font-bold text-slate-900 mb-1.5">Create Your Account</h1>
            <p className="text-slate-400 text-sm mb-6">Tell us about yourself to get your personalised premium.</p>

            {error && (
              <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-xl mb-5">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input name="name" className="input" placeholder="Priyanshu Ranjan"
                  value={form.name} onChange={handleChange} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Phone Number</label>
                  <input name="phone" type="tel" className="input" placeholder="9876543210"
                    value={form.phone} onChange={handleChange} required autoComplete="tel" />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input name="password" type="password" className="input" placeholder="Min. 6 characters"
                    value={form.password} onChange={handleChange} required autoComplete="new-password" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Delivery Platform</label>
                  <select name="platform" className="select" value={form.platform} onChange={handleChange}>
                    {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Vehicle</label>
                  <select name="vehicle" className="select" value={form.vehicle} onChange={handleChange}>
                    {VEHICLES.map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Pincode</label>
                  <input name="pincode" type="number" className="input" placeholder="110001"
                    value={form.pincode} onChange={handleChange} required />
                </div>
                <div>
                  <label className="label">City</label>
                  <input name="city" className="input" placeholder="Delhi"
                    value={form.city} onChange={handleChange} required />
                </div>
              </div>

              <div>
                <label className="label">Average Daily Income (₹)</label>
                <input name="daily_income" type="number" className="input" placeholder="600"
                  value={form.daily_income} onChange={handleChange} required />
                <p className="text-2xs text-slate-400 mt-1.5">Used to calculate your exact payout amount per disruption day.</p>
              </div>

              <button type="submit" disabled={loading}
                className="btn-primary w-full py-3 text-sm mt-1 flex items-center justify-center gap-2">
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Calculating Your Risk Score…</>
                  : <>Continue to Plan Selection <ArrowRight size={15} /></>}
              </button>
            </form>

            <p className="text-center text-slate-400 text-xs mt-5">
              Already registered?{' '}
              <Link to="/login" className="text-navy font-semibold hover:text-navy-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy rounded">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  /* ── Step 2: Plan Selection ─────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-surface">

      {/* Top bar */}
      <div className="text-white py-3.5 px-6 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg,#082B6B,#0B3B8C)' }}>
        <Link to="/" className="inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-white rounded">
          <Shield size={16} className="text-blue-300" />
          <span className="font-bold text-sm">GigInsure</span>
        </Link>
        <div className="max-w-xs w-full"><ProgressBar step={2} /></div>
        <div className="w-24" />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* Welcome header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={28} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1.5">
            Welcome, {registeredData?.name?.split(' ')[0]}!
          </h2>
          <p className="text-slate-500 text-sm">
            Your zone risk score is{' '}
            <span className="font-bold text-navy text-base num">{registeredData?.zoneRiskScore}</span>/100.
            Choose the plan that fits you best.
          </p>
        </div>

        {/* Why Standard callout */}
        {plans?.standard && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-7">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-navy">
                <Award size={16} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-navy text-sm">Why Standard Shield is Recommended for You</p>
                <p className="text-xs text-slate-500">Based on your zone risk score of {registeredData?.zoneRiskScore}/100</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {planWhyBest.standard.map((r, i) => (
                <div key={i} className="flex items-start gap-2 bg-white/80 rounded-lg px-3 py-2 border border-blue-100">
                  <CheckCircle size={13} className="text-navy flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-700">{r}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-navy font-medium bg-white/70 rounded-lg px-3 py-2 border border-blue-200">
              <Zap size={11} className="inline mr-1 text-amber-500" />
              With a daily income of Rs.{registeredData?.dailyIncome}, Standard Shield covers roughly <strong>1.5 days</strong> of lost earnings per week.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-xl mb-5 max-w-sm mx-auto text-center">
            {error}
          </div>
        )}

        {/* Plan Cards */}
        <div className="grid sm:grid-cols-3 gap-5">
          {plans && Object.entries(plans).map(([planName, planData]) => {
            const theme = planTheme[planName] || {}
            return (
              <div key={planName}
                className={`bg-white rounded-xl overflow-hidden shadow-card border-2 transition-all hover:-translate-y-0.5 hover:shadow-lg
                  ${theme.recommended ? 'border-navy shadow-navy/10 scale-[1.02]' : 'border-slate-100'}`}>

                {/* Card header gradient */}
                <div className={`bg-gradient-to-br ${theme.gradient} px-5 py-4 text-white`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-2xs font-bold uppercase tracking-widest text-white/60">{theme.badge}</p>
                    {theme.recommended && (
                      <span className="text-2xs font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">
                        Best Pick
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-bold capitalize">{planName} Shield</p>
                </div>

                <div className="px-5 py-4">
                  {/* Price */}
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-slate-400 text-sm">₹</span>
                    <span className="text-3xl font-bold text-slate-900 num">{planData.finalPremium}</span>
                    <span className="text-slate-400 text-xs">/week</span>
                  </div>

                  {/* Benefits */}
                  <ul className="space-y-2 mb-4">
                    {planBenefits[planName].map(b => (
                      <li key={b} className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle size={12} className="text-emerald-500 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>

                  {/* Breakdown */}
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-1 mb-4 text-xs">
                    {[
                      ['Coverage Cap',   `₹${planData.coverageCap}`],
                      ['Zone Risk Adj.', `+₹${planData.riskAdj}`],
                      ['Season Factor',  `×${planData.seasonFactor}`],
                      ['Max Hours',      `${planData.maxHours} hrs`],
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between">
                        <span className="text-slate-400">{l}</span>
                        <span className="font-semibold text-slate-700">{v}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleChoosePlan(planName)}
                    disabled={loading2}
                    className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl transition-all text-xs
                      ${theme.recommended
                        ? 'btn-primary'
                        : 'border-2 border-slate-200 text-slate-700 hover:border-navy hover:text-navy bg-white'}
                      disabled:opacity-50 disabled:cursor-not-allowed`}>
                    {loading2 && selectedPlan === planName
                      ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Activating…</>
                      : <><Zap size={12} /> Choose {planName.charAt(0).toUpperCase() + planName.slice(1)}</>}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Trust row */}
        <div className="flex flex-wrap items-center justify-center gap-5 mt-8 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><Lock size={12} /> SSL Secured</span>
          <span className="flex items-center gap-1.5"><Clock size={12} /> Coverage starts instantly</span>
          <span className="flex items-center gap-1.5"><TrendingUp size={12} /> Cancel anytime</span>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && selectedPlan && (
        <PaymentModal
          plan={selectedPlan}
          amount={plans[selectedPlan]?.finalPremium}
          workerId={registeredData?.workerId}
          planData={plans[selectedPlan]}
          onSuccess={handlePaymentSuccess}
          onClose={() => { setShowPayment(false); setSelectedPlan(null) }}
        />
      )}
    </div>
  )
}
