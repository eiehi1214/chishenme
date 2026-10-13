/**
 * 吃什么 - Express 后端服务器
 * 提供 REST API + 静态文件服务
 */
const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'data', 'chishenme.db');

// ========== 中间件 ==========
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== 数据库连接（单例） ==========
let _db = null;
function getDB() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('[ERROR] 数据库不存在，请先运行: node init_db.js');
    process.exit(1);
  }
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
  }
  return _db;
}

// ========== 认证中间件 ==========
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  
  const db = getDB();
  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
  
  if (!session) return res.status(401).json({ error: '登录已过期' });
  
  
  const user = db.prepare('SELECT id, username, role, name, bio, created_at FROM users WHERE id = ?').get(session.user_id);
  
  if (!user) return res.status(401).json({ error: '用户不存在' });
  
  req.user = user;
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
}

// ========== API: 认证 ==========

// 登录
app.post('/api/auth/login', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });
  
  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
  
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  
  if (role && user.role !== role) {
    return res.status(403).json({ error: `该账号不是${role === 'admin' ? '管理员' : '学生'}账号` });
  }
  
  // 生成 token
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
  
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, name: user.name, bio: user.bio, created_at: user.created_at }
  });
});

// 注册（仅学生）
app.post('/api/auth/register', (req, res) => {
  const { username, password, name, bio } = req.body;
  if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });

  const db = getDB();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: '用户名已存在' });
  }

  const now = new Date().toISOString();
  const info = db.prepare('INSERT INTO users (username, password, role, name, bio, created_at) VALUES (?,?,?,?,?,?)')
    .run(username, password, 'student', name || username, bio || '', now);

  res.json({ id: info.lastInsertRowid, username, role: 'student', name: name || username, bio: bio || '', created_at: now });
});

// 获取当前用户信息
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// 退出登录
app.post('/api/auth/logout', authMiddleware, (req, res) => {
  const token = req.headers.authorization.replace('Bearer ', '');
  const db = getDB();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ message: '已退出' });
});

// 修改用户名/密码/个人信息
app.put('/api/auth/update', authMiddleware, (req, res) => {
  const { newUsername, newPassword, currentPassword, newName, newBio } = req.body;
  const db = getDB();

  // 验证当前密码
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || user.password !== currentPassword) {
    return res.status(401).json({ error: '当前密码不正确' });
  }

  // 检查新用户名是否被占用
  if (newUsername && newUsername !== user.username) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(newUsername, req.user.id);
    if (existing) {
      return res.status(409).json({ error: '该用户名已被占用' });
    }
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newUsername, req.user.id);
  }

  // 修改密码
  if (newPassword) {
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword, req.user.id);
  }

  // 修改姓名和简介
  if (newName !== undefined && newName !== user.name) {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(newName, req.user.id);
  }
  if (newBio !== undefined && newBio !== user.bio) {
    db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(newBio, req.user.id);
  }

  const updated = db.prepare('SELECT id, username, role, name, bio, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: '修改成功', user: updated });
});

// ========== API: 菜品 ==========

// 获取菜品列表（支持筛选）
app.get('/api/dishes', (req, res) => {
  const db = getDB();
  const { category, keyword, spicy, maxPrice, limit, random } = req.query;
  
  let sql = 'SELECT * FROM dishes WHERE is_available = 1';
  const params = [];
  
  if (category && category !== '全部') {
    sql += ' AND cuisine = ?';
    params.push(category);
  }
  if (keyword) {
    sql += ' AND (name LIKE ? OR description LIKE ? OR canteen LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
  }
  if (spicy) {
    sql += ' AND spicy = ?';
    params.push(spicy);
  }
  if (maxPrice) {
    sql += ' AND price <= ?';
    params.push(parseFloat(maxPrice));
  }
  
  if (random === '1') {
    sql += ' ORDER BY RANDOM()';
  } else {
    sql += ' ORDER BY hot DESC';
  }
  
  if (limit) {
    sql += ' LIMIT ?';
    params.push(parseInt(limit));
  }
  
  const dishes = db.prepare(sql).all(...params);
  
  // 解析 tags JSON
  const result = dishes.map(d => ({
    ...d,
    tags: JSON.parse(d.tags || '[]'),
    is_available: !!d.is_available
  }));
  res.json(result);
});

