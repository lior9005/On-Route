// PreToolUse hook for mcp__Gmail__send_message.
// Approves only the daily Google Cloud usage alert: a plain email to the
// owner with a "Google Cloud usage" subject. Anything else is left to the
// normal permission check.
let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(raw).tool_input || {};
  } catch {
    return;
  }
  const to = input.to || [];
  const isAlert =
    to.length === 1 &&
    to[0].toLowerCase() === "liorsharony@gmail.com" &&
    !(input.cc || []).length &&
    !(input.bcc || []).length &&
    !(input.attachments || []).length &&
    !input.draftId &&
    typeof input.subject === "string" &&
    input.subject.startsWith("Google Cloud usage");
  if (!isAlert) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        permissionDecisionReason: "Daily Google Cloud usage alert to the owner",
      },
    }),
  );
});
