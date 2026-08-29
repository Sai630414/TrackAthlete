import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

export function Carousel({ items = [], renderItem, className = '' }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!items || items.length === 0) return null;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === items.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border border-gray-800 bg-[#12161B] p-4 ${className}`.trim()}>
      <div className="transition-all duration-300">
        {renderItem ? renderItem(items[currentIndex], currentIndex) : items[currentIndex]}
      </div>

      {items.length > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" size="sm" onClick={handlePrev}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Prev
          </Button>

          <span className="text-xs text-gray-400">
            {currentIndex + 1} of {items.length}
          </span>

          <Button variant="outline" size="sm" onClick={handleNext}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
