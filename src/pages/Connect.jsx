import { motion } from "framer-motion";
import BackButton from "../components/BackButton";

export default function Connect() {
  return (
    <motion.div
      layoutId="panel-CONNECT"
      className="w-full h-full border border-black rounded-lg flex items-center justify-center"
    >
      <BackButton />
      <motion.h1
        layoutId="CONNECT"
        className="text-black font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
      >
        CONNECT
      </motion.h1>
    </motion.div>
  );
}
