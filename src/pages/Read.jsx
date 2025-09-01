import { motion } from "framer-motion";

export default function Read() {
  return (
    <motion.div
      layoutId="panel-READ"
      className="w-full h-full border border-black rounded-lg flex items-center justify-center"
    >
      <motion.h1
        layoutId="READ"
        className="text-black font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
      >
        READ
      </motion.h1>
    </motion.div>
  );
}
