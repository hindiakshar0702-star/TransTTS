/**
 * Human-readable content for the homepage: what the tool is, the jobs it does,
 * and the languages it covers. It exists so a reader — and a crawler — can tell
 * within a few lines that TransTTS is an AI text-to-speech and voice generator,
 * without keyword stuffing. The headings are the search intents the page
 * targets; the prose under each is written for a person first.
 *
 * These are h2s beneath the single hero h1, keeping one primary heading on the
 * page.
 */

const LANGUAGES = [
  "Hindi",
  "English",
  "Bengali",
  "Tamil",
  "Telugu",
  "Marathi",
  "Gujarati",
  "Urdu",
  "Spanish",
  "French",
  "German",
  "Japanese",
  "Arabic",
  "Portuguese",
];

export default function SeoContent() {
  return (
    <section className="seo-content" aria-labelledby="seo-what-is">
      <div className="landing-container">
        <div className="seo-content-grid">
          <article>
            <h2 id="seo-what-is">What is TransTTS?</h2>
            <p>
              TransTTS is a free, AI-powered text to speech platform that turns
              written text into natural-sounding speech. Use it to create AI
              voiceovers for videos, presentations, e-learning, social media and
              accessibility — straight from your browser, with no software to
              install and no account to create.
            </p>
          </article>

          <article>
            <h2>AI Text to Speech Online</h2>
            <p>
              Paste your script, pick a voice, and generate realistic
              AI-generated speech in seconds. TransTTS runs entirely online, so
              you can produce a voiceover and download the audio without complex
              editing tools or sign-ups.
            </p>
          </article>

          <article>
            <h2>Hindi Text to Speech</h2>
            <p>
              Create natural Hindi AI voiceovers from Hindi text. TransTTS offers
              clear male and female Hindi voices for narration, tutorials and
              content in Devanagari, making it a practical Hindi text-to-speech
              and Hindi AI voice tool.
            </p>
          </article>

          <article>
            <h2>Multilingual AI Voice Generator</h2>
            <p>
              Beyond Hindi and English, TransTTS generates speech across many
              languages, so one tool covers most of your audience:
            </p>
            <ul className="seo-lang-list">
              {LANGUAGES.map((lang) => (
                <li key={lang}>{lang}</li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
