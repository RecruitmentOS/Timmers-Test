// SEC-02: Sentry Alerting Configuration
// After creating your Sentry project, configure these alerts in the Sentry dashboard:
// 1. Alert Rule: "Error Rate Spike"
//    - Condition: Number of events > 50 in 5 minutes
//    - Action: Send webhook to Slack/Discord webhook URL
// 2. Alert Rule: "New Issue"
//    - Condition: First seen event for any new issue
//    - Action: Send notification to project team
// Configure at: https://sentry.io/settings/{org}/alerts/

import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: 0.1,
  enabled: !!process.env.SENTRY_DSN,
});

export { Sentry };
