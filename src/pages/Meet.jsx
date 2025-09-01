import { motion } from "framer-motion";

export default function Meet() {
  return (
    <motion.div
      layoutId="panel-MEET"
      className="w-full h-full border border-black rounded-lg flex items-center justify-center"
    >
      <motion.h1
        layoutId="MEET"
        className="text-black font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
      >
        MEET
      </motion.h1>
    </motion.div>
  );
}
