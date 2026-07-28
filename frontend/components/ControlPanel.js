import React from 'react';

/**
 * ControlPanel component managing strategy select form inputs, server counts, and weights arrays.
 */
export default function ControlPanel({
  algorithm,
  setAlgorithm,
  numServers,
  setNumServers,
  weights,
  setWeights,
  onInitialize,
  isLoading
}) {
  const incrementServers = () => {
    if (numServers < 20) {
      const nextNum = numServers + 1;
      setNumServers(nextNum);
      setWeights([...weights, nextNum]);
    }
  };

  const decrementServers = () => {
    if (numServers > 1) {
      setNumServers(numServers - 1);
      setWeights(weights.slice(0, -1));
    }
  };

  const handleWeightChange = (index, value) => {
    const parsed = parseInt(value, 10);
    const newWeights = [...weights];
    newWeights[index] = isNaN(parsed) || parsed <= 0 ? 1 : parsed;
    setWeights(newWeights);
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl flex flex-col space-y-6">
      {/* Algorithm selector */}
      <div className="flex flex-col space-y-2">
        <label htmlFor="algorithm" className="text-gray-700 font-semibold text-lg">Select Routing Algorithm</label>
        <select
          id="algorithm"
          className="border border-gray-300 rounded-md p-3 text-gray-800 text-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={algorithm}
          onChange={(e) => setAlgorithm(e.target.value)}
        >
          <option value="round-robin">Round Robin</option>
          <option value="weightedroundrobin">Smooth Weighted Round Robin</option>
          <option value="least-connections">Least Connections</option>
        </select>
      </div>

      {/* Server Count selector */}
      <div className="flex flex-col space-y-2">
        <label className="text-gray-700 font-semibold text-lg">Number of Target Servers</label>
        <div className="flex items-center space-x-4">
          <button 
            type="button"
            onClick={decrementServers} 
            className="px-6 py-2 bg-purple-100 text-purple-700 rounded-md font-bold hover:bg-purple-200 transition duration-200"
          >
            -
          </button>
          <span className="w-16 text-center text-2xl font-semibold text-gray-800">{numServers}</span>
          <button 
            type="button"
            onClick={incrementServers} 
            className="px-6 py-2 bg-purple-100 text-purple-700 rounded-md font-bold hover:bg-purple-200 transition duration-200"
          >
            +
          </button>
        </div>
      </div>

      {/* Weights settings array (Condition based on strategy selected) */}
      {algorithm === 'weightedroundrobin' && (
        <div className="flex flex-col space-y-3 animate-fade-in">
          <h3 className="text-gray-700 font-semibold text-lg">Configure Server Weights</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {weights.map((weight, index) => (
              <div key={index} className="flex flex-col items-center bg-gray-50 p-2 rounded border border-gray-200">
                <span className="text-xs text-gray-500 font-semibold mb-1">Server {index + 1}</span>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => handleWeightChange(index, e.target.value)}
                  className="w-16 text-center border border-gray-300 text-black rounded p-1 focus:ring-1 focus:ring-purple-500"
                  min="1"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trigger initializer button */}
      <button 
        type="button"
        disabled={isLoading}
        onClick={onInitialize} 
        className="w-full py-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-4 focus:ring-purple-300 transition duration-200 disabled:bg-purple-400"
      >
        {isLoading ? 'Initializing Gateway...' : 'Initialize Load Balancer'}
      </button>
    </div>
  );
}
