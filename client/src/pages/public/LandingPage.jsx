import { Link } from 'react-router-dom';
import {
  ArrowDown, ArrowRight, Bell, Check, ClipboardCheck, FileText,
  GraduationCap, LayoutDashboard, ShieldCheck, Upload, Workflow,
} from 'lucide-react';

const features = [
  {
    Icon: FileText,
    title: 'Online academic requests',
    description: 'Submit attendance corrections, event credit, medical leave, and academic grievances in one place.',
  },
  {
    Icon: Upload,
    title: 'Supporting documents',
    description: 'Attach relevant evidence to a request and share it securely with its authorized reviewers.',
  },
  {
    Icon: Workflow,
    title: 'Transparent approval tracking',
    description: 'Follow the current status, reviewer remarks, and recorded approval history.',
  },
  {
    Icon: LayoutDashboard,
    title: 'Role-based dashboards',
    description: 'Students, staff, and administrators get views suited to their responsibilities.',
  },
  {
    Icon: Bell,
    title: 'Useful notifications',
    description: 'See updates when a request is submitted, assigned, returned, or reviewed.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Submit a request',
    description: 'Choose a category, explain the issue, and attach documents when needed.',
  },
  {
    number: '02',
    title: 'Faculty reviews it',
    description: 'The request is sent to the staff member assigned to the next approval stage.',
  },
  {
    number: '03',
    title: 'Follow its progress',
    description: 'Check the request status and review notes from your dashboard.',
  },
  {
    number: '04',
    title: 'Receive the outcome',
    description: 'See the final decision or make corrections if the request is returned.',
  },
];

const benefits = [
  'Less paperwork and fewer office visits',
  'Clearer communication between students and faculty',
  'A visible history of decisions and remarks',
  'Academic requests organized in one system',
];

const currentYear = new Date().getFullYear();

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8" aria-label="Main navigation">
          <a href="#home" className="flex items-center gap-2.5" aria-label="CampusFlow home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <GraduationCap size={23} />
            </span>
            <span className="text-lg font-bold tracking-tight">CampusFlow</span>
          </a>

          <div className="hidden items-center gap-8 md:flex">
            <a className="text-sm font-medium text-slate-600 hover:text-indigo-700" href="#home">Home</a>
            <a className="text-sm font-medium text-slate-600 hover:text-indigo-700" href="#features">Features</a>
            <a className="text-sm font-medium text-slate-600 hover:text-indigo-700" href="#how-it-works">How it works</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              Login
            </Link>
            <Link to="/register" className="btn-primary btn-sm sm:px-4 sm:py-2.5">
              Get started <ArrowRight size={15} />
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section id="home" className="relative overflow-hidden bg-slate-50">
          <div className="pointer-events-none absolute -right-36 -top-32 h-96 w-96 rounded-full bg-indigo-100/70 blur-3xl" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 md:py-28 lg:grid-cols-2 lg:px-8">
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3.5 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm">
                <ShieldCheck size={14} /> Academic requests, made simpler
              </span>
              <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Your Academic Requests, <span className="text-indigo-600">Simplified.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                Submit academic requests online, share supporting documents, and follow each review from one convenient campus portal.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/register" className="btn-primary btn-lg">
                  Get started <ArrowRight size={17} />
                </Link>
                <Link to="/login" className="btn-secondary btn-lg">
                  Login to CampusFlow
                </Link>
              </div>
              <a href="#features" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-700">
                Explore the platform <ArrowDown size={15} />
              </a>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-4 rounded-[2rem] bg-indigo-100/70 blur-2xl" />
              <div className="relative rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/10 sm:p-7">
                <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                      <ClipboardCheck size={22} />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Request progress</p>
                      <p className="mt-0.5 text-xs text-slate-500">A clear view of each review stage</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Trackable</span>
                </div>

                <div className="py-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Medical leave approval</p>
                  <div className="mt-5 space-y-0">
                    {[
                      ['Class Coordinator', true],
                      ['Mentor', true],
                      ['Head of Department', false],
                      ['Dean', false],
                    ].map(([label, complete], index) => (
                      <div key={label} className="flex min-h-14 items-start gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${complete ? 'bg-indigo-600 text-white' : 'border-2 border-slate-200 bg-white text-slate-400'}`}>
                            {complete ? <Check size={14} /> : <span className="text-xs font-semibold">{index + 1}</span>}
                          </span>
                          {index < 3 && <span className={`h-7 w-0.5 ${complete ? 'bg-indigo-200' : 'bg-slate-200'}`} />}
                        </div>
                        <p className={`pt-1.5 text-sm font-medium ${complete ? 'text-slate-800' : 'text-slate-400'}`}>{label}</p>
                        {complete && <span className="ml-auto pt-1.5 text-xs font-medium text-indigo-600">Reviewed</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
                    <Bell size={17} />
                  </span>
                  <p className="text-xs leading-5 text-slate-600">Request updates and reviewer remarks are available from your dashboard.</p>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-lg sm:flex">
                <ShieldCheck size={17} className="text-emerald-600" /> Role-based access
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 px-5 py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">One place for campus requests</span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Everything you need to move a request forward</h2>
              <p className="mt-4 leading-7 text-slate-600">A straightforward process for students and a clear review workspace for faculty and administrators.</p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ Icon, title, description }) => (
                <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-lg hover:shadow-slate-900/5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                    <Icon size={21} />
                  </span>
                  <h3 className="mt-5 text-base font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 bg-slate-50 px-5 py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">A clear process</span>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">How CampusFlow works</h2>
                <p className="mt-4 leading-7 text-slate-600">From submission to final decision, each request stays organized and easy to follow.</p>
                <Link to="/register" className="btn-primary mt-7">
                  Create a student account <ArrowRight size={16} />
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {steps.map((step) => (
                  <article key={step.number} className="rounded-2xl border border-slate-200 bg-white p-6">
                    <span className="text-xs font-bold tracking-widest text-indigo-600">{step.number}</span>
                    <h3 className="mt-3 text-base font-bold text-slate-900">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 rounded-3xl bg-indigo-950 px-7 py-10 text-white sm:px-10 lg:grid-cols-2 lg:items-center lg:px-14 lg:py-14">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">A better campus experience</span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Less paperwork. More clarity.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-indigo-100/80">CampusFlow brings common academic requests and their review history together, helping students and staff stay informed.</p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm leading-6 text-indigo-50">
                  <Check size={17} className="mt-0.5 shrink-0 text-emerald-300" /> {benefit}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-5 py-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-md">
            <a href="#home" className="inline-flex items-center gap-2 font-bold text-slate-900">
              <GraduationCap size={20} className="text-indigo-600" /> CampusFlow
            </a>
            <p className="mt-2 text-xs leading-5 text-slate-500">A simple digital space for submitting and tracking college academic requests.</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-indigo-700">Features</a>
            <a href="#how-it-works" className="hover:text-indigo-700">How it works</a>
            <Link to="/login" className="hover:text-indigo-700">Login</Link>
            <Link to="/register" className="hover:text-indigo-700">Get started</Link>
          </div>
          <p className="text-xs text-slate-400">© {currentYear} CampusFlow</p>
        </div>
      </footer>
    </div>
  );
}
