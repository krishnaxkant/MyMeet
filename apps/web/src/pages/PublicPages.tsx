import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { CheckIcon, CrownIcon, ShieldIcon, SparklesIcon } from '../components/Icons';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';

const SUPPORT_EMAIL = 'krishnaiitb.2026@gmail.com';
const WEBSITE_URL = 'https://mymeet-live.vercel.app';
const LAST_UPDATED = 'November 28, 2026';

const PUBLIC_NAV_LINKS = [
  { to: '/pricing', label: 'Pricing' },
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/refund', label: 'Refund Policy' },
  { to: '/contact', label: 'Contact Us' },
];

export function LegalFooterLinks({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={compact ? 'legal-footer-compact' : 'legal-footer-bar'}>
      <nav className="legal-footer-nav" aria-label="Legal and policy links">
        {PUBLIC_NAV_LINKS.map((item, idx) => (
          <span key={item.to} className="legal-footer-item">
            {idx > 0 && <span className="legal-footer-sep" aria-hidden="true">·</span>}
            <Link to={item.to} className="legal-footer-link">
              {item.label}
            </Link>
          </span>
        ))}
      </nav>
      <div className="legal-footer-copy">
        © {new Date().getFullYear()} MyMeet · Operated by Krishna Kant · Secure payments by Razorpay
      </div>
    </footer>
  );
}

