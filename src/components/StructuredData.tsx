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
          "TransTTS builds speech and language tools: audio transcription, translation and AI voice generation.",
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: "hello@transtts.ai",
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
        url,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web browser",
        description:
          "Record audio, transcribe speech to text with Whisper AI, translate into Hindi and 99+ languages, and generate natural AI voices.",
        featureList: [
          "Audio and video transcription with timestamps",
          "Automatic language detection across 99+ languages",
          "Translation including English to Hindi",
          "Text-to-speech with natural voices",
          "Browser voice recorder with teleprompter",
          "Transcribe videos from social media links",
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
