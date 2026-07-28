import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import ServerNode from '../components/ServerNode';
import { sendRequest } from '../utils/api';

export default function RequestPage() {
  const router = useRouter();
  const { algorithm, numServers, weights } = router.query;
  const [serverRequests, setServerRequests] = useState([]);
  const [requestId, setRequestId] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [parsedWeights, setParsedWeights] = useState([]);

  // Parse weights from query parameters
  useEffect(() => {
    if (weights) {
      const arr = weights.split(',').map(w => parseInt(w, 10) || 1);
      setParsedWeights(arr);
    }
  }, [weights]);

  // Sync request logs arrays sizes with numServers count
  useEffect(() => {
    if (numServers) {
      const count = parseInt(numServers, 10);
      setServerRequests(Array.from({ length: count }, () => []));
    }
  }, [numServers]);

  const handleSendRequest = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage('');

    try {
      // Trigger api route request
      const serverId = await sendRequest(algorithm);

      if (serverId === -1) {
        setErrorMessage('Request rejected: Load balancer reports all servers are at full capacity.');
        setIsLoading(false);
        return;
      }

      const activeId = parseInt(serverId, 10);
      const reqLabel = `Request #${requestId}`;

      // Append request to corresponding server node's queue
      setServerRequests((prev) => {
        const nextState = [...prev];
        if (activeId > 0 && activeId <= nextState.length) {
          nextState[activeId - 1] = [...(nextState[activeId - 1] || []), reqLabel];
        }
        return nextState;
      });

      // Simulated connection delay cleanup after 5000ms
      setTimeout(() => {
        setServerRequests((prev) => {
          const nextState = [...prev];
          if (activeId > 0 && activeId <= nextState.length) {
            nextState[activeId - 1] = nextState[activeId - 1].filter(req => req !== reqLabel);
          }
          return nextState;
        });
      }, 5000);

      setRequestId((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Network error encountered during request routing.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-purple-50 flex flex-col items-center justify-start p-6">
      <Head>
        <title>Load Balancer Dispatch Dashboard</title>
      </Head>

      <h1 className="text-5xl font-extrabold mb-4 text-purple-800 text-center">Gateway Dashboard</h1>

      <div className="mb-6 bg-white p-4 rounded-lg shadow text-center border border-gray-200">
        <span className="text-gray-600 block text-sm font-semibold uppercase tracking-wider">Active Strategy</span>
        <span className="text-2xl font-bold text-purple-700 capitalize">{algorithm?.replace(/-/g, ' ')}</span>
        <span className="text-gray-500 block text-xs mt-1">Servers configured: {numServers}</span>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded shadow w-full max-w-4xl">
          <p className="font-bold">Error Routing Request</p>
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Grid rendering Server Nodes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-8 w-full px-4 justify-items-center">
        {serverRequests.map((requests, index) => (
          <ServerNode
            key={index}
            id={index + 1}
            requests={requests}
            weight={parsedWeights[index]}
            algorithm={algorithm}
          />
        ))}
      </div>

      {/* Control Actions buttons */}
      <div className="flex space-x-4">
        <button 
          onClick={handleSendRequest} 
          disabled={isLoading}
          className="px-8 py-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 focus:ring-4 focus:ring-purple-300 transition duration-200 disabled:bg-purple-400"
        >
          {isLoading ? 'Routing...' : 'Send Request'}
        </button>

        <button 
          onClick={handleGoBack} 
          className="px-8 py-4 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600 focus:ring-4 focus:ring-gray-300 transition duration-200"
        >
          Back to Portal
        </button>
      </div>
    </div>
  );
}