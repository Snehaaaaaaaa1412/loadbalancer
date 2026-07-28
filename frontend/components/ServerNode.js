import React from 'react';

/**
 * Reusable component representing a simulated server node card.
 * Displays active request logs, connection count, and weights.
 */
export default function ServerNode({ id, requests = [], weight, algorithm }) {
  const isActive = requests.length > 0;
  
  return (
    <div className={`flex flex-col items-center justify-start p-6 rounded-lg shadow-md w-full max-w-xs transition-all duration-300 ${
      isActive ? 'bg-purple-400 ring-4 ring-purple-300 scale-105' : 'bg-purple-300'
    } text-white`}>
      <div className="text-4xl mb-2">🖥️</div>
      <span className="text-xl font-bold">Server {id}</span>

      {/* Metrics Row */}
      <div className="mt-2 text-xs flex flex-col items-center space-y-1 text-purple-100">
        <span>Active Connections: {requests.length}</span>
        {algorithm === 'weightedroundrobin' && weight !== undefined && (
          <span className="bg-purple-500 px-2 py-0.5 rounded-full">Weight: {weight}</span>
        )}
      </div>

      {/* Connection queue box */}
      <ul className="mt-4 text-sm text-purple-900 h-40 w-full p-2 bg-purple-50 rounded overflow-y-auto scrollbar-thin scrollbar-thumb-purple-300">
        {requests.length === 0 ? (
          <li className="text-center text-gray-400 italic py-8">Idle</li>
        ) : (
          requests.map((request, index) => (
            <li 
              key={index} 
              className="bg-purple-200 rounded px-2 py-1 mb-1 w-full text-center font-medium animate-pulse"
            >
              {request}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
