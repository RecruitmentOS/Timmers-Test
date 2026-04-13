import { Section, Text, Hr } from "@react-email/components";

type EmailHeaderProps = {
  orgName?: string;
  language: "nl" | "en";
};

export function EmailHeader({ orgName, language }: EmailHeaderProps) {
  return (
    <Section style={{ marginBottom: "24px" }}>
      <Text
        style={{
          fontSize: "20px",
          fontWeight: "bold",
          color: "#0f172a",
          margin: "0 0 4px 0",
        }}
      >
        Recruitment OS
      </Text>
      {orgName && (
        <Text
          style={{
            fontSize: "14px",
            color: "#6b7280",
            margin: "0 0 16px 0",
          }}
        >
          {orgName}
        </Text>
      )}
      <Hr style={{ borderColor: "#e4e4e7" }} />
    </Section>
  );
}
