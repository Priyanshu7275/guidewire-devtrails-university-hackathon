import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield, Zap, IndianRupee, CloudRain, Thermometer, Wind,
  CheckCircle, ArrowRight, BrainCircuit, Clock, TrendingUp,
  Phone, ChevronDown, ChevronUp, Users, Award, Lock, Wifi,
  ShieldCheck, Smartphone, BarChart2, Search, Check, X as XIcon,
  MapPin, Activity
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'

/* ── Colour constants ──────────────────────────────────────────────── */
const HERO_BG  = 'linear-gradient(150deg, #082B6B 0%, #0B3B8C 55%, #1A5CB4 100%)'
const DARK_BG  = 'linear-gradient(150deg, #082B6B 0%, #0B3B8C 100%)'
const CTA_BG   = 'linear-gradient(150deg, #082B6B 0%, #1A5CB4 100%)'
const NAVY_BG  = '#0B3B8C'

/* ── Data ──────────────────────────────────────────────────────────── */
const TRIGGERS = [
  { icon: CloudRain,   label: 'Heavy Rain',      color: 'bg-blue-500/15  text-blue-200  border-blue-400/30'   },
  { icon: Thermometer, label: 'Extreme Heat',    color: 'bg-amber-500/15 text-amber-200 border-amber-400/30'  },
  { icon: Wind,        label: 'Dangerous AQI',   color: 'bg-sky-500/15   text-sky-200   border-sky-400/30'    },
  { icon: Shield,      label: 'Curfew / Strike', color: 'bg-rose-500/15  text-rose-200  border-rose-400/30'   },
  { icon: Zap,         label: 'App Outage',      color: 'bg-yellow-500/15 text-yellow-200 border-yellow-400/30' },
]

const FEATURES = [
  {
    icon: BrainCircuit, bg: 'bg-blue-100', iconColor: 'text-blue-700',
    title: 'Smart Risk Scoring',
    desc:  'XGBoost ML analyses your zone — rain history, AQI trends, flood records — and sets your exact premium. Safer zones always pay less.',
  },
  {
    icon: Zap,          bg: 'bg-amber-100', iconColor: 'text-amber-600',
    title: 'Zero-Touch Claims',
    desc:  'Live weather and AQI APIs monitor your zone 24/7. Disruptions are detected and claims filed automatically — no paperwork ever.',
  },
  {
    icon: IndianRupee,  bg: 'bg-emerald-100', iconColor: 'text-emerald-600',
    title: '90-Second Payouts',
    desc:  'Approved payouts hit your UPI in under 90 seconds. No waiting, no calls, no rejection letters — guaranteed.',
  },
  {
    icon: Lock,         bg: 'bg-violet-100', iconColor: 'text-violet-600',
    title: 'Transparent Audit Trail',
    desc:  'Every claim decision is recorded with a full audit trail. You can see exactly why a payout was approved or flagged.',
  },
]

const STEPS = [
  { n: '01', icon: Phone,         title: 'Register in 60s',    desc: 'Phone number, platform, and pincode. No documents needed.' },
  { n: '02', icon: Shield,        title: 'Pick Your Shield',   desc: 'Your premium is priced from your zone\'s actual risk — not a flat rate.' },
  { n: '03', icon: Wifi,          title: 'Stay Covered',       desc: 'We watch rain, heat, AQI, curfews and outages for you — hands-free.' },
  { n: '04', icon: IndianRupee,   title: 'Get Paid Instantly', desc: 'Disruption hits? Money lands in your UPI in 90 seconds.' },
]

const PLANS = [
  {
    name: 'Basic',    price: '25–35', cap: '500',   hours: '10',
    border: 'border-slate-200', popular: false,
    btnClass: 'border border-slate-300 text-slate-700 hover:border-navy hover:text-navy',
  },
  {
    name: 'Standard', price: '40–50', cap: '900',   hours: '18',
    border: 'border-navy',      popular: true,
    btnClass: 'bg-navy text-white hover:bg-navy-dark',
  },
  {
    name: 'Premium',  price: '60–75', cap: '1,400', hours: '28',
    border: 'border-slate-200', popular: false,
    btnClass: 'border border-violet-300 text-violet-700 hover:bg-violet-600 hover:text-white',
  },
]

