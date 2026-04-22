export const DEFAULT_INTAKE_TEMPLATES = [
  {
    variant: "first_contact",
    locale: "nl",
    name: "Eerste bericht",
    body: "Hoi {{candidate.first_name}}! Je hebt gesolliciteerd bij {{client.name}} voor de functie {{vacancy.title}}. Ik ben de intake-assistent van {{tenant.name}}. Mag ik je een paar vragen stellen zodat we kunnen kijken of er een match is?",
  },
  {
    variant: "reminder_24h",
    locale: "nl",
    name: "Herinnering 24u",
    body: "Hoi {{candidate.first_name}}, ik zag dat je nog niet gereageerd hebt. Wil je nog antwoorden op de vacature {{vacancy.title}}?",
  },
  {
    variant: "reminder_72h",
    locale: "nl",
    name: "Herinnering 72u",
    body: "{{candidate.first_name}}, laatste kans om te reageren op de vacature {{vacancy.title}}. Reageer je niet, dan sluiten we het sollicitatie-dossier.",
  },
  {
    variant: "no_response_farewell",
    locale: "nl",
    name: "Afscheidsbericht",
    body: "Jammer dat we niks meer van je horen. De sollicitatie is gesloten. Je kunt altijd later opnieuw reageren via {{client.name}}.",
  },
] as const;
