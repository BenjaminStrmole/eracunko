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

  return xml.replace(
    "\n    <S_UNS>",
    `\n    ${extension.trim()}\n\n    <S_UNS>`
  );
}

