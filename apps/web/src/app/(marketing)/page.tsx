export const dynamic = "force-static";

const employerFeatures = [
  "Werf direct je eigen chauffeurs",
  "Pipeline board met drag-and-drop",
  "Automatische CV-parsing",
  "Hiring manager portal",
];

const agencyFeatures = [
  "Plaats chauffeurs bij klanten",
  "Klantportaal met voortgang",
  "Per-plaatsing facturatie",
  "Multi-client vacatures",
];

const features = [
  {
    title: "Rijbewijs tracking",
    description: "C/CE/code 95/ADR automatisch bijhouden",
  },
  {
    title: "Indeed & Marktplaats",
    description: "Automatische distributie naar jobboards",
  },
  {
    title: "CV parsing met AI",
    description: "Gestructureerde data uit elk CV",
  },
  {
    title: "Realtime samenwerken",
    description: "Pipeline updates live voor het hele team",
  },
  {
    title: "Rapportages",
    description: "Conversie funnel, bron analyse, activiteit",
  },
  {
    title: "Stripe facturatie",
    description: "Per gebruiker, per vacature, per plaatsing",
  },
];

const featureIcons = [
  // License card
  <svg key="license" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" /></svg>,
  // Megaphone
  <svg key="distribution" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38a.75.75 0 01-1.021-.268l-.057-.096a11.68 11.68 0 01-1.76-5.985M10.34 6.66a41.2 41.2 0 019.86-2.41 1.18 1.18 0 011.3 1.175v.297c0 .655-.286 1.279-.786 1.706a38.1 38.1 0 00-3.661 3.553m-7.453-4.32a40.04 40.04 0 013.661 3.553m2.79 4.767a38.1 38.1 0 01-3.661 3.553 1.18 1.18 0 01-1.3 1.175h-.297a1.856 1.856 0 01-1.706-.786 41.2 41.2 0 01-2.41-9.86" /></svg>,
  // Document
  <svg key="cv" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
  // Users
  <svg key="realtime" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>,
  // Chart
  <svg key="reports" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
  // Credit card
  <svg key="billing" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>,
];

export default function MarketingPage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="py-20 sm:py-28 bg-gradient-to-b from-blue-50 to-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight">
            Recruitment OS voor Transport
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto">
            Het complete recruitmentplatform voor chauffeurs. Van vacature tot
            plaatsing, in een systeem.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/register"
              className="rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              Gratis 14 dagen proberen
            </a>
            <a
              href="#demo"
              className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              Demo bekijken
            </a>
          </div>
        </div>
      </section>

      {/* Mode-specific value props */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
            Twee modi, een platform
          </h2>
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Employer mode */}
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 mb-4">
                Werkgever
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                Voor werkgevers
              </h3>
              <p className="text-slate-600 mb-6">
                Werf chauffeurs voor je eigen transportbedrijf. Alles in een
                systeem, van vacature tot contract.
              </p>
              <ul className="space-y-3">
                {employerFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    <span className="text-slate-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Agency mode */}
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700 mb-4">
                Uitzendbureau
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                Voor uitzendbureaus
              </h3>
              <p className="text-slate-600 mb-6">
                Plaats chauffeurs bij transportbedrijven. Klantportaal,
                facturatie en multi-client beheer ingebouwd.
              </p>
              <ul className="space-y-3">
                {agencyFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    <span className="text-slate-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-16 sm:py-20 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">
            Alles wat je nodig hebt
          </h2>
          <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            Gebouwd voor de transportbranche. Van rijbewijs tracking tot
            jobboard distributie.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="rounded-xl bg-white p-6 shadow-sm border border-slate-200"
              >
                <div className="mb-4">{featureIcons[index]}</div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo section */}
      <section id="demo" className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">
            Bekijk de demo
          </h2>
          <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            Probeer Recruitment OS met realistische transportdata. Twee demo
            omgevingen, een voor elke modus.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Employer demo */}
            <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-8 text-center">
              <div className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 mb-4">
                Werkgever
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Demo Werkgever
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                demo-employer.recruitment-os.nl
              </p>
              <div className="rounded-lg bg-white p-4 text-left text-sm mb-4">
                <p className="text-slate-500 mb-1">Inloggegevens:</p>
                <p className="font-mono text-slate-900">
                  demo@recruitment-os.nl
                </p>
                <p className="font-mono text-slate-900">demo2026</p>
              </div>
              <a
                href="https://demo-employer.recruitment-os.nl"
                className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Open demo
              </a>
            </div>

            {/* Agency demo */}
            <div className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-8 text-center">
              <div className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700 mb-4">
                Uitzendbureau
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Demo Uitzendbureau
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                demo-agency.recruitment-os.nl
              </p>
              <div className="rounded-lg bg-white p-4 text-left text-sm mb-4">
                <p className="text-slate-500 mb-1">Inloggegevens:</p>
                <p className="font-mono text-slate-900">
                  demo@recruitment-os.nl
                </p>
                <p className="font-mono text-slate-900">demo2026</p>
              </div>
              <a
                href="https://demo-agency.recruitment-os.nl"
                className="inline-block rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
              >
                Open demo
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-12 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-500 text-sm uppercase tracking-wider font-medium">
            Gebouwd voor Simon Loos, Upply Jobs, en meer
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-20 bg-blue-600">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Start vandaag
          </h2>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto">
            14 dagen gratis proberen. Geen creditcard nodig. Direct aan de slag
            met het werven van chauffeurs.
          </p>
          <a
            href="/register"
            className="inline-block rounded-lg bg-white px-6 py-3 text-base font-semibold text-blue-600 shadow-sm hover:bg-blue-50 transition-colors"
          >
            Gratis account aanmaken
          </a>
        </div>
      </section>
    </div>
  );
}
