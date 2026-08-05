"use client";

import "../landing.css";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";

export default function PrivacyPolicyPage() {
  return (
    <div className="landing-page legal-page">
      <LandingNavbar />

      <main>
        <header className="legal-header">
          <h1>Privacy Policy</h1>
          <p className="legal-updated">Last updated: August 4, 2026</p>
        </header>

        <div className="legal-body">
          <p className="legal-intro">
            This Privacy Policy explains what information TransTTS (&quot;we&quot;, &quot;us&quot;) collects when you
            record, transcribe, translate, and generate speech with our platform, how we use it, and the
            choices you have. We collect only what the service needs to work.
          </p>

          <h2>1. Information We Collect</h2>
          <ul>
            <li><strong>Account details:</strong> your email address, and — if you enable phone verification — your phone number. Both are used to create your account and verify it.</li>
            <li><strong>Verification data:</strong> one-time passcodes (OTPs) sent to your email or phone, and password-reset tokens. These are short-lived and used only to confirm it&apos;s you.</li>
            <li><strong>Profile information:</strong> optional fields you choose to add, such as name, job title, organization, bio, and default language or voice.</li>
            <li><strong>Audio and text content:</strong> audio you record or upload, transcripts, translations, and text you submit for speech generation.</li>
            <li><strong>Your API keys:</strong> if you add a custom Whisper/OpenAI API key in Settings, it is stored to run transcriptions on your behalf.</li>
            <li><strong>Usage and technical data:</strong> job history, and basic request metadata (such as IP address) used for rate limiting and abuse prevention.</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>To provide the core features: recording, transcription (via the Whisper API), translation, and text-to-speech.</li>
            <li>To authenticate you, verify your email or phone, and let you reset your password.</li>
            <li>To save your job history and profile so you can return to your work.</li>
            <li>To protect the service — enforcing upload limits, validating input, and rate-limiting abusive traffic.</li>
            <li>To respond to messages you send us through the contact form.</li>
          </ul>
          <p>We do not sell your personal information, and we do not use your audio or transcripts to train models.</p>

          <h2>3. Data Storage &amp; Security</h2>
          <p>
            We take security seriously. Passwords are hashed, sessions are protected against CSRF, and
            cost-bearing and account endpoints are rate-limited. Uploads are size-limited and validated
            before processing. Where you use your own API key, transcription requests are sent to that
            provider under your key. You can review and edit your profile at any time, and export or delete
            your data through your account.
          </p>

          <h2>4. Third-Party Services</h2>
          <p>
            To deliver certain features, we send the minimum necessary data to trusted providers:
          </p>
          <ul>
            <li><strong>Speech &amp; language APIs</strong> (e.g. OpenAI / Groq Whisper) process audio for transcription and text for translation and speech generation.</li>
            <li><strong>Email providers</strong> (SMTP or Resend) deliver verification codes, password-reset links, and contact replies.</li>
            <li><strong>SMS gateways</strong> (e.g. your own gateway or Twilio) deliver phone verification codes, if you use phone verification.</li>
          </ul>
          <p>These providers process data only to perform their service and under their own terms.</p>

          <h2>5. Cookies &amp; Local Storage</h2>
          <p>
            We use a session cookie to keep you signed in, and browser local/session storage to remember
            preferences such as your theme and default settings. We do not use third-party advertising
            trackers.
          </p>

          <h2>6. Your Rights</h2>
          <ul>
            <li>Access and update your profile information at any time.</li>
            <li>Export your data or delete your account and associated content.</li>
            <li>Choose not to add a phone number or a custom API key — both are optional.</li>
          </ul>

          <h2>7. Data Retention</h2>
          <p>
            We keep your account and content while your account is active. Verification codes and reset
            tokens expire quickly (typically within minutes to an hour). When you delete your account, we
            remove your associated data, except where we must retain limited records for legal or security
            reasons.
          </p>

          <h2>8. Contact Us</h2>
          <p>
            For any privacy question or request, reach us at <a href="mailto:privacy@transtts.ai">privacy@transtts.ai</a>{" "}
            or through our <a href="/contact">contact page</a>.
          </p>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
