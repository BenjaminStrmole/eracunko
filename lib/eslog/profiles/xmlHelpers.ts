function isPresent(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function escapeProfileXml(value: string | number | undefined | null) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function profileTag(name: string, value: string | number | undefined | null) {
  if (!isPresent(value)) return "";
  return `<${name}>${escapeProfileXml(value)}</${name}>`;
}

export function profileSegment(name: string, body: string) {
  const content = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  if (!content) return "";

  return `<${name}>\n${content}\n</${name}>`;
}

export function buildProfileFreeText(subject: string, value?: string) {
  if (!isPresent(value)) return "";

  return profileSegment(
    "S_FTX",
    `
      ${profileTag("D_4451", subject)}
      ${profileSegment("C_C108", profileTag("D_4440", value))}
    `
  );
}

export function insertProfileExtension(xml: string, extension: string) {
  if (!extension.trim()) return xml;

  const insertionPoint = ["<G_SG1>", "<G_SG2>", "<G_SG7>"]
    .map((tag) => ({ tag, index: xml.indexOf(tag) }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index)[0];

  if (!insertionPoint) return xml;

  return xml.replace(
    `    ${insertionPoint.tag}`,
    `    ${extension.trim()}\n\n    ${insertionPoint.tag}`
  );
}
