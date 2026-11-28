import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import {
  CheckIcon,
  ClockIcon,
  CopyIcon,
  CrownIcon,
  MailIcon,
  ShieldIcon,
  SparklesIcon,
} from '../components/Icons';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';

const SUPPORT_EMAIL = 'krishnaiitb.2026@gmail.com';
const WEBSITE_URL = 'https://mymeet-live.vercel.app';
const LAST_UPDATED = 'November 28, 2026';

const PUBLIC_NAV_LINKS = [
  { to: '/pricing', label: 'Pricing' },
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/refund', label: 'Refunds' },
  { to: '/contact', label: 'Contact' },
];

export function LegalFooterLinks({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <footer className="legal-footer-compact">
        <nav className="legal-footer-nav" aria-label="Legal and policy links">
          {PUBLIC_NAV_LINKS.map((item, idx) => (
            <span key={item.to} className="legal-footer-item">
              {idx > 0 && (
                <span className="legal-footer-sep" aria-hidden="true">
                  ·
                </span>
              )}
              <Link to={item.to} className="legal-footer-link">
                {item.label}
              </Link>
            </span>
          ))}
        </nav>
        <div className="legal-footer-copy">
          © {new Date().getFullYear()} MyMeet · Payments secured by Razorpay
        </div>
      </footer>
    );
  }

  return (
    <footer className="pub-footer">
      <div className="pub-footer-inner">
        <div className="pub-footer-brand">
          <BrandLogo size="sm" showTagline />
          <p className="pub-footer-desc">
            Cross-platform HD video conferencing, collaborative screen sharing, and AI-powered
            Master Study Notes for students, educators, and teams.
          </p>
          <span className="pub-trust-pill">
            <ShieldIcon size={13} />
            <span>Payments secured by Razorpay (PCI-DSS)</span>
          </span>
        </div>

        <div className="pub-footer-cols">
          <div className="pub-footer-col">
            <h4>Product</h4>
            <Link to="/pricing">Plans &amp; Pricing</Link>
            <Link to="/login">Sign In</Link>
            <Link to="/signup">Create Account</Link>
          </div>

          <div className="pub-footer-col">
            <h4>Legal &amp; Policies</h4>
            <Link to="/terms">Terms &amp; Conditions</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/refund">Cancellation &amp; Refunds</Link>
          </div>

          <div className="pub-footer-col">
            <h4>Support</h4>
            <Link to="/contact">Contact Us</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            <span className="pub-footer-meta">Mon–Sat · 10 AM – 7 PM IST</span>
          </div>
        </div>
      </div>

      <div className="pub-footer-bottom">
        <span>© {new Date().getFullYear()} MyMeet. Built in India.</span>
        <span>All prices in INR · Instant digital delivery</span>
      </div>
    </footer>
  );
}

