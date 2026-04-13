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

type HiringManagerInviteEmailProps = {
  name: string;
  orgName: string;
  inviterName: string;
  portalUrl: string;
  language: "nl" | "en";
};

const copy = {
  nl: {
    subject: (inviterName: string, orgName: string) =>
      `${inviterName} heeft je uitgenodigd voor ${orgName}`,
    greeting: (name: string) => `Hallo ${name},`,
    body: (inviterName: string, orgName: string) =>
      `${inviterName} heeft je uitgenodigd om het Hiring Manager portaal van ${orgName} te gebruiken. Via dit portaal kun je vacatures bekijken en kandidaten beoordelen.`,
    cta: "Naar het portaal",
  },
  en: {
    subject: (inviterName: string, orgName: string) =>
      `${inviterName} invited you to ${orgName}`,
    greeting: (name: string) => `Hi ${name},`,
    body: (inviterName: string, orgName: string) =>
      `${inviterName} has invited you to use the Hiring Manager portal at ${orgName}. Through this portal you can view vacancies and review candidates.`,
    cta: "Go to portal",
  },
} as const;

export function getSubject(
  inviterName: string,
  orgName: string,
  language: "nl" | "en"
): string {
  return copy[language].subject(inviterName, orgName);
}

export function HiringManagerInviteEmail({
  name,
  orgName,
  inviterName,
  portalUrl,
  language,
}: HiringManagerInviteEmailProps) {
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
              {t.body(inviterName, orgName)}
            </Text>
          </Section>
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button
              href={portalUrl}
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
