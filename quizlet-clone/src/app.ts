import express from 'express';
import * as dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb'; // 添加 ObjectId
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(express.json()); // 解析 JSON 请求体

// MongoDB 连接函数
async function getMongoCollection(collectionName: string) {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  return client.db().collection(collectionName);
}

// 闪卡 CRUD API
// 1. 获取所有闪卡
app.get('/api/flashcards', async (req, res) => {
  try {
    const collection = await getMongoCollection('flashcards');
    const flashcards = await collection.find().toArray();
    res.json(flashcards);
  } catch (error) {
    res.status(500).json({ error: '获取闪卡失败' });
  }
});

// 2. 创建新闪卡
app.post('/api/flashcards', async (req, res) => {
  try {
    const { question, answer, category } = req.body;
    
    if (!question || !answer) {
      return res.status(400).json({ error: '问题和答案不能为空' });
    }

    const collection = await getMongoCollection('flashcards');
    const result = await collection.insertOne({
      question,
      answer,
      category: category || '默认分类',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.json({ 
      _id: result.insertedId, 
      question, 
      answer, 
      category: category || '默认分类',
      createdAt: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: '创建闪卡失败' });
  }
});

// 3. 更新闪卡
app.put('/api/flashcards/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { question, answer, category } = req.body;

        // 1. ID格式校验（优先校验，避免无效ID进入后续逻辑）
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: '无效的闪卡ID格式，请检查ID是否正确' });
        }
        const flashcardId = new ObjectId(id); // 转换为ObjectId
  

        // 2. 输入合法性校验（确保至少有一个字段需要更新）
        // 先判断用户是否传递了“有实际值”的字段（排除空字符串、空格）
        const hasQuestion = question && question.trim() !== '';
        const hasAnswer = answer && answer.trim() !== '';
        const hasCategory = category && category.trim() !== '';

        if (!hasQuestion && !hasAnswer && !hasCategory) {
            return res.status(400).json({ error: '至少需要修改一个字段（问题/答案/分类），且不能全为空' });
        }


        // 3. 组装更新数据（只包含有值的字段）
        const updateData: any = { updatedAt: new Date() };
        if (hasQuestion) updateData.question = question.trim(); // 去除首尾空格
        if (hasAnswer) updateData.answer = answer.trim();
        if (hasCategory) updateData.category = category.trim();


        // 4. 执行更新并校验是否存在该闪卡
        const collection = await getMongoCollection('flashcards');
        const result = await collection.updateOne(
            { _id: flashcardId },
            { $set: updateData }
        );

        // 若未匹配到任何闪卡（ID存在但对应闪卡已删除）
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: '闪卡不存在，可能已被删除' });
        }


        // 5. 更新成功
        res.json({ 
            message: '闪卡更新成功',
            updatedFields: Object.keys(updateData).filter(key => key !== 'updatedAt') // 告诉前端哪些字段被更新了
        });

    } catch (error) {
        console.error('更新闪卡错误:', error);
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        res.status(500).json({ 
            error: '服务器内部错误', 
            details: process.env.NODE_ENV === 'development' ? errorMessage : '请联系管理员' 
        });
    }
});

// 4. 删除闪卡
app.delete('/api/flashcards/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const collection = await getMongoCollection('flashcards');
    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: '闪卡不存在' });
    }

    res.json({ message: '闪卡删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除闪卡失败' });
  }
});

// 5. 获取单个闪卡
app.get('/api/flashcards/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const collection = await getMongoCollection('flashcards');
    const flashcard = await collection.findOne({ _id: new ObjectId(id) });

    if (!flashcard) {
      return res.status(404).json({ error: '闪卡不存在' });
    }

    res.json(flashcard);
  } catch (error) {
    res.status(500).json({ error: '获取闪卡失败' });
  }
});

// 学习模式 API
app.get('/api/study', async (req, res) => {
  try {
    const collection = await getMongoCollection('flashcards');
    const flashcards = await collection.find().toArray();
    res.json(flashcards);
  } catch (error) {
    res.status(500).json({ error: '获取学习数据失败' });
  }
});

// 基本测试路由
app.get('/api', (req, res) => {
  res.json({ 
    message: 'API is working!', 
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET    /api/flashcards',
      'POST   /api/flashcards',
      'GET    /api/flashcards/:id',
      'PUT    /api/flashcards/:id', 
      'DELETE /api/flashcards/:id',
      'GET    /api/study'
    ]
  });
});

// MongoDB 连接测试
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

// 启动服务器
async function startServer() {
  await testMongoConnection();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📱 前端页面: http://localhost:${PORT}/`);
    console.log(`🔗 API 文档: http://localhost:${PORT}/api`);
  });
}

  startServer().catch(console.error); 