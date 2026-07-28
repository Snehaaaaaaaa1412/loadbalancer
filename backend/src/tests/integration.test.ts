import { LoadBalancerService } from '../services/LoadBalancerService';
import { ServerLifecycleState } from '../models/Server';
import { logger } from '../utils/logger';

// Mock logger levels to keep test console clean
logger.transports.forEach((t) => (t.silent = true));

async function runTests() {
  console.log('🚀 Starting Phase 2 Integration Tests...');

  const service = new LoadBalancerService();

  // Test 1: Initialize Strategy & Verify Initial State
  console.log('\n--- Test 1: Initialize Strategy ---');
  service.initializeStrategy('round-robin', 3, [1, 2, 3]);
  const initialStates = service.getServerStates('round-robin');
  if (initialStates.length !== 3) throw new Error('Expected 3 servers');
  if (initialStates[0].weight !== 1) throw new Error('Expected weight 1');
  console.log('✅ Test 1 Passed: Initialized 3 servers correctly.');

  // Test 2: Active Connection Processing & Simulation
  console.log('\n--- Test 2: Connection Allocation & Preservation ---');
  service.routeRequest('round-robin'); // Server 1
  service.routeRequest('round-robin'); // Server 2
  service.routeRequest('round-robin'); // Server 3 (this server will be removed later)
  
  const statesBeforeSwap = service.getServerStates('round-robin');
  const server3Before = statesBeforeSwap.find(s => s.id === 3);
  if (!server3Before || server3Before.activeConnections !== 1) {
    throw new Error('Expected active connection count 1 for Server 3');
  }
  console.log('✅ Test 2 Passed: Connection count tracked correctly.');

  // Test 3: Incremental Pointer Swapping & Server Identity Preservation
  console.log('\n--- Test 3: Dynamic Config Update & Reference Re-use ---');
  // Update weights: Server 1 -> 5, Server 2 -> 5, Server 3 is removed. Server 4 is added.
  const updatedConfigs = [
    { id: 1, weight: 5 },
    { id: 2, weight: 5 },
    { id: 4, weight: 10 }
  ];
  
  const previousCluster = (service as any).clusters.get('round-robin');
  const server1RefBefore = previousCluster.servers.find((s: any) => s.getId() === 1);
  
  await service.handleConfigUpdate('round-robin', 1, JSON.stringify(updatedConfigs));
  
  const nextCluster = (service as any).clusters.get('round-robin');
  const server1RefAfter = nextCluster.servers.find((s: any) => s.getId() === 1);
  
  // Verify reference identity is preserved
  if (server1RefBefore !== server1RefAfter) {
    throw new Error('Server instance reference was not preserved!');
  }
  
  // Verify configuration updates occurred
  if (server1RefAfter.getWeight() !== 5) {
    throw new Error('Server weight did not update to 5');
  }
  
  // Verify Server 1 retained its connection count
  if (server1RefAfter.getActiveConnections() !== 1) {
    throw new Error('Server active connection count lost during snapshot swap!');
  }
  console.log('✅ Test 3 Passed: Server identity and connection state preserved.');

  // Test 4: Removed Target Server Lifecycle Transition to DRAINING
  console.log('\n--- Test 4: Removed Server Lifecycle Transition to DRAINING ---');
  // Server 3 was in previousCluster but not in nextCluster.
  // Because it has an active connection (from Test 2), it should enter DRAINING state instead of immediate REMOVED.
  const server3Ref = previousCluster.servers.find((s: any) => s.getId() === 3);
  if (server3Ref.getLifecycleState() !== ServerLifecycleState.DRAINING) {
    throw new Error(`Expected Server 3 state to be DRAINING, got ${server3Ref.getLifecycleState()}`);
  }
  console.log('✅ Test 4 Passed: Discarded server successfully transitioned to DRAINING.');

  // Test 5: Reactive Cleanup to REMOVED on Drainage
  console.log('\n--- Test 5: Reactive Draining Cleanup ---');
  // Cancel the long-running 5s timer and start a short 10ms timer to simulate immediate request drainage.
  server3Ref.clearActiveTimers();
  server3Ref.assignRequest(10); // Assign new request with a 10ms short simulated delay
  
  // Sleep 30ms to allow connection timer to fire and decrement connections to 0
  await new Promise((resolve) => setTimeout(resolve, 30));
  
  if (server3Ref.getLifecycleState() !== ServerLifecycleState.REMOVED) {
    throw new Error(`Expected Server 3 state to be REMOVED after draining, got ${server3Ref.getLifecycleState()}`);
  }
  if (server3Ref.getActiveConnections() !== 0) {
    throw new Error('Expected connections to drain to 0');
  }
  console.log('✅ Test 5 Passed: Draining server cleaned up reactively on reaching 0 connections.');

  console.log('\n🎉 ALL PHASE 2 INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests().catch((err) => {
  console.error('❌ Integration Test Failed:', err);
  process.exit(1);
});
