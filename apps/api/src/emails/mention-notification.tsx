import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
} from "@react-email/components";

type MentionNotificationProps = {
  authorName: string;
  commentBody: string;
  language: "nl" | "en";
};

const copy = {
  nl: {
    subject: (author: string) =>
      `${author} heeft je genoemd in een reactie`,
    body: (author: string) =>
      `${author} heeft je genoemd in een reactie op Recruitment OS.`,
    quote: "Reactie:",
    footer: "Je ontvangt dit bericht omdat je bent genoemd met @.",
  },
  en: {
    subject: (author: string) => `${author} mentioned you in a comment`,
    body: (author: string) =>
      `${author} mentioned you in a comment on Recruitment OS.`,
    quote: "Comment:",
    footer: "You received this email because you were mentioned with @.",
  },
} as const;

export function getSubject(authorName: string, language: "nl" | "en"): string {
  return copy[language].subject(authorName);
}

export function MentionNotification({
  authorName,
  commentBody,
  language,
}: MentionNotificationProps) {
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
          <Text style={{ fontSize: "16px", lineHeight: "1.5", color: "#18181b" }}>
            {t.body(authorName)}
          </Text>
          <Section
            style={{
              borderLeft: "3px solid #6366f1",
              paddingLeft: "16px",
              margin: "16px 0",
            }}
          >
            <Text style={{ fontSize: "14px", color: "#52525b", margin: 0 }}>
              {t.quote}
            </Text>
            <Text
              style={{
                fontSize: "14px",
                color: "#18181b",
                lineHeight: "1.5",
                whiteSpace: "pre-wrap",
              }}
            >
              {commentBody.slice(0, 300)}
              {commentBody.length > 300 ? "..." : ""}
            </Text>
          </Section>
          <Hr style={{ borderColor: "#e4e4e7" }} />
          <Text style={{ fontSize: "12px", color: "#a1a1aa" }}>
            {t.footer}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
