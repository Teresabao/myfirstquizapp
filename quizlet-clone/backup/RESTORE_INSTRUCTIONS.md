


# 🔄 恢复备份说明

## 恢复内存存储版本
```bash
# 进入项目目录
cd ~/Desktop/myfirstapp/quizlet-clone

# 恢复核心文件
cp backup/memory-storage/app.ts src/
cp backup/memory-storage/index.ts src/routes/

# 重启服务器
npm start