/**
 * 吃什么 - 数据库初始化脚本
 * 创建 SQLite 数据库，建表，插入种子数据
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'chishenme.db');

// 确保data目录存在
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// 如果数据库已存在则删除（开发阶段重置）
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('[DB] 旧数据库已删除');
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
console.log('[DB] 数据库已创建:', DB_PATH);

// ========== 建表 ==========
db.exec(`
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','admin')),
  name TEXT,
  bio TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 菜品表
CREATE TABLE IF NOT EXISTS dishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '🍽️',
  price REAL NOT NULL,
  canteen TEXT NOT NULL,
  spicy TEXT DEFAULT '不辣',
  cuisine TEXT NOT NULL,
  distance TEXT DEFAULT '200m',
  tags TEXT DEFAULT '[]',
  hot INTEGER DEFAULT 0,
  description TEXT DEFAULT '',
  is_available INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 分类表
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  sort_order INTEGER DEFAULT 0
);

-- 评分表
CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  dish_id INTEGER,
  score INTEGER NOT NULL CHECK(score >= 1 AND score <= 5),
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (dish_id) REFERENCES dishes(id)
);

-- 用户偏好表
CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  spicy_level TEXT,
  cuisine_pref TEXT,
  budget_max INTEGER,
  dietary_restrictions TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 推荐日志表
CREATE TABLE IF NOT EXISTS recommendation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  dish_id INTEGER,
  action TEXT CHECK(action IN ('adopt','dismiss','view','rating')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (dish_id) REFERENCES dishes(id)
);

-- 会话表（简易token认证）
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`);
console.log('[DB] 表结构已创建');

// ========== 插入用户 ==========
const insertUser = db.prepare(`
  INSERT INTO users (username, password, role, name, bio) VALUES (?,?,?,?,?)
`);
insertUser.run('admin', 'admin123', 'admin', '系统管理员', '食堂后台管理员');
insertUser.run('student', '123456', 'student', '学霸小明', '大二计算机系');
insertUser.run('zhangsan', '123456', 'student', '张三', '大三软件工程');
insertUser.run('lisi', '123456', 'student', '李四', '大一电子信息');
console.log('[DB] 用户数据已插入 (admin/admin123, student/123456)');

// ========== 插入分类 ==========
const insertCategory = db.prepare(`
  INSERT INTO categories (name, icon, sort_order) VALUES (?,?,?)
`);
const categories = [
  ['全部', '🍽️', 0], ['快餐', '🍱', 1], ['面食', '🍜', 2],
  ['炒菜', '🍲', 3], ['煲类', '🍗', 4], ['汤类', '🥣', 5],
  ['小吃', '🥙', 6], ['烫类', '🍲', 7], ['粉面', '🍜', 8],
];
categories.forEach(c => insertCategory.run(c[0], c[1], c[2]));
console.log('[DB] 分类数据已插入:', categories.length, '条');

// ========== 插入菜品 ==========
const insertDish = db.prepare(`
  INSERT INTO dishes (name, emoji, price, canteen, spicy, cuisine, distance, tags, hot, description, is_available)
  VALUES (?,?,?,?,?,?,?,?,?,?,1)
`);
const dishes = [
  ['黄焖鸡米饭','🍛',14,'二食堂 3号窗口','中辣','快餐','150m','["热食","下饭"]',89,'经典黄焖鸡，汤汁浓郁，配米饭一绝'],
  ['重庆小面','🍜',10,'一食堂 5号窗口','中辣','面食','200m','["热食","快手"]',95,'正宗重庆风味，麻辣鲜香'],
  ['麻辣香锅','🍲',22,'三食堂 1号窗口','重辣','炒菜','300m','["分量足","聚餐"]',78,'自选食材现炒，辣度可调'],
  ['兰州拉面','🍜',12,'一食堂 2号窗口','微辣','面食','180m','["热食","快手"]',82,'手工拉面，汤清面筋'],
  ['酸菜鱼饭','🐟',16,'二食堂 7号窗口','微辣','快餐','150m','["下饭","蛋白质"]',71,'鲜嫩鱼片配酸菜，开胃下饭'],
  ['鸡公煲','🍗',18,'三食堂 4号窗口','中辣','煲类','300m','["热食","聚餐"]',65,'浓香煲仔，鸡肉嫩滑'],
  ['螺蛳粉','🍜',13,'美食街 螺蛳粉店','中辣','粉面','400m','["重口味"]',88,'柳州正宗螺蛳粉，酸辣鲜爽'],
  ['盖浇饭-回锅肉','🍚',15,'二食堂 1号窗口','中辣','快餐','150m','["下饭","快手"]',76,'回锅肉盖浇饭，出餐快'],
  ['肉夹馍+凉皮','🥙',14,'美食街 陕西馆','微辣','小吃','350m','["适合夏天"]',70,'陕西经典搭配，清爽解腻'],
  ['水煮肉片','🥩',17,'三食堂 2号窗口','重辣','炒菜','300m','["下饭","分量足"]',73,'川味水煮，麻辣过瘾'],
  ['馄饨','🥟',9,'一食堂 6号窗口','不辣','汤类','200m','["热食","清淡"]',62,'皮薄馅大，汤鲜味美'],
  ['铁板牛肉饭','🍱',16,'二食堂 8号窗口','中辣','快餐','150m','["热食","下饭"]',81,'铁板现做，滋滋冒油'],
  ['番茄鸡蛋面','🍝',11,'一食堂 3号窗口','不辣','面食','200m','["清淡","快手"]',58,'家常味道，清淡养胃'],
  ['麻辣烫','🍲',15,'美食街 张亮麻辣烫','中辣','烫类','400m','["自选","分量足"]',92,'自选食材，按重计价'],
  ['猪脚饭','🍖',13,'二食堂 4号窗口','微辣','快餐','150m','["下饭","胶原蛋白"]',67,'卤香四溢，软糯入味'],
  ['煎饼果子','🥞',8,'美食街 早餐车','不辣','小吃','350m','["快手","便宜"]',85,'现摊现卖，酥脆可口'],
];
dishes.forEach(d => insertDish.run(...d));
console.log('[DB] 菜品数据已插入:', dishes.length, '条');

// ========== 插入示例评分 ==========
const insertRating = db.prepare(`
  INSERT INTO ratings (user_id, dish_id, score, comment) VALUES (?,?,?,?)
`);
const ratings = [
  [2, 1, 5, '太好吃了，汤拌饭绝了'],
  [2, 2, 5, '面很有嚼劲'],
  [2, 14, 4, '味道不错就是有点贵'],
  [3, 1, 4, '分量足'],
  [3, 4, 5, '正宗兰州味'],
  [4, 7, 3, '味道可以但太臭了'],
  [4, 16, 5, '便宜好吃'],
  [2, 10, 4, '辣得过瘾'],
  [3, 5, 5, '鱼肉很嫩'],
  [4, 14, 5, '每周必吃'],
];
ratings.forEach(r => insertRating.run(...r));
console.log('[DB] 评分数据已插入:', ratings.length, '条');

// ========== 插入用户偏好 ==========
const insertPref = db.prepare(`
  INSERT INTO user_preferences (user_id, spicy_level, cuisine_pref, budget_max, dietary_restrictions)
  VALUES (?,?,?,?,?)
`);
insertPref.run(2, '中辣', '快餐', 15, '["不吃香菜"]');
insertPref.run(3, '微辣', '面食', 12, '[]');
insertPref.run(4, '重辣', '炒菜', 20, '["不吃蒜"]');
console.log('[DB] 用户偏好已插入');

// 关闭数据库
db.close();
console.log('\n[DB] 初始化完成！数据库路径:', DB_PATH);
console.log('[DB] 测试账号:');
console.log('  管理员: admin / admin123');
console.log('  学生:   student / 123456');
