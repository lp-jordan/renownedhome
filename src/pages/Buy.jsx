import PanelContent from "../components/PanelContent";
import { motion } from "framer-motion";

export default function Buy() {
  return (
    <PanelContent className="items-start justify-start">
      <motion.section
        layoutId="BUY"
        className="flex flex-col items-center justify-center w-full h-screen p-4 text-center gap-4"
      >
        <h1 className="px-6 py-4 font-bold uppercase text-[clamp(3rem,8vw,10rem)]">
          BUY
        </h1>
        <p className="text-lg md:text-2xl max-w-xl">
          Support Renowned Home by backing our upcoming Kickstarter campaign.
        </p>
        <a
          href="#"
          className="mt-4 px-8 py-3 font-bold uppercase bg-black text-white rounded"
        >
          KICKSTARTER
        </a>
      </motion.section>
    </PanelContent>
  );
}
