export default function ProductWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline whitespace-nowrap tracking-[-0.035em] ${className}`}>
      <span className="font-bold">INT</span>
      <span className="font-normal">racker</span>
    </span>
  );
}
