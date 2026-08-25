// components/SkeletonGrid.jsx
import React from 'react';

const SkeletonGrid = ({ count = 10 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="bg-gradient-to-br from-gray-800 to-gray-900 p-4 rounded-xl border border-gray-700 animate-pulse-slow"
      >
        <div className="w-full h-32 sm:h-48 md:h-56 bg-gray-700 rounded" />
        <div className="h-4 bg-gray-700 rounded mt-3 w-3/4" />
        <div className="h-3 bg-gray-700 rounded mt-2 w-1/2" />
      </div>
    ))}
  </div>
);

export default SkeletonGrid;
