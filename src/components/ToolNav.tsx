"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RadioIcon, MicIcon, GlobeIcon, VolumeIcon, BarChartIcon } from "@/components/Icons";

const tools = [
  { href: "/record", icon: RadioIcon, label: "Voice Recorder", desc: "Record & Promote" },
  { href: "/transcribe", icon: MicIcon, label: "Transcribe", desc: "Audio → Text" },
  { href: "/translate", icon: GlobeIcon, label: "Translate", desc: "Any Language" },
  { href: "/tts", icon: VolumeIcon, label: "Voice Generator", desc: "Text → Speech" },
  { href: "/dashboard", icon: BarChartIcon, label: "Dashboard", desc: "History & Stats" },
];

export default function ToolNav() {
  const pathname = usePathname();

  return (
    <div className="tool-nav fade-in">
      {tools.map((tool) => {
        const IconComp = tool.icon;
        return (
          <Link
            key={tool.href}
            href={tool.href}
            className={`tool-nav-item ${pathname === tool.href ? "active" : ""}`}
          >
            <span className="tool-nav-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconComp size={20} color="currentColor" />
            </span>
            <span className="tool-nav-label">{tool.label}</span>
            <span className="tool-nav-desc">{tool.desc}</span>
          </Link>
        );
      })}
    </div>
  );
}
