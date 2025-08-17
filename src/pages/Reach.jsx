import PanelContent from "../components/PanelContent";
import BackButton from "../components/BackButton";
import { motion } from "framer-motion";
import BackButton from "../components/BackButton";

export default function Reach() {
  const socials = [
    {
      id: 1,
      href: "#",
      img: "https://via.placeholder.com/150",
      alt: "Social 1",
    },
    {
      id: 2,
      href: "#",
      img: "https://via.placeholder.com/150",
      alt: "Social 2",
    },
    {
      id: 3,
      href: "#",
      img: "https://via.placeholder.com/150",
      alt: "Social 3",
    },
  ];

  return (
    <PanelContent className="items-start justify-start">
      <BackButton />
      {/* Hero Section */}
      <motion.section
        className="relative flex-shrink-0 hero-half"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="relative flex flex-col items-center justify-center w-full h-full p-4 text-center gap-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <motion.h1
              layoutId="REACH"
              className="relative z-50 px-6 py-4 font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
            >
              REACH
            </motion.h1>
          </div>
          <motion.p
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-2xl max-w-xl"
          >
            Stay connected with Renowned Home.
          </motion.p>
          <motion.form
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex w-full max-w-md"
            onSubmit={(e) => e.preventDefault()}
          >
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
          </motion.form>
        </div>
      </motion.section>

      {/* Social Section */}
      <motion.div
        className="flex items-center justify-center w-full px-4 py-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
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
      </motion.div>
    </PanelContent>
  );
}
