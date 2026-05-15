"use client";

interface Step {
  id: string;
  label: string;
  icon: string;
}

const STEPS: Step[] = [
  { id: "upload", label: "Upload", icon: "📤" },
  { id: "process", label: "Processing", icon: "⚙️" },
  { id: "transcribe", label: "Transcribing", icon: "🎤" },
  { id: "done", label: "Complete", icon: "✅" },
];

interface ProgressTrackerProps {
  progress: number;
  status: string;
}

export default function ProgressTracker({ progress, status }: ProgressTrackerProps) {
  const currentStep =
    status === "error" ? -1 :
    progress >= 100 ? 3 :
    progress >= 50 ? 2 :
    progress >= 20 ? 1 : 0;

  return (
    <div className="progress-tracker fade-in">
      <div className="progress-steps">
        {STEPS.map((step, i) => (
          <div
            key={step.id}
            className={`progress-step ${
              i < currentStep ? "completed" :
              i === currentStep ? "active" : "pending"
            }`}
          >
            <div className="step-circle">
              {i < currentStep ? "✓" : step.icon}
            </div>
            <span className="step-label">{step.label}</span>
            {i < STEPS.length - 1 && (
              <div className={`step-connector ${i < currentStep ? "filled" : ""}`} />
            )}
          </div>
        ))}
      </div>

      <div className="progress-bar-container" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>
            {progress >= 100 ? "Done!" : STEPS[currentStep]?.label || "Processing..."}
          </span>
          <span className="progress-percent">{progress}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
      </div>
    </div>
  );
}
