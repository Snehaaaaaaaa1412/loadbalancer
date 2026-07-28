const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

/**
 * Custom wrapper around native fetch to centralize backend requests.
 */
export async function apiFetch(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `API request failed with status ${response.status}`);
  }

  // Handle case where backend returns plain text (like initialize endpoint message)
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

/**
 * Initializes the load balancer configuration on the gateway.
 */
export function initializeLoadBalancer(strategy, noOfServers, weights = []) {
  return apiFetch(`/api/loadbalancer/initialize/${strategy}/${noOfServers}`, {
    method: 'POST',
    body: JSON.stringify({ weights }),
  });
}

/**
 * Sends a request to be load-balanced and returns the selected server ID.
 */
export function sendRequest(strategy) {
  return apiFetch(`/api/loadbalancer/request/${strategy}`, {
    method: 'POST',
  });
}
