import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
} from "@react-email/components";
import { EmailHeader } from "./shared/header.js";
import { EmailFooter } from "./shared/footer.js";

type WelcomeEmailProps = {
  name: string;
  orgName: string;
  loginUrl: string;
  language: "nl" | "en";
};

const copy = {
  nl: {
    subject: (orgName: string) => `Welkom bij ${orgName} op Recruitment OS`,
    greeting: (name: string) => `Hallo ${name},`,
    body: (orgName: string) =>
      `Je account bij ${orgName} op Recruitment OS is aangemaakt. Recruitment OS is het platform waarmee je team vacatures, kandidaten en het hele wervingsproces beheert.`,
    cta: "Inloggen",
  },
  en: {
    subject: (orgName: string) => `Welcome to ${orgName} on Recruitment OS`,
    greeting: (name: string) => `Hi ${name},`,
    body: (orgName: string) =>
      `Your account at ${orgName} on Recruitment OS has been created. Recruitment OS is the platform your team uses to manage vacancies, candidates, and the entire recruitment process.`,
    cta: "Sign in",
  },
} as const;

export function getSubject(orgName: string, language: "nl" | "en"): string {
  return copy[language].subject(orgName);
}

export function WelcomeEmail({
  name,
  orgName,
  loginUrl,
  language,
}: WelcomeEmailProps) {
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
              {t.greeting(name)}
            </Text>
            <Text style={{ fontSize: "16px", lineHeight: "1.5", color: "#18181b" }}>
              {t.body(orgName)}
            </Text>
          </Section>
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button
              href={loginUrl}
              style={{
                backgroundColor: "#0f172a",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "600",
                textDecoration: "none",
              }}
            >
              {t.cta}
            </Button>
          </Section>
          <EmailFooter language={language} />
        </Container>
      </Body>
    </Html>
  );
}
