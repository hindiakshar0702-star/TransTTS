import { siteUrl, SITE_NAME } from "@/lib/seo";

/**
 * JSON-LD structured data for the landing page. Describes the product as a
 * SoftwareApplication plus the Organization and the site's search-ready
 * identity, which is what Google reads for rich results and knowledge panels.
 *
 * Server component: the script is in the initial HTML, so crawlers see it
 * without executing any JavaScript.
 */
export default function StructuredData() {
  const url = siteUrl();

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${url}/#organization`,
        name: SITE_NAME,
        url,
        logo: `${url}/logo.svg`,
        description:
          "TransTTS is a free AI text-to-speech and voice generator that also transcribes and translates.",
        // Contact is the on-site form; no email is published here, so none is
        // asserted rather than inventing one.
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          url: `${url}/contact`,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        url,
        name: SITE_NAME,
        publisher: { "@id": `${url}/#organization` },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${url}/#app`,
        name: SITE_NAME,
        alternateName: "TransTTS AI Text to Speech",
        url,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web browser",
        description:
          "Free AI text-to-speech and voice generator. Convert text into natural Hindi, English and multilingual AI voices online; also transcribes and translates.",
        featureList: [
          "AI text to speech with natural voices",
          "Free online AI voice generator",
          "Hindi text to speech and Hindi AI voice",
          "Multilingual speech across 15+ languages",
          "Audio and video transcription with Whisper AI",
          "Translation into Hindi, English and 25+ languages",
        ],
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        publisher: { "@id": `${url}/#organization` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Serialised from a literal above — no user input reaches this string.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
