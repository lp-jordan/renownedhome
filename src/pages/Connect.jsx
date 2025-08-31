import PanelContent from "../components/PanelContent";
import BackButton from "../components/BackButton";
import { motion } from "framer-motion";
import usePageSubtitle from "../hooks/usePageSubtitle";

export default function Connect() {
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

  const { headline } = usePageSubtitle(4);
  return (
    <motion.div
      layoutId="panel-CONNECT"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full h-full"
    >
      <PanelContent className="justify-start">
        {/* Hero Section */}
        <motion.section
          className="relative flex-shrink-0 hero-half"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative flex flex-col items-center justify-center w-full h-full gap-4 p-2 text-center">
            <BackButton />
            <motion.h1
              layoutId="CONNECT"
              className="relative z-50 px-4 py-2 font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
            >
              CONNECT
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="max-w-xl text-lg md:text-2xl"
            >
              {headline}
            </motion.p>
            <motion.form
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="flex w-full max-w-md"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-grow rounded-l border p-2 bg-[var(--background)] text-[var(--foreground)]"
                style={{ borderColor: "var(--border)" }}
              />
              <button
                type="submit"
                className="rounded-r border p-2 bg-[var(--accent)] text-white"
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
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
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
    </motion.div>
  );
}
