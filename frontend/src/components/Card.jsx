// Card — shared container used across the site.
// Props:
// - children: content inside the card
// - className: extra styles (e.g. "hover:shadow-md")
// - padding: "p-5" | "p-6" (default) | "p-8" | "p-0"

export default function Card({ children, className = '', padding = 'p-6' }) {
  return (
    <div
      className={`rounded-2xl border border-line/90 bg-white/95 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.18)] transition-all duration-200 ${padding} ${className}`}
    >
      {children}
    </div>
  );
}
