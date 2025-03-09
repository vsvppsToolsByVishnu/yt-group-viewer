"use client";

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface APIKeyErrorHelperProps {
  message?: string;
}

export default function APIKeyErrorHelper({ message = "YouTube API Key Error" }: APIKeyErrorHelperProps) {
  const router = useRouter();
  
  const handleGoToSettings = () => {
    router.push('/api-keys');
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto my-8 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6"
    >
      <div className="flex flex-col items-center text-center">
        <div className="bg-red-100 dark:bg-red-800 p-3 rounded-full mb-4">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-8 w-8 text-red-500 dark:text-red-400" 
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
        
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
          {message}
        </h3>
        
        <div className="text-red-700 dark:text-red-300 mb-6">
          <p className="mb-4">
            There appears to be an issue with your YouTube API key. Here's how to fix it:
          </p>
          
          <ul className="text-left space-y-2 mb-6">
            <li className="flex items-start">
              <span className="mr-2">1.</span>
              <span>Check if your API key is correctly entered without extra spaces</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">2.</span>
              <span>Make sure the <strong>YouTube Data API v3</strong> is enabled for your API key</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">3.</span>
              <span>If you're using API key restrictions, ensure that <strong>localhost</strong> and your deployed domain are added to the allowed referrers</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">4.</span>
              <span>Verify that your API key hasn't reached its quota limit</span>
            </li>
          </ul>
        </div>
        
        <button
          onClick={handleGoToSettings}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
        >
          Go to API Key Settings
        </button>
      </div>
    </motion.div>
  );
} 