import express from 'express';
import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB 连接测试函数
async function testMongoConnection() {
  console.log('🔍 开始测试 MongoDB 连接...');
  
  if (!process.env.MONGODB_URI) {
    console.log('⚠️  未设置 MONGODB_URI');
    return;
  }

  try {
    const client = new MongoClient(process.env.MONGODB_URI);
    console.log('🔄 尝试连接 MongoDB...');
    await client.connect();
    console.log('✅ MongoDB 连接成功');
    await client.close();
  } catch (error) {
    console.error('❌ MongoDB 连接失败:', error);
  }
}

// 基本路由
app.get('/api', (req, res) => {
  res.json({ 
    message: 'API is working!', 
    timestamp: new Date(),
    status: 'success'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    database: 'MongoDB connection tested',
    environment: process.env.NODE_ENV || 'development'
  });
});

console.log('✅ 基本API路由已设置');

// 启动服务器
async function startServer() {
  await testMongoConnection();
  
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);

// 导出 app 用于测试或其他模块
export default app;