// 今日热门榜：基础热度 + 今日采纳数（必须放在 /:id 之前）
app.get('/api/dishes/hot', (req, res) => {
  const db = getDB();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const rows = db.prepare(`
    SELECT
      d.*,
      COALESCE(COUNT(CASE WHEN r.action = 'adopt' AND DATE(r.created_at) = ? THEN 1 END), 0) AS today_count
    FROM dishes d
    LEFT JOIN recommendation_logs r ON r.dish_id = d.id
    WHERE d.is_available = 1
    GROUP BY d.id
    ORDER BY (d.hot + today_count) DESC
    LIMIT 5
  `).all(today);

  const result = rows.map(d => ({
    ...d,
    tags: JSON.parse(d.tags || '[]'),
    is_available: !!d.is_available,
    total_hot: d.hot + d.today_count
  }));

  res.json(result);
});

// 获取单个菜品
app.get('/api/dishes/:id', (req, res) => {
  const db = getDB();
  const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(req.params.id);

  if (!dish) return res.status(404).json({ error: '菜品不存在' });

  dish.tags = JSON.parse(dish.tags || '[]');
  dish.is_available = !!dish.is_available;
  res.json(dish);
});

// 创建菜品（管理员）
app.post('/api/dishes', authMiddleware, adminOnly, (req, res) => {
  const { name, emoji, price, canteen, spicy, cuisine, distance, tags, hot, description } = req.body;
  
  if (!name || !price || !canteen || !cuisine) {
    return res.status(400).json({ error: '缺少必填字段: name, price, canteen, cuisine' });
  }
  
  const db = getDB();
  const info = db.prepare(`
    INSERT INTO dishes (name, emoji, price, canteen, spicy, cuisine, distance, tags, hot, description)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    name,
    emoji || '🍽️',
    parseFloat(price),
    canteen,
    spicy || '不辣',
    cuisine,
    distance || '200m',
    JSON.stringify(tags || []),
    parseInt(hot) || 0,
    description || ''
  );
  
  const newDish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(info.lastInsertRowid);
  newDish.tags = JSON.parse(newDish.tags || '[]');
  newDish.is_available = !!newDish.is_available;
  
  res.status(201).json(newDish);
});

// 更新菜品（管理员）
app.put('/api/dishes/:id', authMiddleware, adminOnly, (req, res) => {
  const { name, emoji, price, canteen, spicy, cuisine, distance, tags, hot, description, is_available } = req.body;
  const db = getDB();
  
  const existing = db.prepare('SELECT * FROM dishes WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '菜品不存在' });
  }
  
  db.prepare(`
    UPDATE dishes SET
      name = ?, emoji = ?, price = ?, canteen = ?, spicy = ?, cuisine = ?,
      distance = ?, tags = ?, hot = ?, description = ?, is_available = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name ?? existing.name,
    emoji ?? existing.emoji,
    price !== undefined ? parseFloat(price) : existing.price,
    canteen ?? existing.canteen,
    spicy ?? existing.spicy,
    cuisine ?? existing.cuisine,
    distance ?? existing.distance,
    tags ? JSON.stringify(tags) : existing.tags,
    hot !== undefined ? parseInt(hot) : existing.hot,
    description ?? existing.description,
    is_available !== undefined ? (is_available ? 1 : 0) : existing.is_available,
    req.params.id
  );
  
  const updated = db.prepare('SELECT * FROM dishes WHERE id = ?').get(req.params.id);
  updated.tags = JSON.parse(updated.tags || '[]');
  updated.is_available = !!updated.is_available;
  
  res.json(updated);
});

// 删除菜品（管理员）
app.delete('/api/dishes/:id', authMiddleware, adminOnly, (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT id FROM dishes WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '菜品不存在' });
  }
  
  db.prepare('DELETE FROM dishes WHERE id = ?').run(req.params.id);
  
  res.json({ message: '菜品已删除', id: parseInt(req.params.id) });
});

// ========== API: 分类 ==========

app.get('/api/categories', (req, res) => {
  const db = getDB();
  const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.json(cats);
});

// ========== API: 评分 ==========

// 提交评分
app.post('/api/ratings', authMiddleware, (req, res) => {
  const { dish_id, score, comment } = req.body;
  if (!dish_id || !score || score < 1 || score > 5) {
    return res.status(400).json({ error: '参数错误: 需要 dish_id 和 1-5 的 score' });
  }
  
  const db = getDB();
  const info = db.prepare('INSERT INTO ratings (user_id, dish_id, score, comment) VALUES (?,?,?,?)')
    .run(req.user.id, dish_id, score, comment || '');
  
  // 记录推荐日志
  db.prepare('INSERT INTO recommendation_logs (user_id, dish_id, action) VALUES (?,?,?)')
    .run(req.user.id, dish_id, 'rating');
  
  // 获取该菜品的平均评分
  const avg = db.prepare('SELECT AVG(score) as avg_score, COUNT(*) as count FROM ratings WHERE dish_id = ?')
    .get(dish_id);
  
  res.status(201).json({
    id: info.lastInsertRowid,
    avg_score: avg.avg_score?.toFixed(1),
    rating_count: avg.count
  });
});