const TESTIMONIALS = [
  {
    name: 'Raju Kumar',   platform: 'Swiggy Partner · Delhi',    avatar: 'RK', color: 'bg-orange-500',
    text: 'Last monsoon I couldn\'t deliver for 3 days. GigInsure paid me Rs.850 in my PhonePe within minutes. I didn\'t even have to call anyone — it just happened.',
  },
  {
    name: 'Meena Devi',   platform: 'Zomato Partner · Bengaluru', avatar: 'MD', color: 'bg-rose-500',
    text: 'When AQI hit danger levels during Diwali, my payout was already processed. Rs.780 for 2 lost days. This is better than anything my company offers.',
  },
  {
    name: 'Arjun Singh',  platform: 'Blinkit Rider · Mumbai',    avatar: 'AS', color: 'bg-blue-600',
    text: 'During the platform outage last February I lost a full day. GigInsure paid Rs.600. Standard Shield is only Rs.45/week — best money I spend all week.',
  },
]

const FAQS = [
  { q: 'How does GigInsure know there was a disruption?',
    a: 'Our system pulls real-time data from weather APIs, government AQI monitors, and app status trackers every 10 minutes. When a threshold is crossed in your pincode, your claim is automatically initiated.' },
  { q: 'Do I need to file a claim manually?',
    a: 'Usually no. When a monitored disruption hits your zone, claims are auto-filed. You can also manually file if you experienced a disruption not yet auto-detected.' },
  { q: 'How fast is the payout?',
    a: 'Auto-approved payouts reach your UPI in under 90 seconds. Manual review cases are resolved within 4 hours.' },
  { q: 'Is there a waiting period before coverage starts?',
    a: 'Coverage starts the moment your payment is confirmed. There is no waiting period.' },
  { q: 'Can I change my plan later?',
    a: 'Yes. After your current policy expires, you can choose any plan when you renew.' },
]

/* Comparison table data */
const COMPARISON = [
  { feature: 'Payout speed',            gigInsure: 'Under 90 seconds', traditional: '30 – 60 days' },
  { feature: 'Documentation required',  gigInsure: 'None',             traditional: 'Extensive forms' },
  { feature: 'Claim detection',         gigInsure: 'Fully automatic',  traditional: 'Manual filing' },
  { feature: 'Coverage start',          gigInsure: 'Instant',          traditional: 'After waiting period' },
  { feature: 'Pricing model',           gigInsure: 'Zone ML-priced',   traditional: 'Flat rate' },
  { feature: 'Claim approval rate',     gigInsure: '95%+',             traditional: '~55%' },
]

/* ── Sub-components ────────────────────────────────────────────────── */
function FAQ({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy rounded-lg">
        <span className="font-semibold text-slate-800 group-hover:text-navy transition-colors pr-4 text-sm">{q}</span>
        <span className="flex-shrink-0 text-slate-400 group-hover:text-navy transition-colors">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      {open && <p className="text-slate-500 pb-5 leading-relaxed text-sm">{a}</p>}
    </div>
  )
}

