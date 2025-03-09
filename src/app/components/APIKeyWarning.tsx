"use client";

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface APIKeyWarningProps {
  message?: string;
}

export default function APIKeyWarning({ message = "API key required" }: APIKeyWarningProps) {
  const router = useRouter();
  
  const handleAddAPIKey = () => {
    router.push('/api-keys');
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-2xl mx-auto my-8 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center"
    >
      <div className="flex flex-col items-center">
        <div className="bg-yellow-100 dark:bg-yellow-800 p-3 rounded-full mb-4">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-8 w-8 text-yellow-500 dark:text-yellow-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>
        
        <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
          {message}
        </h3>
        
        <p className="text-yellow-700 dark:text-yellow-300 mb-6">
          You need to add a YouTube API key to use this feature. 
          Please add a key in the settings.
        </p>
        
        <button
          onClick={handleAddAPIKey}
          className="px-5 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
        >
          Add API Key Now
        </button>
      </div>
    </motion.div>
  );
} 