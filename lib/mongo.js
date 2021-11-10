const { MongoClient } = require("mongodb");
const { mongodbGenericErrorHandler } = require("./errors");

let db;

function getCollection() {
  if (!db) {
    throw Error("You must open the connection (call `history.open` first)");
  }
  return db.collection("reports");
}

async function init() {
  const client = new MongoClient(process.env.MONGODB_CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    poolSize: 10,
    ssl: true,
  });

  await client.connect().catch(mongodbGenericErrorHandler);
  db = client.db(process.env.MONGODB_DATABASE_NAME);
}

async function write(obj) {
  const result = await getCollection().insertOne(obj);
  return result;
}

module.exports = {
  init,
  write,
};
