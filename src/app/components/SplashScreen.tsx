import { motion } from 'motion/react';
import logo from '../../assets/logo.png';

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="overflow-hidden w-full flex justify-center"
      >
        <img src={logo} alt="Visadel Agency" className="h-72 w-auto max-w-none" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="absolute bottom-12 flex gap-2"
      >
        {[0, 0.2, 0.4].map((delay) => (
          <motion.div
            key={delay}
            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1, repeat: Infinity, delay }}
            className="w-2 h-2 bg-blue-500 rounded-full"
          />
        ))}
      </motion.div>
    </div>
  );
}
