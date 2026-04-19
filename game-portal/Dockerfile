# ============================================
# Game Portal - Multi-stage Docker Build
# ============================================
# Stage 1: Build   - Node.js 编译 TypeScript + Vite 打包
# Stage 2: Serve   - Nginx 托管静态资源
# ============================================

# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖文件，利用 Docker 缓存层
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 执行构建 (tsc + vite build)
RUN npm run build

# ---------- Stage 2: Serve ----------
FROM nginx:alpine AS serve

# 移除默认 nginx 配置
RUN rm /etc/nginx/conf.d/default.conf

# 复制自定义 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从 builder 阶段复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
