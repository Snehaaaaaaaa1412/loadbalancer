# Production-Grade Layer-7 Load Balancer & Reverse Proxy Gateway

A high-performance, developer-friendly **Layer-7 (L7) Application Load Balancer and Reverse Proxy Gateway** built using **Node.js, Express, and TypeScript**. Engineered with clean architecture separation between the **Data Plane** and **Control Plane**, matching the production design principles of Envoy Proxy, NGINX, and HAProxy.

---

## 🌐 Live Production Demo
Explore the fully deployed load balancing gateway system live in your browser:
* **Frontend Visualizer Dashboard (Vercel)**: [https://loadbalancer-hfu7.vercel.app](https://loadbalancer-hfu7.vercel.app)
* **Backend Gateway API (Render)**: [https://loadbalancer-backend.onrender.com](https://loadbalancer-backend.onrender.com)
* **API Health Check Endpoint**: [https://loadbalancer-backend.onrender.com/health](https://loadbalancer-backend.onrender.com/health)

---

## 🚀 Key Architectural Highlights

### ⚡ 1. Control Plane / Data Plane Separation
* **Data Plane (Hot Request Path)**: 100% in-memory operations. Decisions are computed in $< 0.05\text{ms}$ with **zero** external database or Redis requests, ensuring sub-millisecond proxy routing.
* **Control Plane (Administration & Sync)**: Asynchronous, out-of-band updates using **Redis Pub/Sub** and monotonic configuration versioning. Fails open to standalone local memory mode if Redis is offline.

### 🛡️ 2. Dynamic Copy-on-Write Snapshots & Draining States
* Config reloads construct new, immutable `ServerCluster` snapshots and execute **atomic pointer swaps**.
* Existing `Server` instance references are reused to preserve active connection count metrics and event timers.
* Discarded backend nodes enter a `DRAINING` lifecycle state. They receive no new traffic and are safely garbage-collected only after their active connection count drops to `0`.

### 🔄 3. Monotonic Version Reconciliation
* Eventual consistency gaps (e.g. missed Pub/Sub updates due to network drops) are self-healed by validating version offsets.
* If a version gap is detected (`incomingVersion > localVersion + 1`), gateways run a randomized pull reconciliation loop, fetching the config from Redis with thundering herd jitter mitigation.

---

## 📊 System Architecture

### Request Routing Data Flow (Data Plane)
```text
[ Client Request ]
       │ (HTTP GET /api/loadbalancer/route/round-robin/users)
       ▼
┌──────────────┐
│ Express Port │ ──> [ L7 Stream Proxy (proxy.ts) ]
└──────────────┘               │
                               ▼
                    [ Select Active Node ] 
              (In-Memory O(1) Algorithm Strategy)
                               │
               ┌───────────────┼───────────────┐
               ▼                               ▼
       ┌──────────────┐                 ┌──────────────┐
       │ Backend 8081 │                 │ Backend 8082 │
       └──────────────┘                 └──────────────┘
```

### Config Update Propagation (Control Plane)
```text
[ Admin Console / Script ] 
       │ 1. Updates Server Configurations
       ▼
┌───────────────────────┐
│ Redis Configurations  │ <── (Hash Key: lb:cluster:default:configs)
└───────────────────────┘
       │ 2. Publishes Version Increments
       ▼
┌───────────────────────┐
│ Redis Pub/Sub Channel │
└───────────────────────┘
       │ 
       ▼ (Asynchronous Broadcast)
┌───────────────────────┐
│ Gateway Node (Sub)    │ ──> [ Version Check ]
└───────────────────────┘           │
                                    ├──> (Sequential)  ──> Swaps Snapshot Pointer
                                    └──> (Version Gap) ──> Jitters & Pulls from Redis
```

---

## 🛠️ Supported Load Balancing Algorithms

1. **Round Robin**: Routes traffic sequentially across all available healthy backend servers.
2. **Least Connections**: Dynamically selects the node with the lowest active connection count.
3. **Smooth Weighted Round Robin (SWRR)**: Implements NGINX's stateful weighted distribution algorithm, ensuring smooth load dispersion without clustering on high-weight nodes.

---

## 📑 API Reference Contracts

### 1. Initialize Routing Strategy Configuration
Configure active backend servers and weight distributions.
* **Endpoint**: `POST /api/loadbalancer/initialize/:strategy/:noOfServers`
* **Request Body** (Optional weights mapping):
  ```json
  {
    "weights": [5, 2, 3]
  }
  ```
* **Response**:
  ```json
  {
    "message": "Strategy 'round-robin' initialized successfully."
  }
  ```

### 2. Simulate Backend Selection Request
Simulates client request distribution yielding target server assignment.
* **Endpoint**: `POST /api/loadbalancer/request/:strategy`
* **Response**:
  ```json
  {
    "serverId": 1,
    "target": "http://localhost:8081",
    "activeConnections": 1
  }
  ```

### 3. Retrieve Cluster State Listing
* **Endpoint**: `GET /api/loadbalancer/servers/:strategy`
* **Response**:
  ```json
  [
    { "id": 1, "url": "http://localhost:8081", "weight": 5, "activeConnections": 1, "isHealthy": true },
    { "id": 2, "url": "http://localhost:8082", "weight": 2, "activeConnections": 0, "isHealthy": true }
  ]
  ```

### 4. L7 Reverse Proxy Routing Gateway
Forward HTTP client payload streams to active backend nodes.
* **Endpoint**: `ALL /api/loadbalancer/route/:strategy/*`
* **Details**: Strips the gateway route prefix and pipes request headers/body directly to resolved backend targets. Translates targets' offline statuses to `502 Bad Gateway` and timeouts to `504 Gateway Timeout`.

---

## 💻 Installation & Running Guide

### Running with Docker Compose (Recommended)
Launch the gateway, a local Next.js client dashboard, and a Redis container with one command:
```bash
docker-compose up --build
```
* **Gateway Endpoint**: `http://localhost:8080`
* **Client Visualizer Dashboard**: `http://localhost:3000`

---

### Manual Standalone Local Mode (Without Redis/Docker)
The gateway is configured to run in standalone memory mode by default.

1. **Install Dependencies**:
   ```bash
   # Build the backend
   cd backend
   npm install
   npm run build
   
   # Build the frontend
   cd ../frontend
   npm install
   ```

2. **Set Configuration Presets**:
   Create a `.env` file in the `backend/` folder:
   ```env
   PORT=8080
   NODE_ENV=development
   USE_REDIS=false
   ```

3. **Start Services**:
   ```bash
   # Run Gateway (backend folder)
   npm start
   
   # Run Client (frontend folder)
   npm run dev
   ```

4. **Verify Telemetry Execution (Integration Tests)**:
   You can verify snapshot operations, pointer swapping, and connections draining by running the programmatic integration test suite:
   ```bash
   cd backend
   npx ts-node src/tests/integration.test.ts
   ```

---

## 🛡️ Graceful Shutdown Lifecycle
Upon receiving termination interrupts (`SIGTERM` or `SIGINT`):
1. The gateway disables incoming TCP request loops (`server.close()`).
2. Sockets draining occurs for in-flight client requests.
3. Active subscriber listeners are cleanly unsubscribed (`ConfigSubscriber.unsubscribe()`).
4. Downstream Redis client connections are gracefully disconnected (`RedisClient.shutdown()`).
5. Process exits cleanly.

---

## ⚖️ License
Licensed under the [MIT License](LICENSE).
