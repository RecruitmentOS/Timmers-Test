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

type PasswordResetEmailProps = {
  name: string;
  resetUrl: string;
  language: "nl" | "en";
};

const copy = {
  nl: {
    subject: "Wachtwoord herstellen - Recruitment OS",
    greeting: (name: string) => `Hallo ${name},`,
    body: "We hebben een verzoek ontvangen om je wachtwoord te herstellen. Klik op de onderstaande knop om een nieuw wachtwoord in te stellen.",
    cta: "Wachtwoord herstellen",
    expiry: "Deze link verloopt na 1 uur.",
    disclaimer:
      "Als je dit niet hebt aangevraagd, kun je deze e-mail veilig negeren. Je wachtwoord blijft ongewijzigd.",
  },
  en: {
    subject: "Reset your password - Recruitment OS",
    greeting: (name: string) => `Hi ${name},`,
    body: "We received a request to reset your password. Click the button below to set a new password.",
    cta: "Reset password",
    expiry: "This link expires in 1 hour.",
    disclaimer:
      "If you did not request this, you can safely ignore this email. Your password will remain unchanged.",
  },
} as const;

export function getSubject(language: "nl" | "en"): string {
  return copy[language].subject;
}

export function PasswordResetEmail({
  name,
  resetUrl,
  language,
}: PasswordResetEmailProps) {
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
          <EmailHeader language={language} />
          <Section>
            <Text style={{ fontSize: "16px", lineHeight: "1.5", color: "#18181b" }}>
              {t.greeting(name)}
            </Text>
            <Text style={{ fontSize: "16px", lineHeight: "1.5", color: "#18181b" }}>
              {t.body}
            </Text>
          </Section>
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button
              href={resetUrl}
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
          <Text style={{ fontSize: "13px", color: "#6b7280", textAlign: "center" }}>
            {t.expiry}
          </Text>
          <Text style={{ fontSize: "13px", color: "#6b7280", textAlign: "center" }}>
            {t.disclaimer}
          </Text>
          <EmailFooter language={language} />
        </Container>
      </Body>
    </Html>
  );
}
