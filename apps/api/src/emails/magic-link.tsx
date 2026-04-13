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

type MagicLinkEmailProps = {
  name: string;
  orgName: string;
  magicLinkUrl: string;
  language: "nl" | "en";
};

const copy = {
  nl: {
    subject: (orgName: string) => `Inloggen bij ${orgName}`,
    greeting: (name: string) => `Hallo ${name},`,
    body: "Klik op de onderstaande knop om in te loggen. Deze link is eenmalig en verloopt na 15 minuten.",
    cta: "Inloggen",
    expiry: "Deze link verloopt na 15 minuten.",
  },
  en: {
    subject: (orgName: string) => `Sign in to ${orgName}`,
    greeting: (name: string) => `Hi ${name},`,
    body: "Click the button below to sign in. This is a one-time link that expires in 15 minutes.",
    cta: "Sign in",
    expiry: "This link expires in 15 minutes.",
  },
} as const;

export function getSubject(orgName: string, language: "nl" | "en"): string {
  return copy[language].subject(orgName);
}

export function MagicLinkEmail({
  name,
  orgName,
  magicLinkUrl,
  language,
}: MagicLinkEmailProps) {
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
              {t.body}
            </Text>
          </Section>
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button
              href={magicLinkUrl}
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
          <EmailFooter language={language} />
        </Container>
      </Body>
    </Html>
  );
}
