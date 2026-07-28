# LoadBalancer Study Guide: 01_Project_Overview

Welcome to the documentation guide for the **Production-Grade Layer-7 Load Balancer Gateway**. This guide is designed to help you explain this system in software engineering interviews. We will start with a high-level overview.

---

## 1. What is it?
This project is a **Layer-7 (L7) Reverse Proxy and Load Balancer Gateway** written in Node.js, Express, and TypeScript.
* **Layer-7 (Application Layer)**: It means this server looks at the actual HTTP request content (like the URL path, headers, cookies) to make routing decisions. This is different from Layer-4 load balancers, which only look at IP addresses and TCP ports.
* **Reverse Proxy**: A proxy that sits in front of a group of backend target servers. When clients send requests, they talk to the gateway, and the gateway decides which backend server should handle the request.
* **Load Balancer**: A system that distributes network traffic across multiple backend servers to prevent any single server from getting overloaded.

---

## 2. Why is it needed?
In a small application, you might run only one backend server. But as traffic increases:
1. **Single Point of Failure**: If your single server crashes, your entire app goes offline.
2. **Resource Limits**: A single server runs out of CPU and memory, causing slow responses.
3. **Dynamic Scaling**: You need to add or remove servers on the fly without stopping your system.

A load balancer solves these problems by distributing traffic, detecting unhealthy servers, and updating server lists dynamically.

---

## 3. Which files implement it?
This project is built using a clean MVC (Model-View-Controller) structure:
* **Entry Point**: [index.ts](file:///C:/Users/Acer/.gemini/antigravity/scratch/loadbalancer/backend/src/index.ts) — Starts the HTTP server and lazy-loads Redis.
* **Routes**: [loadBalancerRoutes.ts](file:///C:/Users/Acer/.gemini/antigravity/scratch/loadbalancer/backend/src/routes/loadBalancerRoutes.ts) — Maps incoming request paths to controller methods.
* **Controller**: [LoadBalancerController.ts](file:///C:/Users/Acer/.gemini/antigravity/scratch/loadbalancer/backend/src/controllers/LoadBalancerController.ts) — Parses requests and communicates with services.
* **Service**: [LoadBalancerService.ts](file:///C:/Users/Acer/.gemini/antigravity/scratch/loadbalancer/backend/src/services/LoadBalancerService.ts) — Manages configuration snapshots and coordinates routing algorithms.

---

## 4. Complete Execution Flow
When a client sends an HTTP request (for example: `GET /api/loadbalancer/route/round-robin/users`):
1. **Network Arrival**: The request hits [index.ts](file:///C:/Users/Acer/.gemini/antigravity/scratch/loadbalancer/backend/src/index.ts).
2. **Routing Lookup**: The Express router maps the path to `LoadBalancerController.proxyRequest()`.
3. **Algorithm Resolution**: The controller calls `LoadBalancerService.routeRequest('round-robin')`.
4. **Target Selection**: The service fetches the active `ServerCluster` snapshot, calls the Round Robin strategy, and selects a target server (e.g. `http://localhost:8081`).
5. **Proxy Forwarding**: The gateway forwards the request stream chunks to the target server and pipes the response back to the client.

---

## 5. ASCII Diagram

```text
  [ Client Browser ]
          │ (HTTP GET /api/loadbalancer/route/round-robin/users)
          ▼
   ┌──────────────┐
   │ index.ts     │ ──> [ loadBalancerRoutes.ts ]
   └──────────────┘
          │
          ▼
   ┌───────────────────────────┐
   │ LoadBalancerController.ts │
   └───────────────────────────┘
          │
          ▼
   ┌───────────────────────────┐
   │ LoadBalancerService.ts    │ <── (Asynchronously syncs configuration via Redis)
   └───────────────────────────┘
          │
          ├─────────── select target backend ───────────┐
          ▼                                             ▼
   ┌──────────────┐                             ┌──────────────┐
   │ Target 8081  │                             │ Target 8082  │
   └──────────────┘                             └──────────────┘
```

---

## 6. Real-World Analogy
Think of a busy **restaurant host**:
* Customers (Clients) arrive at the door.
* They don't walk into the kitchen themselves. They speak to the Host (Load Balancer).
* The Host looks at the table map (ServerCluster Configuration) and decides which Waiter (Backend Server) has the capacity or whose turn it is.
* The Host leads the customer to their table, acting as the interface between the dining room and the kitchen staff.

---

## 7. Internal Working
The gateway separates the **Data Plane** and the **Control Plane**:
* **Data Plane (Hot Request Path)**: Stays 100% in local memory. There are no database calls or Redis calls during request routing. Decisions are resolved in $<0.05\text{ms}$.
* **Control Plane (Administration)**: Operates out-of-band (asynchronously). It listens to Redis Pub/Sub events for configuration changes, and swaps local memory cluster references atomically using Copy-on-Write.

---

## 8. Time Complexity
* **Routing Lookup**: $O(1)$ constant time lookup in local JavaScript Map.
* **Server Selection (Round Robin)**: $O(1)$ constant time.
* **Proxy Streaming**: $O(1)$ auxiliary space complexity (data is piped in chunks without buffering entire payloads in the server heap).

---

## 9. Failure Cases
* **Target Server Offline**: If the selected backend target is down, the proxy catches the connection failure (`ECONNREFUSED`) and translates it to a `502 Bad Gateway` response for the client.
* **Redis Connection Offline**: The control plane fails open, falling back to standalone local memory configurations so that routing is not interrupted.

---

## 10. Production Considerations
* **Graceful Shutdown**: The process intercepts termination signals, stops accepting new requests, drains active sockets, and then disconnects Redis connections.
* **Stream Piping**: Incoming payloads are streamed directly to targets using Node.js pipes, preventing Garbage Collection spikes.

---

## 11. Why This Design Was Chosen
We chose a **Control Plane / Data Plane separation** architecture. Keeping the Data Plane entirely in local memory guarantees maximum performance and reliability. If Redis goes down, the gateway continues routing traffic seamlessly.

---

## 12. Alternative Designs and Why They Were Rejected
* **Querying Redis on Every Request**: We rejected placing Redis directly in the request path because adding a network round-trip to Redis for every single request would increase gateway routing latency by several milliseconds.

---

## 13. Expected Interview Questions
* **Q**: What is the difference between a L4 and L7 load balancer?
* **A**: A L4 balancer routes traffic using transport layer attributes (IP, Port). A L7 balancer routes using application-level parameters (HTTP headers, URL paths, cookies).
* **Q**: Why keep Redis out of the request path?
* **A**: To maintain sub-millisecond routing latency and isolate routing operations from Redis connection failures.

---

## 14. Easy Revision Notes
* **Separation of Planes**: Data Plane = local memory routing; Control Plane = Redis config distribution.
* **Zero Hot Path Network**: No Redis/DB calls during routing.
* **Stream Proxy**: Pipes request chunks directly, preserving $O(1)$ space complexity.

---

## 15. Things I Must Remember
* Never put Redis in the request path.
* The proxy uses standard Node.js pipelines (`req.pipe`/`proxyRes.pipe`) to avoid buffering request payloads in the gateway's heap.
