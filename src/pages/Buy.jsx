import { motion } from "framer-motion";
import BackButton from "../components/BackButton";

export default function Buy() {
  return (
    <motion.div
      layoutId="panel-BUY"
      className="w-full h-full border border-black rounded-lg flex items-center justify-center"
    >
      <BackButton />
      <motion.h1
        layoutId="BUY"
        className="text-black font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
      >
        BUY
      </motion.h1>
    </motion.div>
  );
}