function PublicPageLayout({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="public-shell">
      <header className="public-header">
        <div className="public-header-inner">
          <Link to={user ? '/' : '/login'} className="brand" aria-label="MyMeet Home">
            <BrandLogo size="sm" />
          </Link>

          <nav className="public-nav" aria-label="Public pages">
            {PUBLIC_NAV_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`public-nav-link ${pathname === item.to ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="public-header-actions">
            <ThemeToggle />
            <Link to={user ? '/' : '/login'} className="btn btn-primary btn-sm">
              {user ? 'Open Dashboard' : 'Sign In'}
            </Link>
          </div>
        </div>
      </header>

      <main className="public-main">
        <div className="public-hero">
          <span className="public-eyebrow">{eyebrow}</span>
          <h1 className="public-title">{title}</h1>
          <p className="public-subtitle">{subtitle}</p>
        </div>

        <div className="public-body">{children}</div>

        <LegalFooterLinks />
      </main>
    </div>
  );
}

const PRICING_TIERS = [
  {
    name: 'Basic (Free)',
    price: '₹0',
    period: 'Forever free',
    badge: 'Free Tier',
    featured: false,
    ctaLabel: 'Start Free',
    ctaTo: '/signup',
    features: [
      'HD video & audio meetings on Web & Android',
      'Screen sharing, waiting room & real-time chat',
      'Basic Visual AI Notes after meeting ends',
      'Meeting history & schedule management',
    ],
  },
  {
    name: 'Single Pro Note Pass',
    price: '₹9',
    period: 'One-time · 1 class',
    badge: 'Try Pro',
    featured: false,
    ctaLabel: 'Get Single Pass',
    ctaTo: '/profile?upgrade=single_9',
    features: [
      'Pro Master Notes for 1 class or meeting',
      'Code snippets, formulas, derivations & worked examples',
      'Comparison tables, exam traps & 1-min cheat sheet',
      'HD printable PDF export & permanent note access',
    ],
  },
  {
    name: '15 Pro Notes Pack',
    price: '₹49',
    period: 'One-time · 15 classes',
    badge: 'Student Pack',
    featured: false,
    ctaLabel: 'Get 15-Pack',
    ctaTo: '/profile?upgrade=pack_49',
    features: [
      'Pro Master Notes for 15 classes or meetings',
      'Deep technical notes, derivations & cheat sheets',
      'HD printable PDF export + up to 2 regenerations/class',
      'Premium PRO theme & gold profile badge',
    ],
  },
  {
    name: 'Pro Monthly',
    price: '₹349',
    period: 'Per month',
    badge: 'All-Access',
    featured: true,
    ctaLabel: 'Upgrade Monthly',
    ctaTo: '/profile?upgrade=pro_monthly_349',
    features: [
      'Unlimited Pro Master Notes for every class',
      'Quick 20-MCQ Session Revision Test after every meeting',
      'Unlimited note regenerations & HD PDF export',
      'Luxury PRO workspace theme & priority AI generation',
    ],
  },
  {
    name: 'Pro Yearly',
    price: '₹899',
    period: 'Per year (365 days)',
    badge: 'Best Value · Save 78%',
    featured: true,
    ctaLabel: 'Upgrade Yearly',
    ctaTo: '/profile?upgrade=pro_yearly_899',
    features: [
      'Unlimited Pro Master Notes for 1 full year (365 days)',
      'Unlimited 20-MCQ Session Revision Tests & score tracking',
      'Unlimited regenerations, HD PDF export & priority AI',
      'Full PRO studio experience on Web & Android',
    ],
  },
];

export function PricingPage() {
  const { user } = useAuth();

  return (
    <PublicPageLayout
      eyebrow="MyMeet Plans & Pricing"
      title="Simple, Transparent Pricing in INR"
      subtitle="Host HD video classes and meetings free forever. Upgrade anytime for deep Pro Master Notes, HD PDF exports, and 20-MCQ revision tests."
    >
      <div className="public-pricing-grid">
        {PRICING_TIERS.map((tier) => (
          <article
            key={tier.name}
            className={`card public-pricing-card ${tier.featured ? 'public-pricing-featured' : ''}`}
          >
            <div className="public-pricing-head">
              <span className="public-pricing-badge">
                {tier.featured ? <CrownIcon size={12} /> : <SparklesIcon size={12} />}
                <span>{tier.badge}</span>
              </span>
              <h2 className="public-pricing-name">{tier.name}</h2>
              <div className="public-pricing-amount-row">
                <span className="public-pricing-price">{tier.price}</span>
                <span className="public-pricing-period">{tier.period}</span>
              </div>
            </div>

            <ul className="public-pricing-list">
              {tier.features.map((feat) => (
                <li key={feat}>
                  <span className="public-check-dot">
                    <CheckIcon size={12} />
                  </span>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            <Link
              to={user ? tier.ctaTo : '/login'}
              className={`btn btn-full ${tier.featured ? 'btn-primary' : 'btn-secondary'}`}
            >
              {user ? tier.ctaLabel : `Sign In to ${tier.ctaLabel}`}
            </Link>
          </article>
        ))}
      </div>

      <div className="card public-doc-card" style={{ marginTop: 22 }}>
        <div className="public-security-note">
          <ShieldIcon size={18} />
          <div>
            <strong>Secure Digital Checkout via Razorpay</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              All prices are listed in Indian Rupees (INR). Payments are processed securely via
              Razorpay (UPI, Debit/Credit Cards, Netbanking). Digital Pro credits and subscriptions
              activate instantly on your MyMeet account upon payment verification — no physical
              shipping is required.
            </p>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}

export function TermsPage() {
  return (
    <PublicPageLayout
      eyebrow={`Terms & Conditions · Last updated ${LAST_UPDATED}`}
      title="Terms & Conditions"
      subtitle="Please read these terms carefully before using MyMeet Web, MyMeet Android, or purchasing a MyMeet Pro plan."
    >
      <article className="card public-doc-card">
        <section className="public-doc-section">
          <h2>1. About MyMeet</h2>
          <p>
            MyMeet (<strong>{WEBSITE_URL}</strong>) is a cross-platform video conferencing and
            AI-assisted study notes platform operated by <strong>Krishna Kant</strong> (India). By
            creating an account or using MyMeet, you agree to these Terms &amp; Conditions.
          </p>
        </section>

        <section className="public-doc-section">
          <h2>2. Account Registration &amp; Security</h2>
          <p>
            You must provide accurate registration details (name and verified email address) and
            keep your login credentials confidential. You are responsible for all activity carried
            out under your MyMeet account.
          </p>
        </section>

        <section className="public-doc-section">
          <h2>3. Digital Plans, Pricing &amp; Payments</h2>
          <ul>
            <li>
              MyMeet offers a free Basic tier as well as paid digital Pro passes and subscriptions
              (₹9 Single Pass, ₹49 15-Notes Pack, ₹349 Pro Monthly, and ₹899 Pro Yearly).
            </li>
            <li>
              All payments are processed securely in INR through <strong>Razorpay</strong>. Pro
              credits and subscription access are delivered digitally and activated on your account
              immediately after successful payment signature verification.
            </li>
            <li>
              Because MyMeet provides purely digital software services, there is no physical
              shipping or courier delivery.
            </li>
          </ul>
        </section>

        <section className="public-doc-section">
          <h2>4. Acceptable Use</h2>
          <p>
            You agree not to use MyMeet for unlawful, abusive, harassing, or copyright-infringing
            activity, or to attempt unauthorized access, payment tampering, or automated abuse of
            our video and AI infrastructure. Accounts violating these rules may be suspended.
          </p>
        </section>

        <section className="public-doc-section">
          <h2>5. AI-Generated Notes &amp; Study Material</h2>
          <p>
            AI Master Notes and 20-MCQ revision tests are generated automatically from meeting
            context to help students and teams review faster. While we strive for high accuracy,
            users should verify critical academic, technical, or professional details independently.
          </p>
        </section>

        <section className="public-doc-section">
          <h2>6. Governing Law &amp; Contact</h2>
          <p>
            These terms are governed by the laws of India. For any questions regarding these terms,
            contact us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>
      </article>
    </PublicPageLayout>
  );
}

export function PrivacyPage() {
  return (
    <PublicPageLayout
      eyebrow={`Privacy Policy · Last updated ${LAST_UPDATED}`}
      title="Privacy Policy"
      subtitle="How MyMeet collects, uses, and protects your account, meeting, and billing information."
    >
      <article className="card public-doc-card">
        <section className="public-doc-section">
          <h2>1. Information We Collect</h2>
          <ul>
            <li>
              <strong>Account Information:</strong> Full name, email address, and optional profile
              photo provided during registration.
            </li>
            <li>
              <strong>Meeting &amp; Study Data:</strong> Meeting titles, participant rosters,
              in-meeting chat messages, shared screen snapshots/transcripts used to build your AI
              notes, and MCQ revision scores.
            </li>
            <li>
              <strong>Billing References:</strong> Selected plan code, payment status, and Razorpay
              order/payment reference IDs needed to activate your Pro access.
            </li>
          </ul>
        </section>

        <section className="public-doc-section">
          <h2>2. Payment Data Security</h2>
          <p>
            <strong>
              MyMeet never collects, sees, or stores your credit/debit card numbers, CVV, UPI PIN,
              or netbanking credentials.
            </strong>{' '}
            All checkout transactions are processed directly over encrypted HTTPS by{' '}
            <strong>Razorpay</strong>, a PCI-DSS compliant Indian payment gateway.
          </p>
        </section>

        <section className="public-doc-section">
          <h2>3. How We Use Your Data</h2>
          <ul>
            <li>To authenticate your account and host live HD video meetings.</li>
            <li>To generate and deliver your Basic or Pro AI study notes and MCQ tests.</li>
            <li>To send verification emails, meeting invitations, and subscription receipts.</li>
            <li>To prevent fraud, verify Razorpay payment signatures, and maintain service health.</li>
          </ul>
        </section>

        <section className="public-doc-section">
          <h2>4. Data Sharing &amp; Storage</h2>
          <p>
            We never sell your personal information to third parties. Data is stored securely with
            access controls (Row-Level Security) on trusted cloud infrastructure (Supabase, AWS, and
            Razorpay for billing).
          </p>
        </section>

        <section className="public-doc-section">
          <h2>5. Your Rights &amp; Data Deletion</h2>
          <p>
            You may update your profile details anytime from the Profile page or request complete
            account and data deletion by emailing{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>
      </article>
    </PublicPageLayout>
  );
}

export function RefundPage() {
  return (
    <PublicPageLayout
      eyebrow={`Cancellation & Refund Policy · Last updated ${LAST_UPDATED}`}
      title="Cancellation & Refund Policy"
      subtitle="Clear, fair refund and cancellation terms for MyMeet Pro passes and subscriptions."
    >
      <article className="card public-doc-card">
        <section className="public-doc-section">
          <h2>1. Instant Digital Delivery (No Physical Shipping)</h2>
          <p>
            All MyMeet Pro plans (Single Pass ₹9, 15-Notes Pack ₹49, Pro Monthly ₹349, and Pro
            Yearly ₹899) are purely digital services. Credits and subscription benefits are unlocked
            instantly on your account once Razorpay confirms the payment.
          </p>
        </section>

        <section className="public-doc-section">
          <h2>2. Failed, Declined, or Duplicate Transactions</h2>
          <p>
            If an amount is debited from your bank account or UPI app during a failed, declined, or
            duplicate payment attempt, Razorpay and your issuing bank automatically reverse the
            amount to your original payment source within <strong>5–7 business days</strong>. If it
            does not reflect after 7 business days, email us with your Payment ID and we will
            coordinate immediately with Razorpay support.
          </p>
        </section>

        <section className="public-doc-section">
          <h2>3. Eligible Refund Requests (7-Day Window)</h2>
          <ul>
            <li>
              If you were charged accidentally or faced a verified technical issue that prevented
              you from receiving your Pro plan or credits, please email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link">
                {SUPPORT_EMAIL}
              </a>{' '}
              within <strong>7 days</strong> of the transaction with your registered email and
              Razorpay Payment ID.
            </li>
            <li>
              Once reviewed and approved (typically within 48 business hours), refunds are initiated
              back to the original payment method and credited within{' '}
              <strong>5–7 business days</strong>.
            </li>
            <li>
              Note: Fully consumed one-time Pro Note credits that have already generated and
              delivered Pro Master Notes are generally non-refundable unless there was a billing
              error.
            </li>
          </ul>
        </section>

        <section className="public-doc-section">
          <h2>4. Cancellation Policy</h2>
          <p>
            MyMeet Pro passes and monthly/yearly plans are prepaid and do not auto-debit without
            your action. When your active period expires or credits finish, your account
            automatically returns to the free Basic tier with zero recurring charges. You may also
            request immediate cancellation by contacting{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>
      </article>
    </PublicPageLayout>
  );
}

export function ContactPage() {
  return (
    <PublicPageLayout
      eyebrow="Support & Merchant Details"
      title="Contact Us"
      subtitle="Need help with a meeting, Pro subscription, or payment receipt? Reach out directly and we’ll respond promptly."
    >
      <div className="public-contact-grid">
        <article className="card public-doc-card">
          <h2 style={{ marginTop: 0 }}>Official Merchant &amp; Support Details</h2>
          <dl className="public-contact-list">
            <div>
              <dt>Platform Name</dt>
              <dd>MyMeet (Connect. Collaborate. Together.)</dd>
            </div>
            <div>
              <dt>Operated By</dt>
              <dd>Krishna Kant</dd>
            </div>
            <div>
              <dt>Official Support Email</dt>
              <dd>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link">
                  {SUPPORT_EMAIL}
                </a>
              </dd>
            </div>
            <div>
              <dt>Website</dt>
              <dd>
                <a href={WEBSITE_URL} className="text-link">
                  {WEBSITE_URL}
                </a>
              </dd>
            </div>
            <div>
              <dt>Support Hours</dt>
              <dd>Monday – Saturday, 10:00 AM – 7:00 PM IST (Replies within 24–48 hours)</dd>
            </div>
            <div>
              <dt>Operating Location</dt>
              <dd>India</dd>
            </div>
          </dl>
        </article>

        <article className="card public-doc-card">
          <h2 style={{ marginTop: 0 }}>Payment &amp; Billing Assistance</h2>
          <p className="muted">
            For faster resolution on any Razorpay order, credit activation, or refund inquiry,
            please include the following details in your email:
          </p>
          <ul className="public-doc-list">
            <li>Your registered MyMeet email address</li>
            <li>Razorpay Payment ID (starts with <code>pay_...</code>) or Order ID</li>
            <li>Selected plan name (₹9, ₹49, ₹349, or ₹899) and payment date</li>
          </ul>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('MyMeet Support / Billing Inquiry')}`}
            className="btn btn-primary"
            style={{ marginTop: 14, display: 'inline-flex' }}
          >
            Email Support Team
          </a>
        </article>
      </div>
    </PublicPageLayout>
  );
}
