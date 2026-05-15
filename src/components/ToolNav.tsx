"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tools = [
  { href: "/transcribe", icon: "🎤", label: "Transcribe", desc: "Audio → Text" },
  { href: "/translate", icon: "🌐", label: "Translate", desc: "Any Language" },
  { href: "/tts", icon: "🔊", label: "Voice Generator", desc: "Text → Speech" },
  { href: "/dashboard", icon: "📊", label: "Dashboard", desc: "History & Stats" },
];

export default function ToolNav() {
  const pathname = usePathname();

  return (
    <div className="tool-nav fade-in">
      {tools.map((tool) => (
        <Link
          key={tool.href}
          href={tool.href}
          className={`tool-nav-item ${pathname === tool.href ? "active" : ""}`}
        >
          <span className="tool-nav-icon">{tool.icon}</span>
          <span className="tool-nav-label">{tool.label}</span>
          <span className="tool-nav-desc">{tool.desc}</span>
        </Link>
      ))}
    </div>
  );
}
