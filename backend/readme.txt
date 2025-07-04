npm iniy -y
npm install express mongoose jsonwebtoken bcryptjs cors dotenv socket.io redis cloudinary multer
npm install redis
npm install -g redis-cli
npm install jsonwebtoken bcryptjs socket.io "@socket.io/redis-adapter"


// https://cloud.redis.io/#/add-subscription/free
// redis public endpoint (aws) : redis-12442.c212.ap-south-1-1.ec2.redns.redis-cloud.com:12442

-> run docket desktop app and run the container named redis then 
  running redis :  docker run -it --rm redis redis-cli -h redis-12442.c212.ap-south-1-1.ec2.redns.redis-cloud.com -p 12442 -a redis_database_password_here













What is Redis?
Redis (Remote Dictionary Server) is an open-source, in-memory data store used as:
Database,Cache,Message broker,Real-time data processing engine
It stores data in RAM (making it extremely fast) with optional persistence to disk.

1.Ideal for: 
    Session storage (JWT tokens)
    Real-time chat messages
    Frequent profile reads
2.Perfect for Authentication:
    Token Blacklisting:     Prevents stale/compromised tokens from being reused.
3.Real-Time Features:
    WebSocket Session Management: Track online users.
    Pub/Sub for Chat: Broadcast messages across servers.
4.Caching:
    Reduce MongoDB Load: Cache frequently accessed data (user profiles, posts)
5. Scalability:
    Handles spikes in traffic (e.g., viral posts) without crashing your database.


Why Are We Using Redis in Your DevConnect App?
1.JWT Token Management: Store valid tokens → Immediate invalidation on logout.
2.Online Status
3.Rate Limiting:Track login attempts per IP
4.Real-Time Notifications:Store and push notifications with Redis Pub/Sub.
Purpose:
    Session storage: Tokens are cached for fast validation.
    Rate limiting: Tracks login attempts to prevent brute-force attacks.
Key Features:
    In-memory speed: 100x faster than DB queries.
    Automatic expiry: Tokens auto-delete after 1 day (EX: 86400).



