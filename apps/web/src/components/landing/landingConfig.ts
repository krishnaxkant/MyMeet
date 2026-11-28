export const OFFICIAL_LICENCE = {
  published: false,
  name: 'MyMeet Software Licence',
  description:
    'Official licensing documentation for the MyMeet web and mobile platform. This link activates automatically once the formal licence document is published.',
  url: '',
} as const;

export const SOCIAL_LINKS: Array<{ label: string; href: string }> = [
  { label: 'GitHub', href: 'https://github.com/krishnaxkant/MyMeet' },
];

export interface LandingFaqItem {
  question: string;
  answer: string;
}

export const LANDING_FAQS: LandingFaqItem[] = [
  {
    question: 'What is MyMeet?',
    answer:
      'MyMeet is an intelligent video meeting and collaboration workspace for Web and Android. Beyond HD video calls, screen sharing, and live chat, it automatically transforms sessions into AI visual notes, structured Pro Master Notes, and 20-question revision assessments.',
  },
  {
    question: 'How is MyMeet different from traditional meeting platforms?',
    answer:
      'Traditional tools stop when the call ends. MyMeet continues working after the session — filtering out small talk, capturing key explanations and shared screens, organizing structured study notes, and generating revision MCQs so important knowledge stays with you.',
  },
  {
    question: 'Can I create a meeting for free?',
    answer:
      'Yes. The Basic tier is free forever and includes HD video and audio meetings, screen sharing, waiting-room host controls, real-time chat, scheduling, meeting history, and automatic Basic AI Visual Notes with PDF and PNG export.',
  },
  {
    question: 'How do AI-generated visual notes work?',
    answer:
      'During a live session, MyMeet captures spoken session context and shared screen snapshots when enabled. Once the host ends the meeting, AI organizes the core takeaways into clean, readable visual study slides automatically.',
  },
  {
    question: 'Can I download my meeting notes?',
    answer:
      'Yes. Basic AI Visual Notes can be downloaded as PNG slides or printable PDFs. Pro Master Notes support clean HD printable PDF export and remain permanently accessible in your Meeting History.',
  },
  {
    question: 'What are Pro Master Notes?',
    answer:
      'Pro Master Notes are deep, editorial-grade study documents generated from your meeting — complete with structured headings, code blocks, formulas, derivations, comparison tables, exam and interview traps, and a 1-minute rapid revision cheat sheet.',
  },
  {
    question: 'How do the 20-question MCQ assessments work?',
    answer:
      'Included with Pro Monthly (₹349/mo) and Pro Yearly (₹899/yr), MyMeet generates a 20-question progressive Easy-to-Hard revision quiz tailored to each ended session, with instant answer explanations, retakes, and a host participant scorecard.',
  },
  {
    question: 'Can I use MyMeet on my mobile device?',
    answer:
      'Yes. MyMeet works across desktop and mobile browsers on the Web, as well as the native MyMeet Android app — using the exact same account, history, notes, and Pro subscription.',
  },
  {
    question: 'How do I schedule or join a meeting?',
    answer:
      'Sign in or continue with Google, then click "New Meeting" for an instant room with a shareable code, "Join" to enter an existing meeting code, or open the Schedule tab to plan upcoming sessions and send email invites.',
  },
  {
    question: 'How does MyMeet handle my meeting data?',
    answer:
      'Meeting metadata, messages, and generated notes are stored with database Row-Level Security so only authorized participants can view their sessions. Payment details are never stored by MyMeet — all checkouts run securely through Razorpay.',
  },
  {
    question: 'What is included in MyMeet Pro?',
    answer:
      'You can try Pro Master Notes on a single class for ₹9 or get a 15-class pack for ₹49. Pro Monthly (₹349/mo) and Pro Yearly (₹899/yr) unlock Unlimited Pro Master Notes, 20-MCQ Session Revision Tests, unlimited regenerations, priority AI, HD PDF export, and the luxury Pro workspace theme.',
  },
  {
    question: 'Where can I view the official software licence?',
    answer:
      'Our Transparency & Legal section links to our Terms of Service, Privacy Policy, Refund Policy, and Contact Support. The official Software Licence card is maintained there and will link directly once formally published.',
  },
];
