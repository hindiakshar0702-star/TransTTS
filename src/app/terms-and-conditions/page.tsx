"use client";

import "../landing.css";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";

export default function TermsPage() {
  return (
    <div className="landing-page legal-page">
      <LandingNavbar />

      <main>
        <header className="legal-header">
          <h1>Terms &amp; Conditions</h1>
          <p className="legal-updated">Last updated: August 4, 2026</p>
        </header>

        <div className="legal-body">
          <p className="legal-intro">
            These Terms govern your use of TransTTS — our platform for recording, transcription,
            translation, and text-to-speech. By using the service, you agree to these Terms.
          </p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By creating an account or otherwise using TransTTS, you confirm that you have read, understood,
            and agree to be bound by these Terms. If you do not agree, please do not use the service.
          </p>

          <h2>2. Use of Service</h2>
          <p>
            TransTTS lets you record audio, transcribe speech to text using the Whisper API, translate
            transcripts, and generate speech from text. You may use these features for lawful purposes and
            in line with these Terms. We may add, change, or remove features over time.
          </p>

          <h2>3. User Accounts &amp; Responsibilities</h2>
          <ul>
            <li>You are responsible for keeping your account credentials secure and for all activity under your account.</li>
            <li>You must provide accurate information and complete email (and, if used, phone) verification.</li>
            <li>If you add a custom API key, you are responsible for that key, its usage, and any costs your provider charges for it.</li>
          </ul>

          <h2>4. Prohibited Uses</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Upload content you do not have the rights to, or record people without required consent.</li>
            <li>Use the service to create unlawful, harmful, deceptive, or infringing content, including impersonation or non-consensual voice cloning.</li>
            <li>Attempt to bypass upload limits, rate limits, authentication, or other security controls.</li>
            <li>Overload, probe, or disrupt the service, or access it through automated abuse.</li>
          </ul>

          <h2>5. Intellectual Property</h2>
          <p>
            You retain ownership of the audio, text, and transcripts you provide (&quot;Your Content&quot;). You
            grant us the limited rights needed to process Your Content and deliver the features you request.
            The TransTTS name, brand, software, and design remain our property.
          </p>

          <h2>6. Third-Party Services</h2>
          <p>
            Some features rely on third-party providers (speech and language APIs, email, and SMS
            gateways). Your use of those features is also subject to the relevant provider&apos;s terms, and we
            are not responsible for their services.
          </p>

          <h2>7. Limitation of Liability</h2>
          <p>
            The service is provided &quot;as is&quot; without warranties of any kind. Transcriptions, translations,
            and generated speech may contain errors and should be reviewed before relying on them. To the
            maximum extent permitted by law, TransTTS is not liable for indirect, incidental, or
            consequential damages arising from your use of the service.
          </p>

          <h2>8. Termination</h2>
          <p>
            You may stop using the service and delete your account at any time. We may suspend or terminate
            access if you violate these Terms or use the service in a way that risks harm to others or to the
            platform.
          </p>

          <h2>9. Changes to Terms</h2>
          <p>
            We may update these Terms as the service evolves. When we do, we will revise the &quot;Last
            updated&quot; date above. Continued use after changes take effect means you accept the updated Terms.
          </p>

          <h2>10. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the jurisdiction in which TransTTS operates, without
            regard to conflict-of-law rules. Any disputes will be handled by the competent courts of that
            jurisdiction.
          </p>

          <h2>11. Contact</h2>
          <p>
            Questions about these Terms? Reach us at <a href="mailto:legal@transtts.ai">legal@transtts.ai</a>{" "}
            or via our <a href="/contact">contact page</a>.
          </p>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
