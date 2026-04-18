import { Link } from "wouter";

interface LogoProps {
  href?: string;
  variant?: "dark" | "light";
}

export function Logo({ href = "/", variant = "dark" }: LogoProps) {
  const textColor = variant === "light" ? "#ffffff" : "#1E2D6B";
  const supColor = variant === "light" ? "#F59E0B" : "#5B6BAE";

  return (
    <Link href={href} className="font-extrabold text-xl tracking-tight flex items-center select-none no-underline">
      <span style={{ color: textColor }}>Pinnacle</span>
      <sup style={{ color: supColor, fontSize: "0.7em", marginTop: "-0.5em", marginLeft: "1px" }}>³</sup>
    </Link>
  );
}
