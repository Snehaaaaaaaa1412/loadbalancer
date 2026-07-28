import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import ControlPanel from '../components/ControlPanel';
import { initializeLoadBalancer } from '../utils/api';

export default function Home() {
  const [algorithm, setAlgorithm] = useState('round-robin');
  const [numServers, setNumServers] = useState(5);
  const [weights, setWeights] = useState(Array.from({ length: 5 }, (_, i) => i + 1));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleInitialize = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      // Send configurations initialization to backend using API utility
      await initializeLoadBalancer(algorithm, numServers, weights);
      
      // Navigate to routing dashboard upon success
      const weightsQuery = algorithm === 'weightedroundrobin' ? `&weights=${weights.join(',')}` : '';
      router.push(`/request?algorithm=${algorithm}&numServers=${numServers}${weightsQuery}`);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to initialize the load balancer gateway.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-purple-50 flex flex-col items-center justify-center p-6">
      <Head>
        <title>Load Balancer Gateway Portal</title>
      </Head>

      <div className="text-center mb-8">
        <h1 className="text-5xl font-extrabold text-purple-800 tracking-tight">Load Balancer Portal</h1>
        <p className="text-gray-600 mt-2">Configure, initialize, and visualize standard routing algorithms.</p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded shadow w-full max-w-2xl">
          <p className="font-bold">Initialization Error</p>
          <p>{errorMsg}</p>
        </div>
      )}

      <ControlPanel
        algorithm={algorithm}
        setAlgorithm={setAlgorithm}
        numServers={numServers}
        setNumServers={setNumServers}
        weights={weights}
        setWeights={setWeights}
        onInitialize={handleInitialize}
        isLoading={isLoading}
      />
    </div>
  );
}