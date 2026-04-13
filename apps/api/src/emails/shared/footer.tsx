import { Section, Text, Hr } from "@react-email/components";

type EmailFooterProps = {
  language: "nl" | "en";
};

const copy = {
  nl: "Dit is een automatisch bericht van Recruitment OS.",
  en: "This is an automated message from Recruitment OS.",
} as const;

export function EmailFooter({ language }: EmailFooterProps) {
  return (
    <Section style={{ marginTop: "24px" }}>
      <Hr style={{ borderColor: "#e4e4e7" }} />
      <Text
        style={{
          fontSize: "12px",
          color: "#6b7280",
          lineHeight: "1.4",
          margin: "16px 0 0 0",
        }}
      >
        {copy[language]}
      </Text>
    </Section>
  );
}
