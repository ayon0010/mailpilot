// test-redis.js
const Redis = require("ioredis");

const redis = new Redis("redis://default:OVjveZsmj9gks5R4gkJCmm7VxIkgWwMZ@musical-tongue-terracota-86715.db.redis.io:13975");
redis.ping().then((res) => {
  console.log(res);
  process.exit(0);
});