function QuoteWidget() {
  const [income, setIncome] = useState('')
  const estimate = (() => {
    const n = parseInt(income)
    if (!n || n < 100) return null
    if (n < 700)  return { from: 25, to: 35 }
    if (n < 1000) return { from: 40, to: 50 }
    return { from: 60, to: 75 }
  })()

  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5">
      <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-4">Estimate Your Premium</p>

      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-white/60 text-xs mb-1.5">Daily earning (Rs.)</label>
          <input
            type="number"
            placeholder="e.g. 800"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
          />
        </div>
      </div>

      {estimate ? (
        <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-xl p-3.5 mb-4">
          <p className="text-emerald-300 text-xs font-semibold mb-0.5">Estimated weekly premium</p>
          <p className="text-white font-bold text-2xl">Rs.{estimate.from} – Rs.{estimate.to}</p>
          <p className="text-white/50 text-xs mt-0.5">Exact price calculated at checkout</p>
        </div>
      ) : (
        <div className="bg-white/5 rounded-xl p-3.5 mb-4 text-center">
          <p className="text-white/40 text-xs">Enter your daily earning to see an estimate</p>
        </div>
      )}

    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────────────── */
export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: HERO_BG }}>
        {/* Decorative blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(26,92,180,.18)' }} />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full blur-3xl"  style={{ background: 'rgba(11,59,140,.15)' }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left — copy */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs font-medium text-white/80 mb-6">
                <Activity size={11} className="text-blue-300" />
                Parametric Income Insurance · DEVTrails 2026
              </div>

              <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-[1.08] tracking-tight mb-5">
                Earn Without Fear.
                <br />
                <span className="text-blue-200">
                  Income Always Protected.
                </span>
              </h1>

              <p className="text-base text-white/70 mb-7 leading-relaxed max-w-lg">
                When rain, heat, or an app crash stops you from delivering —
                GigInsure auto-detects the disruption and puts money in your UPI
                <strong className="text-white"> within 90 seconds.</strong>
                {' '}Starting from{' '}
                <strong className="text-blue-200">Rs.35/week.</strong>
              </p>

              {/* Trigger pills */}
              <div className="flex flex-wrap gap-2 mb-8">
                {TRIGGERS.map(({ icon: Icon, label, color }) => (
                  <span key={label}
                    className={`inline-flex items-center gap-1.5 border px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${color}`}>
                    <Icon size={11} />
                    {label}
                  </span>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/register"
                  className="inline-flex items-center justify-center gap-2 bg-white text-navy font-bold text-sm px-7 py-3.5 rounded-xl hover:bg-blue-50 transition-all shadow-2xl shadow-black/20 hover:-translate-y-0.5">
                  Get Protected Now <ArrowRight size={16} />
                </Link>
                <Link to="/login"
                  className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/25 text-white font-semibold text-sm px-7 py-3.5 rounded-xl hover:bg-white/20 transition-all backdrop-blur-sm">
                  Sign In to Dashboard
                </Link>
              </div>
            </div>

            {/* Right — hero image + quote widget */}
            <div className="hidden lg:flex flex-col gap-5 items-center">
              {/* Hero image */}
              <div className="relative w-full">
                <div className="absolute inset-0 rounded-2xl"
                  style={{ background: 'linear-gradient(180deg,transparent 60%,rgba(8,43,107,.7) 100%)' }} />
                <img
                  src="/happy-rider.webp"
                  alt="Delivery partner on the road"
                  className="w-full h-64 object-cover rounded-2xl shadow-2xl shadow-black/30 border border-white/10"
                  loading="eager"
                />
                {/* Floating payout badge */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 bg-white/15 backdrop-blur-md border border-white/20 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <IndianRupee size={15} className="text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-white text-xs font-bold">Rs.780 paid out</p>
                    <p className="text-white/50 text-2xs">AQI trigger · 87 seconds ago</p>
                  </div>
                  <span className="ml-auto text-2xs font-bold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-400/25">
                    Auto
                  </span>
                </div>
              </div>
              <QuoteWidget />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────────────────── */}
      <section style={{ background: NAVY_BG }}>
        <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-2 sm:grid-cols-5 gap-y-4">
          {[
            { v: '11M+', l: 'Gig workers in India',   icon: Users },
            { v: '5',    l: 'Disruptions monitored',   icon: Shield },
            { v: '<90s', l: 'Payout speed',            icon: Clock },
            { v: 'Rs.35', l: 'Starting premium/week',  icon: IndianRupee },
            { v: '0',    l: 'Paperwork required',      icon: CheckCircle },
          ].map(({ v, l, icon: Icon }) => (
            <div key={l} className="text-center px-3">
              <div className="flex justify-center text-blue-300 mb-1.5"><Icon size={16} /></div>
              <p className="text-xl font-bold text-white num">{v}</p>
              <p className="text-2xs text-white/40 mt-0.5 font-medium">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── THE PROBLEM ───────────────────────────────────────────────── */}
      <section className="bg-white py-20 px-4">
        <div className="max-w-5xl mx-auto">

          {/* Split: copy + image */}
          <div className="grid lg:grid-cols-2 gap-10 items-center mb-16">
            <div>
              <div className="inline-flex items-center gap-2 bg-rose-50 text-rose-700 font-semibold text-xs px-4 py-2 rounded-full mb-4 border border-rose-100">
                <TrendingUp size={12} /> The Problem
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Every disruption costs you Rs.500–Rs.1,200 per day</h2>
              <p className="text-base text-slate-500 leading-relaxed">
                India's 11 million gig workers earn nothing when they can't deliver.
                No sick leave. No weather pay. No protection.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                {[
                  { label: 'Zero income on rainy days',       color: 'bg-blue-100 text-blue-700' },
                  { label: 'No compensation during heatwaves', color: 'bg-amber-100 text-amber-700' },
                  { label: 'Lost earnings on app outages',     color: 'bg-violet-100 text-violet-700' },
                ].map(({ label, color }) => (
                  <div key={label} className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg self-start ${color}`}>
                    <XIcon size={12} /> {label}
                  </div>
                ))}
              </div>
            </div>
            {/* Photo */}
            <div className="relative">
              <img
                src="/worker-heat.jpg"
                alt="Delivery rider in extreme heat"
                className="w-full h-72 object-cover rounded-2xl shadow-xl"
                loading="lazy"
              />
              <div className="absolute inset-0 rounded-2xl"
                style={{ background: 'linear-gradient(135deg,rgba(239,68,68,.08) 0%,transparent 60%)' }} />
              {/* Stat overlay */}
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg border border-rose-100">
                <p className="text-2xs font-semibold text-rose-600 uppercase tracking-widest">Average daily loss</p>
                <p className="text-2xl font-bold text-rose-600 num">Rs.850</p>
                <p className="text-2xs text-slate-400">per disruption day</p>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { icon: CloudRain,   title: '73 rainy days / year',    stat: 'avg. Delhi, Mumbai, Bengaluru', desc: 'Monsoon season forces thousands of delivery workers off the road with zero compensation.', bg: 'bg-blue-50 border-blue-100', iconCls: 'text-blue-600 bg-blue-100' },
              { icon: Thermometer, title: '50+ days above 43°C',     stat: 'across North India every summer', desc: 'Extreme heat creates genuine safety risks — but platforms still expect deliveries to continue.', bg: 'bg-amber-50 border-amber-100', iconCls: 'text-amber-600 bg-amber-100' },
              { icon: Smartphone,  title: 'App outages: 12× / year', stat: 'industry average', desc: 'Platform crashes wipe out hours of earning potential with no compensation from the company.', bg: 'bg-violet-50 border-violet-100', iconCls: 'text-violet-600 bg-violet-100' },
            ].map(({ icon: Icon, title, stat, desc, bg, iconCls }) => (
              <div key={title} className={`rounded-xl p-6 border ${bg}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${iconCls}`}>
                  <Icon size={20} />
                </div>
                <p className="text-lg font-bold text-slate-900 mb-0.5">{title}</p>
                <p className="text-2xs text-slate-400 font-medium mb-2.5">{stat}</p>
                <p className="text-slate-600 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────── */}
      <section className="bg-surface py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-navy font-semibold text-xs px-4 py-2 rounded-full mb-4 border border-blue-100">
              <ShieldCheck size={12} /> The Solution
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Built for Real Gig Work</h2>
            <p className="text-base text-slate-500 max-w-xl mx-auto">
              Every feature is designed around the actual problems delivery workers face every day.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, bg, iconColor, title, desc }) => (
              <div key={title}
                className="bg-white rounded-xl p-6 shadow-card hover:shadow-md transition-all hover:-translate-y-0.5 border border-slate-100">
                <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center mb-4 ${iconColor}`}>
                  <Icon size={22} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
      <section className="bg-white py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Get Covered in 3 Minutes</h2>
            <p className="text-base text-slate-500">From signup to payout — fully automated.</p>
          </div>
          <div className="grid sm:grid-cols-4 gap-6">
            {STEPS.map(({ n, icon: Icon, title, desc }, i) => (
              <div key={n} className="text-center relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden sm:block absolute top-6 left-[65%] right-0 h-0.5 bg-gradient-to-r from-blue-200 to-transparent" />
                )}
                <div className="relative w-12 h-12 text-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg"
                  style={{ background: DARK_BG, boxShadow: '0 4px 16px rgba(11,59,140,.3)' }}>
                  <Icon size={20} />
                </div>
                <p className="text-2xs font-bold text-navy/60 uppercase tracking-widest mb-1">{n}</p>
                <h4 className="text-sm font-bold text-slate-900 mb-1.5">{title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANS ─────────────────────────────────────────────────────── */}
      <section className="bg-surface py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Simple Weekly Plans</h2>
            <p className="text-base text-slate-500">Your exact price is calculated at checkout based on your zone's actual risk.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 items-start">
            {PLANS.map((p) => (
              <div key={p.name}
                className={`bg-white rounded-xl overflow-hidden border-2 ${p.border} transition-all hover:-translate-y-0.5 ${
                  p.popular ? 'shadow-xl shadow-navy/10 -mt-3' : 'shadow-card hover:shadow-md'
                }`}>
                {p.popular && (
                  <div className="text-white text-center py-2 text-2xs font-bold tracking-widest uppercase"
                    style={{ background: DARK_BG }}>
                    Most Popular
                  </div>
                )}
                <div className="p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{p.name}</h3>
                  <div className="flex items-baseline gap-1 mt-2 mb-5">
                    <span className="text-sm text-slate-400">Rs.</span>
                    <span className="text-3xl font-bold text-navy num">{p.price}</span>
                    <span className="text-slate-400 text-xs">/week</span>
                  </div>
                  <ul className="space-y-2.5 mb-6">
                    {[
                      `Rs.${p.cap} coverage cap`,
                      `${p.hours} hours covered/week`,
                      'All 5 trigger types',
                      'Instant UPI payout',
                      'Auto-claim detection',
                    ].map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-slate-600">
                        <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                        <span className="text-xs font-medium">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/register"
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-xs transition-all ${p.btnClass}`}>
                    Choose {p.name} <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ──────────────────────────────────────────── */}
      <section className="bg-white py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Why Not Traditional Insurance?</h2>
            <p className="text-base text-slate-500">Gig workers need speed. Traditional policies weren't built for the gig economy.</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-widest w-1/2">Feature</th>
                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-widest w-1/4" style={{ color: '#0B3B8C' }}>GigInsure</th>
                  <th className="px-5 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-widest w-1/4">Traditional Policy</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(({ feature, gigInsure, traditional }, i) => (
                  <tr key={feature} className={i % 2 === 0 ? 'bg-surface' : 'bg-white'}>
                    <td className="px-5 py-3.5 font-medium text-slate-700">{feature}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold text-xs">
                        <Check size={13} className="text-emerald-500" />{gigInsure}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1.5 text-slate-500 text-xs">
                        <XIcon size={13} className="text-rose-400" />{traditional}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── WHY PARAMETRIC ────────────────────────────────────────────── */}
      <section className="py-20 px-4" style={{ background: DARK_BG }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-2">Why Parametric Insurance</p>
            <h2 className="text-3xl font-bold text-white mb-3">Objective triggers. Instant payouts. No disputes.</h2>
            <p className="text-white/60 text-sm max-w-xl mx-auto">GigInsure is built on parametric principles — payouts based on verified data, not claims investigation.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { icon: Zap,      title: 'Objective triggers',  desc: 'Payouts fire when weather API or AQI breaches a threshold. No subjective assessment, no disputes.' },
              { icon: Activity, title: 'Fully automated',     desc: 'From detection to UPI transfer — zero human involvement required in the claims process.' },
              { icon: BarChart2,title: 'Risk-priced fairly',  desc: 'XGBoost ML scores your zone using 6 months of historical data. You pay exactly what your risk warrants.' },
              { icon: Search,   title: 'Full audit trail',    desc: 'Every decision is logged with reasoning. Fraud detection uses Isolation Forest with explainable signals.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white/10 border border-white/20 rounded-xl p-5 backdrop-blur-sm">
                <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center mb-3">
                  <Icon size={18} className="text-blue-200" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">{title}</h3>
                <p className="text-white/60 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────── */}
      <section className="bg-white py-20 px-4">
        <div className="max-w-5xl mx-auto">

          {/* Photo banner */}
          <div className="relative rounded-2xl overflow-hidden mb-14 shadow-xl">
            <img
              src="/gig-workers.png"
              alt="GigInsure delivery partners"
              className="w-full h-52 object-cover object-top"
              loading="lazy"
            />
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(90deg,rgba(8,43,107,.75) 0%,rgba(8,43,107,.3) 60%,transparent 100%)' }} />
            <div className="absolute inset-0 flex flex-col justify-center px-8 sm:px-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">Delivery Partners Love GigInsure</h2>
              <p className="text-white/70 text-sm">Real stories from the road.</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map(({ name, platform, avatar, color, text }) => (
              <div key={name}
                className="bg-surface rounded-xl p-6 border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-3 h-3 rounded-sm bg-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 leading-relaxed mb-5 text-sm">"{text}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 ${color} rounded-full flex items-center justify-center text-white font-bold text-xs`}>
                    {avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{name}</p>
                    <p className="text-2xs text-slate-400">{platform}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section id="faq" className="bg-surface py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900">Frequently Asked Questions</h2>
          </div>
          <div className="bg-white rounded-xl shadow-card border border-slate-100 px-6 py-1">
            {FAQS.map((f) => <FAQ key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* ── CTA BOTTOM ────────────────────────────────────────────────── */}
      <section className="py-20 px-4" style={{ background: CTA_BG }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-1.5 rounded-full text-xs font-medium text-white/80 mb-6">
            <Award size={12} className="text-yellow-400" /> Trusted by 50,000+ Delivery Partners
          </div>
          <h2 className="text-4xl font-extrabold text-white mb-3">Your income deserves protection.</h2>
          <p className="text-lg text-white/60 mb-9">Join thousands of delivery workers who earn with confidence — rain or shine.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register"
              className="inline-flex items-center justify-center gap-2 bg-white text-navy font-bold text-sm px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-all shadow-2xl hover:-translate-y-0.5">
              Get Protected Now <ArrowRight size={16} />
            </Link>
            <Link to="/login"
              className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/25 text-white font-semibold text-sm px-8 py-3.5 rounded-xl hover:bg-white/20 transition-all">
              Sign In to Dashboard
            </Link>
          </div>
          <p className="text-white/40 text-xs mt-5">From Rs.35/week · No paperwork · Cancel anytime</p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
