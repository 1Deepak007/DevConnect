npm iniy -y
npm install express mongoose jsonwebtoken bcryptjs cors dotenv socket.io redis cloudinary multer
npm install redis
npm install -g redis-cli

// https://cloud.redis.io/#/add-subscription/free
// redis public endpoint (aws) : redis-12442.c212.ap-south-1-1.ec2.redns.redis-cloud.com:12442


running redis :  docker run -it --rm redis redis-cli -h redis-12442.c212.ap-south-1-1.ec2.redns.redis-cloud.com -p 12442 -a redis_database_password_here
