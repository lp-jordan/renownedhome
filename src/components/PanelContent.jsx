export default function PanelContent({ children, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center w-full h-full ${className}`}>
      {children}
    </div>
  );
}
