import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacybeleid - Recruitment OS",
  description: "Hoe Recruitment OS omgaat met uw persoonsgegevens.",
};

/**
 * Privacy policy page — GDPR-04.
 * Static server component with Dutch privacy policy content.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Privacybeleid</h1>

      <div className="prose prose-slate max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-slate-900">Wie zijn wij</h2>
          <p className="text-slate-600 mt-2">
            Recruitment OS is een recruitmentplatform voor de transportsector, gericht op het
            efficienter maken van het wervingsproces voor chauffeurs in Nederland en Belgie.
            Wij zijn de verwerkingsverantwoordelijke voor de persoonsgegevens die via ons
            platform worden verwerkt.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">
            Welke gegevens verzamelen wij
          </h2>
          <p className="text-slate-600 mt-2">
            Wij verzamelen de volgende categorieen persoonsgegevens:
          </p>
          <ul className="list-disc pl-6 mt-2 text-slate-600 space-y-1">
            <li>
              <strong>Identiteitsgegevens:</strong> naam, e-mailadres, telefoonnummer
            </li>
            <li>
              <strong>Sollicitatiegegevens:</strong> CV, werkervaring, rijbewijstypen,
              kwalificaties (code 95, ADR, digitachograaf)
            </li>
            <li>
              <strong>Technische gegevens:</strong> IP-adres, browsergegevens, sessiedata
            </li>
            <li>
              <strong>Gebruiksgegevens:</strong> activiteitenlogboek binnen het platform
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">Doel van verwerking</h2>
          <p className="text-slate-600 mt-2">Wij verwerken persoonsgegevens voor:</p>
          <ul className="list-disc pl-6 mt-2 text-slate-600 space-y-1">
            <li>
              Het matchen van kandidaten met vacatures in de transportsector
            </li>
            <li>
              Het beheren van het sollicitatieproces (pipeline, kwalificatie, communicatie)
            </li>
            <li>
              Het versturen van meldingen over sollicitaties en taken
            </li>
            <li>
              Het genereren van rapportages en analyses voor recruiters
            </li>
            <li>
              Het bieden van accountfunctionaliteit en gebruikersbeheer
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">Bewaartermijn</h2>
          <p className="text-slate-600 mt-2">
            Kandidaatgegevens worden bewaard zolang er actief contact is met de kandidaat.
            Na 12 maanden inactiviteit worden kandidaatprofielen automatisch gemarkeerd voor
            beoordeling. Gegevens worden verwijderd op verzoek van de betrokkene of wanneer
            het doel van verwerking is vervallen.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">
            Rechten van betrokkenen
          </h2>
          <p className="text-slate-600 mt-2">
            U heeft op grond van de AVG de volgende rechten:
          </p>
          <ul className="list-disc pl-6 mt-2 text-slate-600 space-y-1">
            <li>
              <strong>Recht op inzage:</strong> u kunt opvragen welke gegevens wij van u
              verwerken
            </li>
            <li>
              <strong>Recht op correctie:</strong> u kunt onjuiste gegevens laten aanpassen
            </li>
            <li>
              <strong>Recht op verwijdering:</strong> u kunt verzoeken uw gegevens te
              verwijderen
            </li>
            <li>
              <strong>Recht op dataportabiliteit:</strong> u kunt een export van uw gegevens
              downloaden via Instellingen &gt; Meldingen in het platform
            </li>
            <li>
              <strong>Recht op bezwaar:</strong> u kunt bezwaar maken tegen de verwerking
              van uw gegevens
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">Cookies</h2>
          <p className="text-slate-600 mt-2">
            Recruitment OS maakt uitsluitend gebruik van functionele cookies die noodzakelijk
            zijn voor de werking van het platform (sessiecookies, voorkeursinstellingen).
            Wij gebruiken geen tracking- of advertentiecookies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
          <p className="text-slate-600 mt-2">
            Voor vragen over ons privacybeleid of het uitoefenen van uw rechten kunt u
            contact opnemen via{" "}
            <a
              href="mailto:privacy@recruitment-os.nl"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              privacy@recruitment-os.nl
            </a>
            .
          </p>
        </section>

        <hr className="border-slate-200" />

        <p className="text-sm text-slate-400">Laatst bijgewerkt: april 2026</p>
      </div>
    </div>
  );
}
