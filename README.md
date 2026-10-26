# AutoMarts — 专业汽车配件商城

## 项目简介

AutoMarts 是一个全栈汽车配件电商平台，后端使用 Express + sql.js (SQLite)，前端使用 React 18 + Vite + Tailwind CSS。

## 技术栈

- **后端**: Node.js + Express 5 + TypeScript + sql.js (纯JS SQLite)
- **前端**: React 18 + TypeScript + Vite + Tailwind CSS + React Router
- **认证**: Session-based (HTTP-only cookie)
- **数据库**: SQLite (WASM-based, pure JavaScript)

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 初始化数据库

```bash
npm run db:init
npm run db:seed
```

或直接重置并重新播种：

```bash
npm run db:reset
```

### 启动开发服务器

```bash
npm run dev
```

- 后端 API: http://localhost:8000
- 前端应用: http://localhost:3000

### 构建生产版本

```bash
npm run build
```

### 运行测试

```bash
npm test
```

## API 端点

### 公开端点

- `GET /api/health` - 健康检查
- `GET /api/products` - 产品列表（支持筛选）
- `GET /api/products/featured` - 推荐产品
- `GET /api/products/new-arrivals` - 新品
- `GET /api/products/categories` - 分类列表
- `GET /api/products/brands` - 品牌列表
- `GET /api/products/search/suggestions` - 搜索建议
- `GET /api/products/:slug` - 产品详情
- `GET /api/products/:slug/related` - 相关产品
- `GET /api/products/vehicles/makes` - 车辆品牌
- `GET /api/products/vehicles/models` - 车辆型号
- `GET /api/products/vehicles/variants` - 车辆配置
- `GET /api/products/vehicles/compatible-products` - 兼容产品
- `GET /api/cart` - 购物车
- `POST /api/cart` - 添加商品
- `PUT /api/cart/:productId` - 更新数量
- `DELETE /api/cart/:productId` - 删除商品
- `DELETE /api/cart` - 清空购物车
- `GET /api/cart/count` - 购物车数量
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/orders/track/:orderNumber` - 订单追踪

### 认证端点

- `GET /api/auth/me` - 当前用户
- `PUT /api/auth/profile` - 更新资料
- `POST /api/auth/change-password` - 修改密码
- `POST /api/auth/logout` - 登出

### 订单端点

- `POST /api/orders/checkout` - 下单
- `GET /api/orders` - 我的订单
- `GET /api/orders/:orderNumber` - 订单详情
- `POST /api/orders/:orderNumber/cancel` - 取消订单

### 管理端点 (需管理员权限)

- `GET /api/admin/dashboard` - 仪表盘
- `GET /api/admin/products` - 产品管理
- `POST /api/admin/products` - 创建产品
- `PUT /api/admin/products/:id` - 更新产品
- `DELETE /api/admin/products/:id` - 删除产品
- `GET /api/admin/orders` - 订单管理
- `GET /api/admin/orders/:id` - 订单详情
- `PUT /api/admin/orders/:id/status` - 更新订单状态
- `GET /api/admin/customers` - 客户管理
- `GET /api/admin/categories` - 分类管理
- `POST /api/admin/categories` - 创建分类
- `GET /api/admin/brands` - 品牌管理
- `POST /api/admin/brands` - 创建品牌
- `GET /api/admin/coupons` - 优惠券管理
- `POST /api/admin/coupons` - 创建优惠券
- `GET /api/admin/reports/sales` - 销售报表
- `GET /api/admin/reports/inventory` - 库存报表

## 默认管理员账号

- 邮箱: `admin@automarts.pk`
- 密码: `changeme123`

> ⚠️ 请在生产环境中修改默认密码！

## 环境变量

复制 `.env.example` 到 `.env` 并填写配置：

```bash
cp .env.example .env
```

## 项目结构

```
parts/
├── backend/
│   └── src/
│       ├── db/          # 数据库层
│       │   ├── schema.ts    # 表结构
│       │   ├── init.ts      # 初始化
│       │   ├── seed.ts      # 种子数据
│       │   └── index.ts     # 数据库封装
│       ├── routes/      # API路由
│       │   ├── products.ts  # 产品API
│       │   ├── cart.ts      # 购物车API
│       │   ├── orders.ts    # 订单API
│       │   ├── auth.ts      # 认证API
│       │   └── admin.ts     # 管理API
│       ├── auth/        # 认证模块
│       ├── middleware/  # 中间件
│       ├── config/      # 配置
│       └── utils/       # 工具函数
├── frontend/
│   └── src/
│       ├── components/  # 通用组件
│       ├── pages/       # 页面组件
│       ├── context/     # React Context
│       ├── hooks/       # 自定义Hooks
│       ├── styles/      # 样式
│       ├── types/       # TypeScript类型
│       └── utils/       # 工具函数
├── package.json
└── README.md
```

## 安全特性

- Session-based 认证，HTTP-only cookie
- 密码使用 PBKDF2 哈希 (100000轮)
- Zod schema 验证所有输入
- SQL 参数化查询防止注入
- CORS 配置
- 速率限制
- 安全响应头

## 开发说明

- 后端使用 tsx 运行 TypeScript
- 前端使用 Vite 开发服务器，自动代理 /api 请求到后端
- 数据库文件位于 `backend/automarts.db`