// lib/notify.ts — console email-preview (no email provider needed for the demo).
// If RESEND_API_KEY is ever set, swap the console block for a real send.
export async function notify(subject: string, body: string) {
  console.log(
    [
      "",
      "  ┌─ 📬 email preview ─────────────────────────────",
      `  │ To:      you`,
      `  │ Subject: ${subject}`,
      `  │`,
      `  │ ${body}`,
      "  └────────────────────────────────────────────────",
      "",
    ].join("\n")
  );
}
