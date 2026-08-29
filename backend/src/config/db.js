const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

async function connectDb() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/event_platform";
  await mongoose.connect(uri);
  console.log("[db] connected:", uri);
}

module.exports = { connectDb };
