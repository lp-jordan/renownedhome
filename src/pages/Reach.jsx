import { motion } from "framer-motion";

export default function Reach() {
  const socials = [
    { id: 1, href: "#", img: "https://via.placeholder.com/150", alt: "Social 1" },
    { id: 2, href: "#", img: "https://via.placeholder.com/150", alt: "Social 2" },
    { id: 3, href: "#", img: "https://via.placeholder.com/150", alt: "Social 3" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <motion.h1 layoutId="REACH" className="relative z-50 text-4xl font-bold uppercase mb-4">
          REACH
        </motion.h1>
        <form className="flex w-full max-w-md">
          <input
            type="email"
            placeholder="Enter your email"
            className="flex-grow p-2 border rounded-l bg-[var(--background)] text-[var(--foreground)]"
            style={{ borderColor: "var(--border)" }}
          />
          <button
            type="submit"
            className="p-2 border rounded-r bg-[var(--accent)] text-white"
            style={{ borderColor: "var(--border)" }}
          >
            Submit
          </button>
        </form>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="flex space-x-6">
          {socials.map((social) => (
            <a
              key={social.id}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-24 h-24 border rounded-full overflow-hidden flex items-center justify-center"
              style={{ borderColor: "var(--border)" }}
            >
              <img
                src={social.img}
                alt={social.alt}
                className="w-full h-full object-cover"
              />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