function PublicPageLayout({
  eyebrow,
  title,
  subtitle,
  metaPills,
  wide = false,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  metaPills?: string[];
  wide?: boolean;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="pub-shell">
      <header className="pub-header">
        <div className="pub-header-inner">
          <Link to={user ? '/' : '/login'} className="brand" aria-label="MyMeet Home">
            <BrandLogo size="sm" />
          </Link>

          <nav className="pub-nav" aria-label="Public navigation">
            {PUBLIC_NAV_LINKS.map((item) => {
              const isActive =
                pathname === item.to ||
                (item.to === '/terms' && pathname === '/terms-and-conditions') ||
                (item.to === '/privacy' && pathname === '/privacy-policy') ||
                (item.to === '/refund' &&
                  (pathname === '/refund-policy' || pathname === '/cancellation-refund')) ||
                (item.to === '/contact' && pathname === '/contact-us');
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`pub-nav-link ${isActive ? 'active' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="pub-header-actions">
            <ThemeToggle />
            <Link to={user ? '/' : '/login'} className="btn btn-primary btn-sm">
              {user ? 'Open Dashboard' : 'Sign In'}
            </Link>
          </div>
        </div>
      </header>

      <section className="pub-hero-wrap">
        <div className="pub-hero-glow" aria-hidden="true" />
        <div className={`pub-container ${wide ? 'pub-container-wide' : ''}`}>
          <div className="pub-hero">
            <span className="pub-eyebrow">
              <SparklesIcon size={12} />
              <span>{eyebrow}</span>
            </span>
            <h1 className="pub-title">{title}</h1>
            <p className="pub-subtitle">{subtitle}</p>
            {metaPills && metaPills.length > 0 && (
              <div className="pub-meta-row">
                {metaPills.map((pill) => (
                  <span key={pill} className="pub-meta-pill">
                    {pill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <main className={`pub-main ${wide ? 'pub-container-wide' : ''}`}>{children}</main>

      <LegalFooterLinks />
    </div>
  );
}

/* ==========================================================================
   1. PRICING PAGE (/pricing)
   ========================================================================== */

interface PricingTier {
  name: string;
  price: string;
  period: string;
  tagline: string;
  badge: string;
  highlight?: 'gold' | 'violet';
  ctaLabel: string;
  ctaTo: string;
  features: string[];
}

const FLAGSHIP_TIERS: PricingTier[] = [
  {
    name: 'Pro Monthly',
    price: '₹349',
    period: '/ month',
    tagline: 'All-access AI study suite for daily classes, coaching, and exam prep.',
    badge: 'All-Access Monthly',
    highlight: 'violet',
    ctaLabel: 'Upgrade to Pro Monthly',
    ctaTo: '/profile?upgrade=pro_monthly_349',
    features: [
      'Unlimited Pro Master Notes for every meeting & lecture',
      '20-MCQ Session Revision Test auto-generated after every class',
      'Deep code blocks, derivations, comparison tables & 1-min cheat sheet',
      'Unlimited note regenerations & HD printable PDF export',
      'Luxury PRO obsidian-gold workspace theme & priority AI queue',
    ],
  },
  {
    name: 'Pro Yearly',
    price: '₹899',
    period: '/ year',
    tagline: 'Full 365 days of unlimited Pro Master Notes & MCQ tests — just ₹75/month.',
    badge: 'Best Value · Save 78%',
    highlight: 'gold',
    ctaLabel: 'Get Pro Yearly (Save 78%)',
    ctaTo: '/profile?upgrade=pro_yearly_899',
    features: [
      'Everything in Pro Monthly for 365 full days',
      'Unlimited Pro Master Notes across Web & Android',
      'Unlimited 20-MCQ Session Revision Tests with score & weak-topic tracking',
      'Host MCQ Participant Scorecard for teachers & batch mentors',
      'Priority AI generation, luxury PRO badge & permanent archive access',
    ],
  },
];

const FLEXIBLE_TIERS: PricingTier[] = [
  {
    name: 'Basic (Free)',
    price: '₹0',
    period: 'Forever free',
    tagline: 'Everything you need to host & join HD video sessions at zero cost.',
    badge: 'Free Studio',
    ctaLabel: 'Create Free Account',
    ctaTo: '/signup',
    features: [
      'HD video & audio meetings on Web & Android',
      'Screen sharing, waiting room & real-time chat',
      'Basic Visual AI Notes after every meeting',
      'Schedule meetings & invite via email',
    ],
  },
  {
    name: 'Single Pro Note Pass',
    price: '₹9',
    period: 'One-time · 1 class',
    tagline: 'Try full Pro Master Notes on one important lecture or interview.',
    badge: 'Pay Per Class',
    ctaLabel: 'Buy ₹9 Pass',
    ctaTo: '/profile?upgrade=single_9',
    features: [
      'Pro Master Notes for 1 class or meeting',
      'Code snippets, formulas & worked examples',
      'Exam traps + 1-minute rapid cheat sheet',
      'HD printable PDF export & permanent access',
    ],
  },
  {
    name: '15 Pro Notes Pack',
    price: '₹49',
    period: 'One-time · 15 classes',
    tagline: 'Smart prepaid bundle for regular students — just ~₹3.2 per class.',
    badge: 'Student Bundle',
    ctaLabel: 'Buy ₹49 Pack',
    ctaTo: '/profile?upgrade=pack_49',
    features: [
      'Pro Master Notes for 15 classes or meetings',
      'Deep technical notes, tables & cheat sheets',
      'Up to 2 free regenerations per class + HD PDF',
      'PRO workspace theme & gold profile badge',
    ],
  },
];

const COMPARISON_ROWS: {
  feature: string;
  basic: string | boolean;
  packs: string | boolean;
  unlimited: string | boolean;
}[] = [
  { feature: 'HD Video Meetings, Screen Share & Live Chat', basic: true, packs: true, unlimited: true },
  { feature: 'Basic Visual AI Notes (Auto after meeting)', basic: true, packs: true, unlimited: true },
  { feature: 'Pro Master Notes (Code, Formulas, Derivations)', basic: false, packs: '1 or 15 Classes', unlimited: 'Unlimited' },
  { feature: 'HD Printable PDF Export & Cheat Sheet', basic: false, packs: true, unlimited: true },
  { feature: '20-MCQ Session Revision Tests & Scorecard', basic: false, packs: false, unlimited: 'Unlimited' },
  { feature: 'Luxury PRO Theme, Gold Badge & Priority AI', basic: false, packs: '15-Pack', unlimited: true },
];

const PRICING_FAQS = [
  {
    q: 'How quickly does my Pro plan activate after payment?',
    a: 'Instantly. As soon as Razorpay verifies your UPI, Card, or Netbanking payment signature, your Pro credits or subscription unlock automatically and a confirmation email is sent to your inbox.',
  },
  {
    q: 'Do plans auto-renew or charge my card automatically?',
    a: 'No. All MyMeet Pro passes and monthly/yearly plans are prepaid and never auto-debit without your explicit checkout action.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'We accept UPI (GPay, PhonePe, Paytm, BHIM), Debit & Credit Cards (Visa, Mastercard, RuPay), and Netbanking via Razorpay in Indian Rupees (INR).',
  },
  {
    q: 'What happens if a payment fails after money is debited?',
    a: 'Razorpay and your bank automatically reverse failed or declined transactions within 5–7 business days. You can also reach us anytime at krishnaiitb.2026@gmail.com with your Payment ID.',
  },
];

function ComparisonCell({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <span className="pub-cmp-yes" aria-label="Included">
        <CheckIcon size={13} />
      </span>
    );
  }
  if (value === false) {
    return <span className="pub-cmp-no">—</span>;
  }
  return <span className="pub-cmp-text">{value}</span>;
}

export function PricingPage() {
  const { user } = useAuth();

  return (
    <PublicPageLayout
      eyebrow="Transparent INR Pricing"
      title="Host Meetings Free. Supercharge Study Notes with Pro."
      subtitle="Zero hidden fees, zero surprise auto-renewals. Start free forever, grab a ₹9 single pass, or unlock unlimited AI Master Notes & 20-MCQ tests."
      metaPills={[
        'Instant Digital Activation',
        'UPI · Cards · Netbanking via Razorpay',
        'No Auto-Debit Subscriptions',
      ]}
      wide
    >
      {/* Row 1: Flagship Unlimited Pro Subscriptions */}
      <div className="pub-section-label">
        <CrownIcon size={14} />
        <span>Unlimited All-Access Subscriptions (Pro Notes + 20-MCQ Revision Tests)</span>
      </div>
      <div className="pub-flagship-grid">
        {FLAGSHIP_TIERS.map((tier) => (
          <article
            key={tier.name}
            className={`pub-plan-card pub-plan-flagship ${
              tier.highlight === 'gold' ? 'pub-plan-gold' : 'pub-plan-violet'
            }`}
          >
            <div>
              <div className="pub-plan-top">
                <span className="pub-plan-badge">
                  <CrownIcon size={12} />
                  <span>{tier.badge}</span>
                </span>
                <h2 className="pub-plan-name">{tier.name}</h2>
                <p className="pub-plan-tagline">{tier.tagline}</p>
              </div>

              <div className="pub-plan-price-row">
                <span className="pub-plan-price">{tier.price}</span>
                <span className="pub-plan-period">{tier.period}</span>
              </div>

              <ul className="pub-plan-features">
                {tier.features.map((feat) => (
                  <li key={feat}>
                    <span className="pub-feat-check">
                      <CheckIcon size={12} />
                    </span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              to={user ? tier.ctaTo : '/login'}
              className={`btn btn-full ${tier.highlight === 'gold' ? 'btn-primary' : 'btn-secondary'}`}
            >
              {user ? tier.ctaLabel : `Sign In · ${tier.ctaLabel}`}
            </Link>
          </article>
        ))}
      </div>

      {/* Row 2: Free & Prepaid Packs */}
      <div className="pub-section-label" style={{ marginTop: 32 }}>
        <SparklesIcon size={14} />
        <span>Free Studio &amp; Flexible Prepaid Note Packs</span>
      </div>
      <div className="pub-flex-grid">
        {FLEXIBLE_TIERS.map((tier) => (
          <article key={tier.name} className="pub-plan-card">
            <div>
              <div className="pub-plan-top">
                <span className="pub-plan-badge pub-plan-badge-muted">{tier.badge}</span>
                <h2 className="pub-plan-name">{tier.name}</h2>
                <p className="pub-plan-tagline">{tier.tagline}</p>
              </div>

              <div className="pub-plan-price-row">
                <span className="pub-plan-price">{tier.price}</span>
                <span className="pub-plan-period">{tier.period}</span>
              </div>

              <ul className="pub-plan-features">
                {tier.features.map((feat) => (
                  <li key={feat}>
                    <span className="pub-feat-check">
                      <CheckIcon size={12} />
                    </span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              to={user ? tier.ctaTo : tier.ctaTo === '/signup' ? '/signup' : '/login'}
              className="btn btn-secondary btn-full"
            >
              {user ? tier.ctaLabel : tier.ctaTo === '/signup' ? tier.ctaLabel : `Sign In · ${tier.ctaLabel}`}
            </Link>
          </article>
        ))}
      </div>

      {/* Comparison Matrix */}
      <section className="pub-panel" style={{ marginTop: 34 }}>
        <div className="pub-panel-head">
          <h2>Compare Plans at a Glance</h2>
          <p className="muted">Exact feature transparency before you upgrade.</p>
        </div>
        <div className="pub-table-wrap">
          <table className="pub-cmp-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Basic (₹0)</th>
                <th>Passes (₹9 / ₹49)</th>
                <th>Pro Monthly / Yearly</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.feature}>
                  <td>{row.feature}</td>
                  <td>
                    <ComparisonCell value={row.basic} />
                  </td>
                  <td>
                    <ComparisonCell value={row.packs} />
                  </td>
                  <td>
                    <ComparisonCell value={row.unlimited} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Billing FAQs */}
      <section style={{ marginTop: 34 }}>
        <div className="pub-panel-head" style={{ marginBottom: 14 }}>
          <h2>Billing &amp; Checkout FAQs</h2>
          <p className="muted">Quick answers about Razorpay checkout, credits, and refunds.</p>
        </div>
        <div className="pub-faq-grid">
          {PRICING_FAQS.map((item) => (
            <article key={item.q} className="pub-faq-card">
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </article>
          ))}
        </div>
      </section>
    </PublicPageLayout>
  );
}

/* ==========================================================================
   EDITORIAL LEGAL DOCUMENT SHELL (Used by Terms, Privacy, Refund)
   ========================================================================== */

interface LegalSection {
  id: string;
  num: string;
  heading: string;
  content: ReactNode;
}

function LegalDocLayout({
  eyebrow,
  title,
  subtitle,
  summaryTitle,
  summaryPoints,
  sections,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  summaryTitle: string;
  summaryPoints: string[];
  sections: LegalSection[];
}) {
  return (
    <PublicPageLayout
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      metaPills={[`Effective: ${LAST_UPDATED}`, 'Jurisdiction: India', 'Platform: MyMeet']}
    >
      <div className="pub-legal-grid">
        {/* Sticky Left Rail */}
        <aside className="pub-legal-rail">
          <div className="pub-toc-card">
            <div className="pub-toc-label">On this page</div>
            <nav className="pub-toc-list" aria-label="Document sections">
              {sections.map((sec) => (
                <a key={sec.id} href={`#${sec.id}`} className="pub-toc-link">
                  <span className="pub-toc-num">{sec.num}</span>
                  <span>{sec.heading}</span>
                </a>
              ))}
            </nav>
          </div>

          <div className="pub-summary-card">
            <div className="pub-summary-head">
              <ShieldIcon size={15} />
              <span>{summaryTitle}</span>
            </div>
            <ul>
              {summaryPoints.map((pt) => (
                <li key={pt}>{pt}</li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main Editorial Document */}
        <article className="pub-doc-canvas">
          {sections.map((sec) => (
            <section key={sec.id} id={sec.id} className="pub-doc-block">
              <div className="pub-doc-block-head">
                <span className="pub-doc-num">{sec.num}</span>
                <h2>{sec.heading}</h2>
              </div>
              <div className="pub-doc-prose">{sec.content}</div>
            </section>
          ))}
        </article>
      </div>
    </PublicPageLayout>
  );
}

/* ==========================================================================
   2. TERMS & CONDITIONS (/terms)
   ========================================================================== */

export function TermsPage() {
  const sections: LegalSection[] = [
    {
      id: 'about',
      num: '01',
      heading: 'About MyMeet & Acceptance',
      content: (
        <p>
          MyMeet (<strong>{WEBSITE_URL}</strong>) is a cross-platform HD video conferencing and
          AI-powered study notes platform available on Web and Android, operating from India. By
          creating an account, joining a meeting, or purchasing a Pro plan, you agree to be bound by
          these Terms &amp; Conditions.
        </p>
      ),
    },
    {
      id: 'accounts',
      num: '02',
      heading: 'Account Registration & Security',
      content: (
        <>
          <p>
            To host meetings, access saved study notes, or purchase Pro plans, you must register
            with your accurate name and a verified email address.
          </p>
          <ul>
            <li>You are responsible for safeguarding your account password and session access.</li>
            <li>
              Sharing credentials for commercial resale or automated scraping of AI services is
              strictly prohibited.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'billing',
      num: '03',
      heading: 'Digital Plans, Pricing & Payments',
      content: (
        <>
          <p>
            MyMeet offers a free Basic tier alongside prepaid digital Pro plans in Indian Rupees
            (INR): <strong>₹9 Single Pass</strong>, <strong>₹49 15-Notes Pack</strong>,{' '}
            <strong>₹349 Pro Monthly</strong>, and <strong>₹899 Pro Yearly</strong>.
          </p>
          <div className="pub-callout">
            <strong>Instant Digital Delivery:</strong> All payments are processed securely by{' '}
            <strong>Razorpay</strong>. Pro credits and subscriptions activate immediately upon
            verified payment signature — no physical goods or shipping are involved.
          </div>
        </>
      ),
    },
    {
      id: 'acceptable-use',
      num: '04',
      heading: 'Acceptable Use Policy',
      content: (
        <ul>
          <li>
            Do not use MyMeet for illegal, abusive, defamatory, harassing, or copyright-infringing
            content or broadcasts.
          </li>
          <li>
            Do not attempt to bypass payment verification, reverse-engineer media servers, or flood
            AI endpoints with automated bots.
          </li>
          <li>
            Accounts found violating these terms may be suspended or terminated without prior
            notice.
          </li>
        </ul>
      ),
    },
    {
      id: 'ai-notes',
      num: '05',
      heading: 'AI Study Notes & MCQ Disclaimer',
      content: (
        <p>
          Pro Master Notes, Basic Visual Notes, and 20-MCQ Session Revision Tests are automatically
          generated from meeting context to accelerate learning and review. While we optimize for
          academic accuracy, AI outputs are supplementary study aids and should be cross-checked for
          critical exams, legal, medical, or production engineering use.
        </p>
      ),
    },
    {
      id: 'governing-law',
      num: '06',
      heading: 'Governing Law & Contact',
      content: (
        <p>
          These Terms &amp; Conditions are governed by and construed in accordance with the laws of
          India. Questions regarding these terms can be sent to{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      ),
    },
  ];

  return (
    <LegalDocLayout
      eyebrow="Terms of Service"
      title="Terms & Conditions"
      subtitle="Clear ground rules governing your use of MyMeet Web, MyMeet Android, and MyMeet Pro digital subscriptions."
      summaryTitle="Key Highlights"
      summaryPoints={[
        'Cross-platform Web & Android SaaS (India)',
        'Prepaid INR digital plans via Razorpay',
        'Instant online activation — zero shipping',
        'Governed by the laws of India',
      ]}
      sections={sections}
    />
  );
}

/* ==========================================================================
   3. PRIVACY POLICY (/privacy)
   ========================================================================== */

export function PrivacyPage() {
  const sections: LegalSection[] = [
    {
      id: 'data-collected',
      num: '01',
      heading: 'Information We Collect',
      content: (
        <ul>
          <li>
            <strong>Account Details:</strong> Full name, verified email address, and optional
            profile photo.
          </li>
          <li>
            <strong>Meeting &amp; Study Artifacts:</strong> Meeting titles, participant rosters,
            in-room chat messages, AI study notes, and MCQ revision attempt scores.
          </li>
          <li>
            <strong>Payment Metadata:</strong> Plan code, order amount, payment status, and
            Razorpay order/payment IDs required to verify and activate your subscription.
          </li>
        </ul>
      ),
    },
    {
      id: 'payment-security',
      num: '02',
      heading: 'Zero Storage of Sensitive Payment Credentials',
      content: (
        <>
          <div className="pub-callout pub-callout-emerald">
            <strong>PCI-DSS Protected Checkout:</strong> MyMeet never collects, views, or stores
            your debit/credit card numbers, CVV, UPI PIN, or bank passwords. All payment
            credentials are handled exclusively by <strong>Razorpay</strong> over encrypted HTTPS.
          </div>
          <p>
            Our backend only receives cryptographic HMAC-SHA256 verification tokens and order IDs
            from Razorpay to confirm payment authenticity before activating Pro features.
          </p>
        </>
      ),
    },
    {
      id: 'how-used',
      num: '03',
      heading: 'How We Use Your Information',
      content: (
        <ul>
          <li>Authenticate sessions and host real-time encrypted HD video meetings.</li>
          <li>Generate and persist your Basic Visual Notes, Pro Master Notes, and 20-MCQ tests.</li>
          <li>
            Deliver transactional emails including signup verification, meeting invitations,
            subscription welcome receipts, and expiry notices.
          </li>
          <li>Monitor platform reliability and prevent unauthorized access or billing fraud.</li>
        </ul>
      ),
    },
    {
      id: 'infrastructure',
      num: '04',
      heading: 'Data Storage & Trusted Processors',
      content: (
        <p>
          We never sell or rent user data to advertisers or data brokers. Data is stored securely
          with PostgreSQL Row-Level Security (RLS) on trusted cloud infrastructure (Supabase, AWS,
          Vercel, and Razorpay for billing).
        </p>
      ),
    },
    {
      id: 'rights',
      num: '05',
      heading: 'Your Rights & Account Deletion',
      content: (
        <p>
          You can update your display name and profile photo anytime inside Profile Settings. To
          request permanent deletion of your account and associated meeting/note data, email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link">
            {SUPPORT_EMAIL}
          </a>{' '}
          from your registered address.
        </p>
      ),
    },
  ];

  return (
    <LegalDocLayout
      eyebrow="Privacy & Data Protection"
      title="Privacy Policy"
      subtitle="How MyMeet protects your identity, meeting sessions, AI study notes, and Razorpay payment metadata."
      summaryTitle="Privacy Promise"
      summaryPoints={[
        'We never store Card, CVV, or UPI PIN data',
        'Zero selling of user data to third parties',
        'Row-Level Security (RLS) database isolation',
        'Account deletion available anytime via email',
      ]}
      sections={sections}
    />
  );
}

/* ==========================================================================
   4. CANCELLATION & REFUND POLICY (/refund)
   ========================================================================== */

export function RefundPage() {
  const sections: LegalSection[] = [
    {
      id: 'digital-delivery',
      num: '01',
      heading: 'Instant Digital Service Delivery',
      content: (
        <p>
          MyMeet Pro passes (₹9 Single Pass, ₹49 15-Notes Pack) and subscriptions (₹349 Pro
          Monthly, ₹899 Pro Yearly) are 100% digital software services. Access and credits unlock
          immediately upon successful Razorpay payment verification — no physical shipping applies.
        </p>
      ),
    },
    {
      id: 'failed-payments',
      num: '02',
      heading: 'Failed, Declined & Duplicate Transactions',
      content: (
        <>
          <div className="pub-callout">
            <strong>Automatic Bank Reversal:</strong> If your bank account or UPI app is debited on
            a failed, declined, or duplicate payment attempt, Razorpay and your issuing bank
            automatically refund the full amount to your original payment source within{' '}
            <strong>5–7 business days</strong>.
          </div>
          <p>
            If a failed transaction has not been reversed after 7 business days, email us with your
            Razorpay Payment ID (<code>pay_...</code>) and we will immediately escalate it with
            Razorpay support.
          </p>
        </>
      ),
    },
    {
      id: 'refund-eligibility',
      num: '03',
      heading: 'Eligible Refund Requests (7-Day Window)',
      content: (
        <ul>
          <li>
            If you were billed due to a technical error, accidental duplicate purchase, or did not
            receive your unlocked Pro benefits, contact{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link">
              {SUPPORT_EMAIL}
            </a>{' '}
            within <strong>7 days</strong> of the payment date.
          </li>
          <li>
            Please include your registered MyMeet email address, Razorpay Payment ID, and a brief
            description of the issue.
          </li>
          <li>
            Approved refunds are reviewed within <strong>48 business hours</strong> and credited
            back to the original payment method within <strong>5–7 business days</strong>.
          </li>
          <li>
            Prepaid Pro Note credits that have already been used to generate and deliver Pro Master
            Notes are generally non-refundable unless a verified service defect occurred.
          </li>
        </ul>
      ),
    },
    {
      id: 'cancellation',
      num: '04',
      heading: 'Cancellation Policy (No Auto-Debit)',
      content: (
        <p>
          MyMeet does not enroll you in surprise recurring auto-debits. Once your prepaid plan
          expires or credits are consumed, your account automatically reverts to the free Basic
          tier at ₹0 cost. You may also request immediate plan or account cancellation anytime by
          emailing{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      ),
    },
  ];

  return (
    <LegalDocLayout
      eyebrow="Billing Protection"
      title="Cancellation & Refund Policy"
      subtitle="Straightforward, fair protection for every MyMeet Pro payment processed through Razorpay."
      summaryTitle="Refund Timeline"
      summaryPoints={[
        'Failed payments auto-refund in 5–7 business days',
        '7-day window for eligible refund requests',
        'Review within 48 hrs · Credit in 5–7 business days',
        'Zero recurring auto-debits to worry about',
      ]}
      sections={sections}
    />
  );
}

/* ==========================================================================
   5. CONTACT US (/contact)
   ========================================================================== */

export function ContactPage() {
  const [topic, setTopic] = useState('Billing & Payment Support');
  const [paymentId, setPaymentId] = useState('');
  const [message, setMessage] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2200);
    } catch {
      // Clipboard blocked on insecure contexts
    }
  };

  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `[MyMeet] ${topic}${paymentId.trim() ? ` (${paymentId.trim()})` : ''}`,
  )}&body=${encodeURIComponent(
    `Hello MyMeet Support,\n\nTopic: ${topic}\n${
      paymentId.trim() ? `Razorpay Payment / Order ID: ${paymentId.trim()}\n` : ''
    }\nMessage:\n${message.trim() || '(Describe your question or issue here)'}\n`,
  )}`;

  return (
    <PublicPageLayout
      eyebrow="Customer Support & Merchant Info"
      title="We’re Here to Help"
      subtitle="Questions about live meetings, Pro subscriptions, or a Razorpay receipt? Connect directly with the MyMeet team."
      metaPills={['Replies in 24–48 Business Hours', 'Mon–Sat · 10 AM – 7 PM IST', 'India']}
    >
      {/* Top 3 Highlight Strip */}
      <div className="pub-contact-highlights">
        <div className="pub-highlight-card">
          <span className="pub-highlight-icon">
            <MailIcon size={18} />
          </span>
          <div className="pub-highlight-meta">Official Support Email</div>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="pub-highlight-value text-link">
            {SUPPORT_EMAIL}
          </a>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            style={{ marginTop: 10 }}
            onClick={() => void handleCopyEmail()}
          >
            <CopyIcon size={12} />
            <span>{copiedEmail ? 'Copied!' : 'Copy Email'}</span>
          </button>
        </div>

        <div className="pub-highlight-card">
          <span className="pub-highlight-icon">
            <ClockIcon size={18} />
          </span>
          <div className="pub-highlight-meta">Support Hours &amp; SLA</div>
          <div className="pub-highlight-value">Mon – Sat · 10 AM – 7 PM IST</div>
          <p className="pub-highlight-sub">Most billing &amp; technical emails answered within 24h.</p>
        </div>

        <div className="pub-highlight-card">
          <span className="pub-highlight-icon">
            <ShieldIcon size={18} />
          </span>
          <div className="pub-highlight-meta">Platform &amp; Billing</div>
          <div className="pub-highlight-value">MyMeet Official</div>
          <p className="pub-highlight-sub">Verified digital SaaS platform operating from India.</p>
        </div>
      </div>

      {/* 2-Column Details + Inquiry Composer */}
      <div className="pub-contact-split">
        <article className="pub-panel">
          <div className="pub-panel-head">
            <h2>Platform &amp; Compliance Details</h2>
            <p className="muted">Official contact information for users and payment partners.</p>
          </div>
          <dl className="pub-kv-list">
            <div>
              <dt>Brand / Platform</dt>
              <dd>MyMeet — Connect. Collaborate. Together.</dd>
            </div>
            <div>
              <dt>Support Team</dt>
              <dd>MyMeet Official Support</dd>
            </div>
            <div>
              <dt>Support Email</dt>
              <dd>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link">
                  {SUPPORT_EMAIL}
                </a>
              </dd>
            </div>
            <div>
              <dt>Official Web App</dt>
              <dd>
                <a href={WEBSITE_URL} className="text-link">
                  {WEBSITE_URL}
                </a>
              </dd>
            </div>
            <div>
              <dt>Payment Gateway Partner</dt>
              <dd>Razorpay (INR · UPI, Cards, Netbanking)</dd>
            </div>
            <div>
              <dt>Operating Country</dt>
              <dd>India</dd>
            </div>
          </dl>
        </article>

        <article className="pub-panel">
          <div className="pub-panel-head">
            <h2>Quick Support Composer</h2>
            <p className="muted">
              Fill in optional details below to open a pre-formatted support email immediately.
            </p>
          </div>

          <div className="form" style={{ marginTop: 14 }}>
            <label className="field">
              <span className="field-label">Topic</span>
              <select
                className="input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              >
                <option value="Billing & Payment Support">Billing &amp; Payment Support</option>
                <option value="Refund Request">Refund Request</option>
                <option value="Pro Plan / Credits Activation">Pro Plan / Credits Activation</option>
                <option value="Meeting or Technical Issue">Meeting or Technical Issue</option>
                <option value="General Inquiry">General Inquiry</option>
              </select>
            </label>

            <label className="field">
              <span className="field-label">Razorpay Payment ID (Optional)</span>
              <input
                type="text"
                className="input"
                placeholder="e.g. pay_XXXXXXXXXXXXXX"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field-label">How can we help?</span>
              <textarea
                className="input"
                rows={4}
                placeholder="Share your registered email and details so we can help faster..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>

            <a href={mailtoHref} className="btn btn-primary btn-full">
              <MailIcon size={15} />
              <span>Send Support Email</span>
            </a>
          </div>
        </article>
      </div>
    </PublicPageLayout>
  );
}