// 获取菜品评分
app.get('/api/ratings/dish/:id', (req, res) => {
  const db = getDB();
  const ratings = db.prepare(`
    SELECT r.*, u.username, u.name 
    FROM ratings r JOIN users u ON r.user_id = u.id 
    WHERE r.dish_id = ? ORDER BY r.created_at DESC
  `).all(req.params.id);
  
  const stats = db.prepare('SELECT AVG(score) as avg, COUNT(*) as count FROM ratings WHERE dish_id = ?')
    .get(req.params.id);
  
  res.json({ ratings, avg: stats.avg?.toFixed(1), count: stats.count });
});

// ========== API: 用户偏好 ==========

app.get('/api/preferences', authMiddleware, (req, res) => {
  const db = getDB();
  const pref = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);
  
  if (pref) {
    pref.dietary_restrictions = JSON.parse(pref.dietary_restrictions || '[]');
  }
  res.json(pref || null);
});

app.post('/api/preferences', authMiddleware, (req, res) => {
  const { spicy_level, cuisine_pref, budget_max, dietary_restrictions } = req.body;
  const db = getDB();
  
  const existing = db.prepare('SELECT id FROM user_preferences WHERE user_id = ?').get(req.user.id);
  if (existing) {
    db.prepare(`
      UPDATE user_preferences SET spicy_level=?, cuisine_pref=?, budget_max=?, dietary_restrictions=?, updated_at=CURRENT_TIMESTAMP
      WHERE user_id=?
    `).run(spicy_level || '', cuisine_pref || '', budget_max || 0, JSON.stringify(dietary_restrictions || []), req.user.id);
  } else {
    db.prepare(`
      INSERT INTO user_preferences (user_id, spicy_level, cuisine_pref, budget_max, dietary_restrictions)
      VALUES (?,?,?,?,?)
    `).run(req.user.id, spicy_level || '', cuisine_pref || '', budget_max || 0, JSON.stringify(dietary_restrictions || []));
  }
  
  res.json({ message: '偏好已保存' });
});

// ========== API: 推荐日志 ==========

app.post('/api/recommendations/log', authMiddleware, (req, res) => {
  const { dish_id, action } = req.body;
  if (!dish_id || !action) return res.status(400).json({ error: '参数错误' });
  
  const db = getDB();
  db.prepare('INSERT INTO recommendation_logs (user_id, dish_id, action) VALUES (?,?,?)')
    .run(req.user.id, dish_id, action);
  
  res.status(201).json({ message: '已记录' });
});

// ========== API: 统计（管理员） ==========

app.get('/api/admin/stats', authMiddleware, adminOnly, (req, res) => {
  const db = getDB();
  
  const dishCount = db.prepare('SELECT COUNT(*) as count FROM dishes').get().count;
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role='student'").get().count;
  const ratingCount = db.prepare('SELECT COUNT(*) as count FROM ratings').get().count;
  const adoptCount = db.prepare("SELECT COUNT(*) as count FROM recommendation_logs WHERE action='adopt'").get().count;
  const todayRatings = db.prepare("SELECT COUNT(*) as count FROM ratings WHERE date(created_at)=date('now')").get().count;
  
  // 热门菜品 TOP5
  const topDishes = db.prepare(`
    SELECT d.name, d.emoji, COUNT(r.id) as rating_count, AVG(r.score) as avg_score
    FROM dishes d LEFT JOIN ratings r ON d.id = r.dish_id
    GROUP BY d.id ORDER BY rating_count DESC LIMIT 5
  `).all();
  
  // 分类分布
  const categoryStats = db.prepare(`
    SELECT cuisine, COUNT(*) as count FROM dishes GROUP BY cuisine ORDER BY count DESC
  `).all();
  
  res.json({
    dishCount, userCount, ratingCount, adoptCount, todayRatings,
    topDishes: topDishes.map(d => ({ ...d, avg_score: d.avg_score?.toFixed(1) })),
    categoryStats
  });
});

// ========== 默认路由 ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ========== 启动服务器 ==========
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  吃什么 - 服务器已启动`);
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  登录: http://localhost:${PORT}/login.html`);
  console.log(`  学生: http://localhost:${PORT}/student.html`);
  console.log(`  管理: http://localhost:${PORT}/admin.html`);
  console.log(`========================================\n`);
  console.log(`测试账号:`);
  console.log(`  管理员: admin / admin123`);
  console.log(`  学生:   student / 123456`);
});
