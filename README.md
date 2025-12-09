# Style Decor Server

Backend server for Style Decor - Interior Design Services Platform

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory:
```env
MONGODB_URI=your_mongodb_connection_string
PORT=3000
```

### 3. Run Server
```bash
# Development
npm run dev

# Production
npm start
```

## 📋 API Endpoints

### Users
- **POST** `/users` - Create new user
- **GET** `/users?searchText=query&sortOrder=asc` - Get all users with search and sort

### Services
- **POST** `/services` - Create new service

## 🗄️ Database Collections

### users
```javascript
{
  name: String,
  email: String,
  photoURL: String,
  role: String, // 'user' or 'admin'
  createdAt: Date
}
```

### services
```javascript
{
  name: String,
  description: String,
  price: Number,
  createdAt: Date
}
```

## 🌐 Deployment

This server is configured for Vercel deployment with `vercel.json`.

## 📝 License

ISC
