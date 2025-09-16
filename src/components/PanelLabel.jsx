import { motion } from "framer-motion";

const DEFAULT_TRANSITION = {
  layout: { duration: 0.4 },
  duration: 0.4,
};

const motionElements = {
  span: motion.span,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  h4: motion.h4,
  h5: motion.h5,
  h6: motion.h6,
  p: motion.p,
  div: motion.div,
};

export default function PanelLabel({ id, as = "span", className = "", children, ...rest }) {
  const MotionComponent = motionElements[as] || motion.span;
  const layoutId = `panel-label-${String(id)}`;
  const classes = ["transition-colors duration-500 ease-in-out", className]
    .filter(Boolean)
    .join(" ");

  return (
    <MotionComponent
      layoutId={layoutId}
      transition={DEFAULT_TRANSITION}
      className={classes}
      {...rest}
    >
      {children}
    </MotionComponent>
  );
}
