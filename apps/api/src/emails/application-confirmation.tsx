import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
} from "@react-email/components";
import { EmailHeader } from "./shared/header.js";
import { EmailFooter } from "./shared/footer.js";

type ApplicationConfirmationEmailProps = {
  candidateName: string;
  vacancyTitle: string;
  orgName: string;
  language: "nl" | "en";
};

const copy = {
  nl: {
    subject: (orgName: string) =>
      `Bedankt voor je sollicitatie bij ${orgName}`,
    greeting: (name: string) => `Hallo ${name},`,
    body: (vacancyTitle: string, orgName: string) =>
      `Bedankt voor je sollicitatie op de functie "${vacancyTitle}" bij ${orgName}. We hebben je gegevens ontvangen.`,
    nextSteps:
      "We nemen je sollicitatie zo snel mogelijk in behandeling. Je hoort van ons zodra er een update is.",
  },
  en: {
    subject: (orgName: string) =>
      `Thank you for your application at ${orgName}`,
    greeting: (name: string) => `Hi ${name},`,
    body: (vacancyTitle: string, orgName: string) =>
      `Thank you for applying for the "${vacancyTitle}" position at ${orgName}. We have received your details.`,
    nextSteps:
      "We will review your application as soon as possible. You will hear from us when there is an update.",
  },
} as const;

export function getSubject(orgName: string, language: "nl" | "en"): string {
  return copy[language].subject(orgName);
}

export function ApplicationConfirmationEmail({
  candidateName,
  vacancyTitle,
  orgName,
  language,
}: ApplicationConfirmationEmailProps) {
  const t = copy[language];

  return (
    <Html lang={language}>
      <Head />
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f4f4f5" }}>
        <Container
          style={{
            maxWidth: "480px",
            margin: "0 auto",
            padding: "32px 24px",
            backgroundColor: "#ffffff",
            borderRadius: "8px",
          }}
        >
          <EmailHeader orgName={orgName} language={language} />
          <Section>
            <Text style={{ fontSize: "16px", lineHeight: "1.5", color: "#18181b" }}>
              {t.greeting(candidateName)}
            </Text>
            <Text style={{ fontSize: "16px", lineHeight: "1.5", color: "#18181b" }}>
              {t.body(vacancyTitle, orgName)}
            </Text>
            <Text style={{ fontSize: "16px", lineHeight: "1.5", color: "#18181b" }}>
              {t.nextSteps}
            </Text>
          </Section>
          <EmailFooter language={language} />
        </Container>
      </Body>
    </Html>
  );
}
