const GMAIL_IDENTITY_DOMAINS = new Set(["gmail.com", "googlemail.com"]);
const PLUS_ADDRESSING_IDENTITY_DOMAINS = new Set([
  "fastmail.com",
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "mac.com",
  "me.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "yahoo.com",
  "zoho.com",
]);

export const normalizeBuyerEmail = (email: string): string => {
  const trimmedEmail = email.trim().toLowerCase();
  const separatorIndex = trimmedEmail.lastIndexOf("@");
  if (separatorIndex < 0) {
    return trimmedEmail;
  }

  let localPart = trimmedEmail.slice(0, separatorIndex);
  let domain = trimmedEmail.slice(separatorIndex + 1);
  if (domain === "googlemail.com") {
    domain = "gmail.com";
  }
  if (PLUS_ADDRESSING_IDENTITY_DOMAINS.has(domain)) {
    localPart = localPart.split("+", 1)[0] ?? localPart;
  }
  if (GMAIL_IDENTITY_DOMAINS.has(domain)) {
    localPart = localPart.replaceAll(".", "");
  }

  return `${localPart}@${domain}`;
};

export type GoogleEmailCandidateResolution =
  | { kind: "ambiguous" }
  | { kind: "none" }
  | { kind: "unique"; userId: string };

export const resolveGoogleEmailCandidate = ({
  candidates,
  googleEmail,
}: {
  candidates: readonly { email: string; userId: string }[];
  googleEmail: string;
}): GoogleEmailCandidateResolution => {
  const normalizedGoogleEmail = normalizeBuyerEmail(googleEmail);
  const exactGoogleEmail = googleEmail.trim().toLowerCase();
  const matchingUserIds = new Set(
    candidates
      .filter(
        (candidate) =>
          candidate.email.trim().toLowerCase() === exactGoogleEmail ||
          normalizeBuyerEmail(candidate.email) === normalizedGoogleEmail
      )
      .map((candidate) => candidate.userId)
  );

  if (matchingUserIds.size > 1) {
    return { kind: "ambiguous" };
  }

  const [userId] = matchingUserIds;
  return userId ? { kind: "unique", userId } : { kind: "none" };
};
