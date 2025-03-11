"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';

type FilterOption = 'latest' | '3days' | '7days' | 'all';
type SortOption = 'date' | 'views';

interface FilterBarProps {
  onFilterChange: (filter: FilterOption) => void;
  onSortChange: (sort: SortOption) => void;
}

export default function FilterBar({ onFilterChange, onSortChange }: FilterBarProps) {
  const [activeFilter, setActiveFilter] = useState<FilterOption>('latest');
  const [activeSort, setActiveSort] = useState<SortOption>('date');
  
  const handleFilterChange = (filter: FilterOption) => {
    setActiveFilter(filter);
    onFilterChange(filter);
  };
  
  const handleSortChange = (sort: SortOption) => {
    setActiveSort(sort);
    onSortChange(sort);
  };
  
  return (
    <motion.div 
      className="bg-background border-b border-gray-200 dark:border-gray-800 p-4 sticky top-0 z-10"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-1">
          <p className="text-sm font-medium mr-2">Filter:</p>
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <FilterButton 
              active={activeFilter === 'latest'} 
              onClick={() => handleFilterChange('latest')}
              position="left"
            >
              Latest (24h)
            </FilterButton>
            <FilterButton 
              active={activeFilter === '3days'} 
              onClick={() => handleFilterChange('3days')}
              position="middle"
            >
              Last 3 days
            </FilterButton>
            <FilterButton 
              active={activeFilter === '7days'} 
              onClick={() => handleFilterChange('7days')}
              position="middle"
            >
              Last 7 days
            </FilterButton>
            <FilterButton 
              active={activeFilter === 'all'} 
              onClick={() => handleFilterChange('all')}
              position="right"
            >
              All videos
            </FilterButton>
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          <p className="text-sm font-medium mr-2">Sort by:</p>
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <FilterButton 
              active={activeSort === 'date'} 
              onClick={() => handleSortChange('date')}
              position="left"
            >
              Date
            </FilterButton>
            <FilterButton 
              active={activeSort === 'views'} 
              onClick={() => handleSortChange('views')}
              position="right"
            >
              Views
            </FilterButton>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface FilterButtonProps {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  position: 'left' | 'middle' | 'right';
}

function FilterButton({ children, active, onClick, position }: FilterButtonProps) {
  const baseClasses = "px-3 py-1.5 text-xs font-medium bg-background transition-colors relative";
  
  const positionClasses = {
    left: "rounded-l-md border-y border-l border-gray-300 dark:border-gray-600",
    middle: "border-y border-l border-gray-300 dark:border-gray-600",
    right: "rounded-r-md border border-gray-300 dark:border-gray-600"
  };
  
  const activeClasses = active 
    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 z-10 border-red-300 dark:border-red-800" 
    : "hover:bg-gray-100 dark:hover:bg-gray-800";
  
  return (
    <motion.button
      className={`${baseClasses} ${positionClasses[position]} ${activeClasses}`}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.button>
  );
} 