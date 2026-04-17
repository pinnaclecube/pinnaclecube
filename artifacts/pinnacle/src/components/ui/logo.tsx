import { Link } from "wouter";

export function Logo() {
  return (
    <Link href="/" className="font-bold text-xl tracking-tight flex items-center select-none no-underline">
      <span style={{ color: '#1E2D6B' }}>[pinnacle]</span>
      <sup style={{ color: '#5B6BAE', fontSize: '0.6em', marginTop: '-0.5em' }}>³</sup>
    </Link>
  );
}
