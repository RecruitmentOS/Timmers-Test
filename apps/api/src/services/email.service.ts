import { Resend } from "resend";
import { render } from "@react-email/components";
import { WelcomeEmail, getSubject as welcomeSubject } from "../emails/welcome.js";
import { MagicLinkEmail, getSubject as magicLinkSubject } from "../emails/magic-link.js";
import {
  ApplicationConfirmationEmail,
  getSubject as applicationSubject,
} from "../emails/application-confirmation.js";
import {
  HiringManagerInviteEmail,
  getSubject as hmInviteSubject,
} from "../emails/hiring-manager-invite.js";
import { PasswordResetEmail, getSubject as passwordResetSubject } from "../emails/password-reset.js";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "Recruitment OS <noreply@recruitment-os.nl>";

type SendResult = { sent: boolean; to: string; subject: string };

async function send(
  to: string,
  subject: string,
  html: string,
  template: string
): Promise<SendResult> {
  if (resend) {
    await resend.emails.send({ from: FROM, to, subject, html });
    return { sent: true, to, subject };
  }

  console.log("[email] DORMANT — would send:", { to, subject, template });
  return { sent: false, to, subject };
}

export const emailService = {
  async sendWelcome(
    to: string,
    props: { name: string; orgName: string; loginUrl: string; language: "nl" | "en" }
  ): Promise<SendResult> {
    const subject = welcomeSubject(props.orgName, props.language);
    const html = await render(
      WelcomeEmail({
        name: props.name,
        orgName: props.orgName,
        loginUrl: props.loginUrl,
        language: props.language,
      })
    );
    return send(to, subject, html, "welcome");
  },

  async sendMagicLink(
    to: string,
    props: {
      name: string;
      orgName: string;
      magicLinkUrl: string;
      language: "nl" | "en";
    }
  ): Promise<SendResult> {
    const subject = magicLinkSubject(props.orgName, props.language);
    const html = await render(
      MagicLinkEmail({
        name: props.name,
        orgName: props.orgName,
        magicLinkUrl: props.magicLinkUrl,
        language: props.language,
      })
    );
    return send(to, subject, html, "magic-link");
  },

  async sendApplicationConfirmation(
    to: string,
    props: {
      candidateName: string;
      vacancyTitle: string;
      orgName: string;
      language: "nl" | "en";
    }
  ): Promise<SendResult> {
    const subject = applicationSubject(props.orgName, props.language);
    const html = await render(
      ApplicationConfirmationEmail({
        candidateName: props.candidateName,
        vacancyTitle: props.vacancyTitle,
        orgName: props.orgName,
        language: props.language,
      })
    );
    return send(to, subject, html, "application-confirmation");
  },

  async sendHiringManagerInvite(
    to: string,
    props: {
      name: string;
      orgName: string;
      inviterName: string;
      portalUrl: string;
      language: "nl" | "en";
    }
  ): Promise<SendResult> {
    const subject = hmInviteSubject(props.inviterName, props.orgName, props.language);
    const html = await render(
      HiringManagerInviteEmail({
        name: props.name,
        orgName: props.orgName,
        inviterName: props.inviterName,
        portalUrl: props.portalUrl,
        language: props.language,
      })
    );
    return send(to, subject, html, "hiring-manager-invite");
  },

  async sendPasswordReset(
    to: string,
    props: { name: string; resetUrl: string; language: "nl" | "en" }
  ): Promise<SendResult> {
    const subject = passwordResetSubject(props.language);
    const html = await render(
      PasswordResetEmail({
        name: props.name,
        resetUrl: props.resetUrl,
        language: props.language,
      })
    );
    return send(to, subject, html, "password-reset");
  },
};
