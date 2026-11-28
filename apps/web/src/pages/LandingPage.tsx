import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  CrownIcon,
  LockIcon,
  MenuIcon,
  MonitorIcon,
  MoonIcon,
  ShieldIcon,
  SparklesIcon,
  SunIcon,
  UsersIcon,
  VideoIcon,
} from '../components/Icons';
import { BentoFeatures } from '../components/landing/BentoFeatures';
import { BrandIntro } from '../components/landing/BrandIntro';
import { HeroShowcase } from '../components/landing/HeroShowcase';
import {
  LANDING_FAQS,
  OFFICIAL_LICENCE,
  SOCIAL_LINKS,
} from '../components/landing/landingConfig';
import { StickyJourney } from '../components/landing/StickyJourney';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import '../styles/landing.css';

interface LandingPageProps {
  backendConnected: boolean;
  healthLoading: boolean;
}

const NAV_ITEMS = [
  { href: '#top', label: 'Home' },
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#why-mymeet', label: 'Why MyMeet' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

const CAPABILITIES = [
  { label: 'HD Video Meetings', icon: VideoIcon },
  { label: 'Real-Time Collaboration', icon: UsersIcon },
  { label: 'AI-Powered Notes', icon: SparklesIcon },
  { label: 'Screen Sharing', icon: MonitorIcon },
  { label: 'Meeting Assessments', icon: CrownIcon },
  { label: 'Cross-Platform Access', icon: CalendarIcon },
];

const PROBLEM_CARDS = [
  {
    num: '01',
    title: 'Lost Information',
    copy: 'Important explanations, ideas, and decisions can fade as soon as the call disconnects.',
  },
  {
    num: '02',
    title: 'Manual Effort',
    copy: 'Typing notes while listening splits attention between understanding the speaker and documenting details.',
  },
  {
    num: '03',
    title: 'Limited Retention',
    copy: 'Attending a lecture or discussion does not automatically mean the concepts were understood and retained.',
  },
];

const TRUST_PILLARS = [
  {
    icon: LockIcon,
    title: 'Controlled Meeting Access',
    copy: 'Unique meeting codes, waiting rooms, and host admission controls ensure only invited participants enter your sessions.',
  },
  {
    icon: SparklesIcon,
    title: 'Responsible AI Note Handling',
    copy: 'AI Visual Notes and Master Notes are generated from session context only when enabled and stored with Row-Level Security.',
  },
  {
    icon: ShieldIcon,
    title: 'Verified Razorpay Checkout',
    copy: 'MyMeet never sees or stores card numbers, CVV, or UPI PINs. Every paid order is verified cryptographically via Razorpay.',
  },
  {
    icon: CheckIcon,
    title: 'Clear, Upfront Policies',
    copy: 'Prepaid plans with zero surprise auto-debits, published Terms, Privacy, and Refund policies, and direct human support.',
  },
];

export function LandingPage({ backendConnected, healthLoading }: LandingPageProps) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'yearly' | 'monthly'>('yearly');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Subtle IntersectionObserver reveal for sections
  useEffect(() => {
    const nodes = document.querySelectorAll('.lp-reveal');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((n) => n.classList.add('lp-in-view'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lp-in-view');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const statusTone = healthLoading ? 'warning' : backendConnected ? 'success' : 'danger';
  const statusTitle = healthLoading
    ? 'Checking MyMeet services'
    : backendConnected
      ? 'MyMeet services online'
      : 'Service status temporarily unavailable';

  const startDestination = user ? '/' : '/signup';
  const joinDestination = user ? '/' : '/login';

  return (
    <div id="top" className="lp-root">
      <BrandIntro />

      {/* 05. Floating Refined Navigation Bar */}
      <header className={`lp-nav-wrap ${scrolled ? 'lp-nav-scrolled' : ''}`}>
        <div className="lp-nav-inner">
          <div className="lp-nav-left">
            <a href="#top" className="lp-brand-link" aria-label="MyMeet Home">
              <BrandLogo size="sm" />
              <span
                className={`brand-status-dot dot-${statusTone}`}
                title={statusTitle}
                aria-label={statusTitle}
              />
            </a>
          </div>

          <nav className="lp-nav-center" aria-label="Primary landing navigation">
            {NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href} className="lp-nav-link">
                <span>{item.label}</span>
              </a>
            ))}
          </nav>

          <div className="lp-nav-right">
            <button
              type="button"
              className="lp-icon-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
            </button>

            <Link to={user ? '/' : '/login'} className="lp-btn-ghost">
              {user ? 'Dashboard' : 'Sign In'}
            </Link>

            <Link to={startDestination} className="lp-btn-primary lp-nav-cta">
              {user ? 'Open App' : 'Get Started'}
            </Link>

            <button
              type="button"
              className="lp-icon-btn lp-mobile-btn"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? <CloseIcon size={18} /> : <MenuIcon size={18} />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <nav className="lp-mobile-drawer" aria-label="Mobile menu">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="lp-mobile-link"
                onClick={() => setMobileNavOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <div className="lp-mobile-actions">
              <Link
                to={user ? '/' : '/login'}
                className="lp-btn-secondary lp-btn-full"
                onClick={() => setMobileNavOpen(false)}
              >
                {user ? 'Open Dashboard' : 'Sign In'}
              </Link>
              <Link
                to={startDestination}
                className="lp-btn-primary lp-btn-full"
                onClick={() => setMobileNavOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main>
        {/* 06. Hero Section — The First Impression */}
        <section className="lp-hero">
          <div className="lp-hero-grid-bg" aria-hidden="true" />
          <div className="lp-container lp-hero-split">
            <div className="lp-hero-copy">
              <div className="lp-announce-pill">
                <span className="lp-announce-star" aria-hidden="true">
                  ✦
                </span>
                <span>Meetings, Reimagined</span>
              </div>

              <h1 className="lp-hero-headline">
                Great conversations deserve{' '}
                <span className="lp-grad-hero">more than a goodbye.</span>
              </h1>

              <p className="lp-hero-desc">
                Meet, collaborate, and turn every conversation into something meaningful. MyMeet
                combines seamless HD meetings with AI-powered visual notes and intelligent learning
                tools—all in one beautifully connected workspace.
              </p>

              <div className="lp-hero-actions">
                <Link to={startDestination} className="lp-btn-primary lp-btn-lg">
                  <VideoIcon size={17} />
                  <span>Start Meeting</span>
                </Link>
                <a href="#features" className="lp-btn-secondary lp-btn-lg">
                  <span>Explore MyMeet</span>
                  <ArrowRightIcon size={16} />
                </a>
              </div>

              <p className="lp-hero-cap-line">HD Video · AI Visual Notes · Web &amp; Android</p>
            </div>

            <HeroShowcase />
          </div>
        </section>

        {/* 07. Product Capability Strip */}
        <section className="lp-cap-strip lp-reveal" aria-label="Core platform capabilities">
          <div className="lp-container">
            <div className="lp-cap-grid">
              {CAPABILITIES.map((cap, i) => {
                const Icon = cap.icon;
                return (
                  <div
                    key={cap.label}
                    className="lp-cap-item"
                    style={{ transitionDelay: `${i * 55}ms` }}
                  >
                    <span className="lp-cap-icon">
                      <Icon size={15} />
                    </span>
                    <span>{cap.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 08. The Problem & The MyMeet Difference */}
        <section id="why-mymeet" className="lp-section lp-reveal">
          <div className="lp-container">
            <div className="lp-section-head">
              <span className="lp-eyebrow">THE PROBLEM WITH ORDINARY MEETINGS</span>
              <h2 className="lp-section-title">
                The conversation ends.{' '}
                <span className="lp-grad-blue">The knowledge shouldn&apos;t.</span>
              </h2>
              <p className="lp-section-sub">
                Important ideas get forgotten. Lectures become hours of scattered notes. Team
                discussions lose their context. Traditional video calls bring people together, but
                the value of those conversations can disappear as soon as the meeting ends.
              </p>
            </div>

            <div className="lp-problem-grid">
              {PROBLEM_CARDS.map((card) => (
                <article key={card.num} className="lp-problem-card">
                  <span className="lp-problem-num">{card.num}</span>
                  <h3>{card.title}</h3>
                  <p>{card.copy}</p>
                </article>
              ))}
            </div>

            {/* Transition: Scattered Fragments -> Organized MyMeet Document */}
            <div className="lp-difference-bridge">
              <p className="lp-difference-heading">
                That&apos;s where <span>MyMeet</span> changes the experience.
              </p>
              <div className="lp-transform-visual" aria-label="Conversation transformed into structured notes">
                <div className="lp-fragments">
                  <span className="lp-frag lp-frag-1">&ldquo;Wait, what was that formula?&rdquo;</span>
                  <span className="lp-frag lp-frag-2">Shared screen slide #14</span>
                  <span className="lp-frag lp-frag-3">Key exam edge case mentioned at 38:10</span>
                  <span className="lp-frag lp-frag-4">Chat follow-up question</span>
                </div>

                <div className="lp-transform-connector" aria-hidden="true">
                  <span className="lp-connector-line" />
                  <span className="lp-connector-node">
                    <SparklesIcon size={16} />
                  </span>
                  <span className="lp-connector-line" />
                </div>

                <div className="lp-organized-doc">
                  <div className="lp-org-top">
                    <span className="lp-org-badge">MyMeet Knowledge Output</span>
                    <span className="lp-org-meta">Structured · Permanent</span>
                  </div>
                  <div className="lp-org-title">Organized Study Notes &amp; Revision Quiz</div>
                  <div className="lp-org-rows">
                    <span>
                      <CheckIcon size={12} /> Key concepts distilled from voice &amp; slides
                    </span>
                    <span>
                      <CheckIcon size={12} /> Formulas, code blocks &amp; 1-min cheat sheet
                    </span>
                    <span>
                      <CheckIcon size={12} /> Ready for PDF export &amp; 20-MCQ practice
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 09. Features Bento Grid */}
        <BentoFeatures />

        {/* 10. Signature Scroll-Driven Interactive Showcase */}
        <StickyJourney />

        {/* 14. Verified Pricing Section */}
        <section id="pricing" className="lp-section lp-reveal">
          <div className="lp-container">
            <div className="lp-section-head">
              <span className="lp-eyebrow">
                <CrownIcon size={12} />
                <span>TRANSPARENT INR PRICING</span>
              </span>
              <h2 className="lp-section-title">
                Start free. <span className="lp-grad-gold">Upgrade when it matters.</span>
              </h2>
              <p className="lp-section-sub">
                Host HD meetings with automatic AI Visual Notes free forever. Unlock Pro Master
                Notes from ₹9 or go Unlimited with 20-MCQ session assessments.
              </p>

              {/* Verified Monthly / Yearly Billing Toggle */}
              <div className="lp-billing-toggle" role="group" aria-label="Pro billing interval">
                <button
                  type="button"
                  className={billingCycle === 'monthly' ? 'active' : ''}
                  onClick={() => setBillingCycle('monthly')}
                >
                  Pro Monthly
                </button>
                <button
                  type="button"
                  className={billingCycle === 'yearly' ? 'active' : ''}
                  onClick={() => setBillingCycle('yearly')}
                >
                  Pro Yearly <span className="lp-save-chip">Save 78%</span>
                </button>
              </div>
            </div>

            <div className="lp-pricing-grid">
              {/* Basic Free Card */}
              <article className="lp-price-card lp-price-basic">
                <div>
                  <span className="lp-price-badge">Basic · Free Forever</span>
                  <h3>MyMeet Basic</h3>
                  <p className="lp-price-desc">
                    Everything you need to host HD sessions and capture automatic AI visual notes.
                  </p>
                  <div className="lp-price-figure">
                    <span className="lp-price-amt">₹0</span>
                    <span className="lp-price-unit">forever</span>
                  </div>
                  <ul className="lp-price-list">
                    <li>
                      <CheckIcon size={13} /> HD video &amp; audio meetings on Web &amp; Android
                    </li>
                    <li>
                      <CheckIcon size={13} /> Screen sharing, waiting rooms &amp; live chat
                    </li>
                    <li>
                      <CheckIcon size={13} /> Automatic AI Visual Notes after every session
                    </li>
                    <li>
                      <CheckIcon size={13} /> PDF &amp; PNG slide export
                    </li>
                    <li>
                      <CheckIcon size={13} /> Meeting scheduling &amp; full history
                    </li>
                  </ul>
                </div>

                <Link to={startDestination} className="lp-btn-secondary lp-btn-full">
                  Get Started
                </Link>
              </article>

              {/* Prepaid Pro Note Packs Card */}
              <article className="lp-price-card lp-price-packs">
                <div>
                  <span className="lp-price-badge lp-price-badge-violet">
                    Prepaid Note Credits · No Auto-Debit
                  </span>
                  <h3>Pro Note Packs</h3>
                  <p className="lp-price-desc">
                    Need deep Pro Master Notes for specific lectures without a full subscription?
                  </p>
                  <div className="lp-pack-options">
                    <div className="lp-pack-option">
                      <div>
                        <strong>Single Pro Credit</strong>
                        <span>1 class / meeting</span>
                      </div>
                      <span className="lp-pack-price">₹9</span>
                    </div>
                    <div className="lp-pack-option lp-pack-option-highlight">
                      <div>
                        <strong>Starter 15 Pack</strong>
                        <span>15 classes (~₹3.2/class) · PRO badge</span>
                      </div>
                      <span className="lp-pack-price">₹49</span>
                    </div>
                  </div>
                  <ul className="lp-price-list">
                    <li>
                      <CheckIcon size={13} /> Deep derivations, code blocks &amp; comparison tables
                    </li>
                    <li>
                      <CheckIcon size={13} /> Exam &amp; interview traps + 1-min cheat sheet
                    </li>
                    <li>
                      <CheckIcon size={13} /> HD printable PDF export &amp; permanent access
                    </li>
                    <li>
                      <CheckIcon size={13} /> Up to 2 free regenerations per class (15-Pack)
                    </li>
                  </ul>
                </div>

                <Link to="/pricing" className="lp-btn-secondary lp-btn-full">
                  Compare All Packs
                </Link>
              </article>

              {/* Flagship MyMeet Pro Unlimited Card */}
              <article className="lp-price-card lp-price-pro">
                <div>
                  <span className="lp-price-badge lp-price-badge-gold">
                    <CrownIcon size={11} /> MyMeet Pro Unlimited
                  </span>
                  <h3>{billingCycle === 'yearly' ? 'Pro Yearly' : 'Pro Monthly'}</h3>
                  <p className="lp-price-desc">
                    The complete learning and productivity workspace for daily classes and exam
                    prep.
                  </p>
                  <div className="lp-price-figure">
                    <span className="lp-price-amt">
                      {billingCycle === 'yearly' ? '₹899' : '₹349'}
                    </span>
                    <span className="lp-price-unit">
                      {billingCycle === 'yearly' ? '/ year (365 days)' : '/ month'}
                    </span>
                  </div>
                  <ul className="lp-price-list">
                    <li>
                      <CheckIcon size={13} /> <strong>Unlimited Pro Master Notes</strong> for every
                      meeting
                    </li>
                    <li>
                      <CheckIcon size={13} /> <strong>20-MCQ Session Assessments</strong> + host
                      scorecards
                    </li>
                    <li>
                      <CheckIcon size={13} /> Unlimited note regenerations &amp; priority AI
                    </li>
                    <li>
                      <CheckIcon size={13} /> HD printable PDF export &amp; permanent archive
                    </li>
                    <li>
                      <CheckIcon size={13} /> Luxury Pro workspace theme &amp; gold profile badge
                    </li>
                  </ul>
                </div>

                <Link
                  to={
                    user
                      ? `/profile?upgrade=${billingCycle === 'yearly' ? 'pro_yearly_899' : 'pro_monthly_349'}`
                      : '/signup'
                  }
                  className="lp-btn-pro lp-btn-full"
                >
                  Explore MyMeet Pro
                </Link>
              </article>
            </div>

            <div className="lp-pricing-foot">
              <span>
                <ShieldIcon size={14} /> Payments processed securely in INR via{' '}
                <strong>Razorpay</strong> (UPI, Cards, Netbanking). Prepaid plans never auto-debit.
              </span>
              <div className="lp-pricing-foot-links">
                <Link to="/pricing">Full Pricing Table</Link>
                <span>·</span>
                <Link to="/refund">Cancellation &amp; Refund Policy</Link>
              </div>
            </div>
          </div>
        </section>

        {/* 15. Trust, Privacy & Transparency */}
        <section className="lp-section lp-reveal">
          <div className="lp-container">
            <div className="lp-section-head">
              <span className="lp-eyebrow">
                <ShieldIcon size={12} />
                <span>PRIVACY &amp; RELIABILITY</span>
              </span>
              <h2 className="lp-section-title">
                Great connections begin with <span className="lp-grad-blue">trust.</span>
              </h2>
              <p className="lp-section-sub">
                Built around transparent practices, host-controlled sessions, and honest
                communication about how your meeting and billing data is handled.
              </p>
            </div>

            <div className="lp-trust-grid">
              {TRUST_PILLARS.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="lp-trust-card">
                    <span className="lp-trust-icon">
                      <Icon size={18} />
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.copy}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* 16. Official Licence & Legal Information */}
        <section className="lp-section lp-section-compact lp-reveal">
          <div className="lp-container">
            <div className="lp-legal-box">
              <div className="lp-legal-intro">
                <span className="lp-eyebrow">LEGAL &amp; LICENSING</span>
                <h2 className="lp-legal-title">Transparency by design.</h2>
                <p className="lp-legal-copy">
                  Explore the policies, licensing information, and principles behind the MyMeet
                  platform.
                </p>
                <div className="lp-legal-links">
                  <Link to="/terms" className="lp-legal-pill">
                    Terms of Service
                  </Link>
                  <Link to="/privacy" className="lp-legal-pill">
                    Privacy Policy
                  </Link>
                  <Link to="/refund" className="lp-legal-pill">
                    Refund &amp; Cancellation Policy
                  </Link>
                  <Link to="/contact" className="lp-legal-pill">
                    Contact &amp; Support
                  </Link>
                </div>
              </div>

              <div className="lp-licence-card">
                <div className="lp-licence-head">
                  <span className="lp-licence-icon" aria-hidden="true">
                    <ShieldIcon size={17} />
                  </span>
                  <div>
                    <div className="lp-licence-name">{OFFICIAL_LICENCE.name}</div>
                    <div className="lp-licence-status">
                      {OFFICIAL_LICENCE.published
                        ? 'Published Official Document'
                        : 'Publication Pending'}
                    </div>
                  </div>
                </div>
                <p className="lp-licence-desc">{OFFICIAL_LICENCE.description}</p>
                {OFFICIAL_LICENCE.published && OFFICIAL_LICENCE.url ? (
                  <a
                    href={OFFICIAL_LICENCE.url}
                    target="_blank"
                    rel="noreferrer"
                    className="lp-licence-link"
                  >
                    View Official Licence ↗
                  </a>
                ) : (
                  <Link to="/terms" className="lp-licence-link">
                    Review Current Terms of Service →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 17. Frequently Asked Questions */}
        <section id="faq" className="lp-section lp-reveal">
          <div className="lp-container lp-faq-container">
            <div className="lp-section-head">
              <span className="lp-eyebrow">QUESTIONS &amp; ANSWERS</span>
              <h2 className="lp-section-title">A little more clarity.</h2>
              <p className="lp-section-sub">
                Straightforward answers about MyMeet meetings, AI study notes, MCQ assessments, and
                plans.
              </p>
            </div>

            <div className="lp-faq-list">
              {LANDING_FAQS.map((item, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={item.question}
                    className={`lp-faq-item ${isOpen ? 'lp-faq-item-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="lp-faq-trigger"
                      aria-expanded={isOpen}
                      aria-controls={`lp-faq-panel-${idx}`}
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    >
                      <span>{item.question}</span>
                      <span className={`lp-faq-chev ${isOpen ? 'rotated' : ''}`}>
                        <ChevronDownIcon size={16} />
                      </span>
                    </button>
                    <div
                      id={`lp-faq-panel-${idx}`}
                      className="lp-faq-panel"
                      role="region"
                      hidden={!isOpen}
                    >
                      <p>{item.answer}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 18. Final Conversion Section */}
        <section className="lp-cta-section lp-reveal">
          <div className="lp-container">
            <div className="lp-cta-banner">
              <div className="lp-cta-orbit" aria-hidden="true">
                <svg viewBox="0 0 800 320" fill="none" preserveAspectRatio="xMidYMid slice">
                  <circle cx="400" cy="160" r="140" stroke="url(#ctaOrb)" strokeOpacity="0.35" />
                  <circle cx="400" cy="160" r="240" stroke="url(#ctaOrb)" strokeOpacity="0.2" />
                  <circle cx="400" cy="160" r="340" stroke="url(#ctaOrb)" strokeOpacity="0.12" />
                  <defs>
                    <linearGradient id="ctaOrb" x1="0" y1="0" x2="800" y2="320">
                      <stop stopColor="#2563EB" />
                      <stop offset="0.5" stopColor="#06B6D4" />
                      <stop offset="1" stopColor="#7C3AED" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <div className="lp-cta-inner">
                <img
                  src="/mymeet-mark.png?v=2"
                  alt="MyMeet"
                  width={56}
                  height={56}
                  className="lp-cta-logo"
                  loading="lazy"
                />
                <h2 className="lp-cta-title">Make your next meeting mean more.</h2>
                <p className="lp-cta-sub">
                  Connect with people. Collaborate on ideas. Carry the knowledge forward.
                </p>

                <div className="lp-cta-actions">
                  <Link to={startDestination} className="lp-btn-primary lp-btn-lg">
                    <span>Get Started with MyMeet</span>
                    <ArrowRightIcon size={16} />
                  </Link>
                  <Link to={joinDestination} className="lp-btn-secondary lp-btn-lg">
                    Join a Meeting
                  </Link>
                </div>

                <p className="lp-cta-tagline">Connect. Collaborate. Together.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 19. Professional Enterprise Footer */}
      <footer className="lp-footer">
        <div className="lp-footer-watermark" aria-hidden="true">
          MyMeet
        </div>

        <div className="lp-container lp-footer-grid">
          <div className="lp-footer-brand">
            <BrandLogo size="md" />
            <p className="lp-footer-bio">
              MyMeet is an intelligent meeting and collaboration workspace designed to transform
              everyday conversations into meaningful, lasting knowledge.
            </p>
            <div className="lp-footer-tag">Connect. Collaborate. Together.</div>
          </div>

          <div className="lp-footer-col">
            <h4>Product</h4>
            <a href="#features">Features</a>
            <Link to={startDestination}>Start a Meeting</Link>
            <Link to={joinDestination}>Join a Meeting</Link>
            <Link to={user ? '/schedule' : '/login'}>Schedule a Meeting</Link>
            <a href="#how-it-works">AI Visual Notes</a>
            <a href="#pricing">MyMeet Pro</a>
            <Link to="/pricing">Pricing</Link>
          </div>

          <div className="lp-footer-col">
            <h4>Resources</h4>
            <a href="#how-it-works">How It Works</a>
            <a href="#faq">Frequently Asked Questions</a>
            <Link to="/contact">Help &amp; Support</Link>
            <Link to="/contact">Contact Us</Link>
          </div>

          <div className="lp-footer-col">
            <h4>Legal</h4>
            {OFFICIAL_LICENCE.published && OFFICIAL_LICENCE.url ? (
              <a href={OFFICIAL_LICENCE.url} target="_blank" rel="noreferrer">
                Official Software Licence
              </a>
            ) : (
              <Link to="/terms">Software Licence &amp; Terms</Link>
            )}
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/refund">Refund Policy</Link>
          </div>

          <div className="lp-footer-col">
            <h4>Connect</h4>
            {SOCIAL_LINKS.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer">
                {s.label} ↗
              </a>
            ))}
            <Link to="/contact">Email Support</Link>
          </div>
        </div>

        <div className="lp-container lp-footer-bottom">
          <div className="lp-footer-copy">
            <span>© {new Date().getFullYear()} MyMeet.</span>
            <span>·</span>
            <span>Payments secured by Razorpay (INR)</span>
          </div>

          <div className="lp-footer-controls">
            <button
              type="button"
              className="lp-footer-ctrl-btn"
              onClick={toggleTheme}
              aria-label="Toggle Light or Dark theme"
            >
              {theme === 'dark' ? <SunIcon size={14} /> : <MoonIcon size={14} />}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <button type="button" className="lp-footer-ctrl-btn" onClick={scrollToTop}>
              Back to top ↑
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
