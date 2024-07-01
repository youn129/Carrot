const { MongoClient } = require("mongodb");

const url = process.env.DB_URL;

async function connectDB() {
    try {
        const client = new MongoClient(url, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        await client.connect();
        console.log("MongoDB에 연결되었습니다.");
        return client;
    } catch (error) {
        console.error("MongoDB 연결 실패:", error);
        throw error;
    }
}

module.exports = connectDB();
