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

type TeamInviteEmailProps = {
  name: string;
  orgName: string;
  inviterName: string;
  acceptUrl: string;
  role: string;
  language: "nl" | "en";
};

const copy = {
  nl: {
    subject: (orgName: string) =>
      `Je bent uitgenodigd om deel te nemen aan ${orgName}`,
    greeting: (name: string) => `Hallo ${name},`,
    body: (inviterName: string, orgName: string, role: string) =>
      `${inviterName} heeft je uitgenodigd om als ${role} deel te nemen aan ${orgName}. Klik op de onderstaande knop om de uitnodiging te accepteren en je account aan te maken.`,
    cta: "Uitnodiging accepteren",
  },
  en: {
    subject: (orgName: string) =>
      `You've been invited to join ${orgName}`,
    greeting: (name: string) => `Hi ${name},`,
    body: (inviterName: string, orgName: string, role: string) =>
      `${inviterName} has invited you to join ${orgName} as a ${role}. Click the button below to accept the invitation and create your account.`,
    cta: "Accept invitation",
  },
} as const;

export function getSubject(orgName: string, language: "nl" | "en"): string {
  return copy[language].subject(orgName);
}

export function TeamInviteEmail({
  name,
  orgName,
  inviterName,
  acceptUrl,
  role,
  language,
}: TeamInviteEmailProps) {
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
              {t.body(inviterName, orgName, role)}
            </Text>
          </Section>
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button
              href={acceptUrl}
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
