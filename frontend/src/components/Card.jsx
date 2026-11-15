// Card — shared container used across the site.

export default function Card({ children, className = '', padding = 'p-6', as: Tag = 'div' }) {
  return (
    <Tag
      className={`rounded-2xl border border-line/90 bg-white shadow-card transition duration-200 ${padding} ${className}`}
    >
      {children}
    </Tag>
  );
}
