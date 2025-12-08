# Style Decor Server

A modern backend server for the Style Decor application, built with Express.js and MongoDB. This RESTful API provides endpoints for managing users and services in a home decoration and styling platform.

## 🚀 Project Description

Style Decor Server is a Node.js backend application that powers the Style Decor platform - a comprehensive solution for home decoration and interior design services. The server handles user management, service listings, and provides a robust API for the frontend application.

## ✨ Features

### Core Features
- **RESTful API** - Clean and well-structured API endpoints
- **MongoDB Integration** - Secure database connection with MongoDB Atlas
- **User Management** - Complete user registration, authentication, and profile management
- **Service Management** - CRUD operations for decoration services
- **CORS Enabled** - Cross-origin resource sharing for frontend integration
- **Environment Variables** - Secure configuration management with dotenv
- **Vercel Ready** - Optimized for serverless deployment on Vercel

### Technical Features
- **Express.js Framework** - Fast, unopinionated web framework
- **MongoDB Driver** - Official MongoDB driver with Stable API version
- **Serverless Support** - Compatible with Vercel serverless functions
- **Error Handling** - Robust error handling and logging
- **Admin Middleware** - Role-based access control (ready for implementation)
- **Payment Integration Ready** - Stripe integration prepared (commented out)

## 📦 Technologies Used

- **Node.js** - JavaScript runtime environment
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **CORS** - Cross-origin resource sharing middleware
- **dotenv** - Environment variable management

## 🛠️ Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd style-decor-server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
STRIPE=your_stripe_secret_key
```

4. Start the development server:
```bash
node index.js
```

The server will run on `http://localhost:3000` (or the port specified in your `.env` file).

## 📁 Project Structure

```
style-decor-server/
├── index.js          # Main server file
├── package.json      # Dependencies and scripts
├── vercel.json       # Vercel deployment configuration
├── .env              # Environment variables (not in git)
└── README.md         # Project documentation
```

## 🔌 API Endpoints

### Base URL
- Local: `http://localhost:3000`
- Production: `https://your-vercel-url.vercel.app`

### Available Endpoints

#### Root
- `GET /` - Server status check

#### User Related APIs
- User management endpoints (to be implemented)

#### Service Related APIs
- Service management endpoints (to be implemented)

## 🗄️ Database Collections

- **users** - User accounts and profiles
- **services** - Decoration and styling services

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port number | No (default: 3000) |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `STRIPE` | Stripe secret key | No |

## 🚀 Deployment

### Deploy to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Add environment variables in Vercel dashboard:
   - Go to your project settings
   - Navigate to Environment Variables
   - Add `MONGODB_URI` and other required variables

The `vercel.json` file is already configured for serverless deployment.

## 📝 Development

### Running Locally
```bash
node index.js
```

### Project Status
- ✅ MongoDB connection established
- ✅ Express server configured
- ✅ CORS enabled
- ✅ User and Service collections ready
- 🔄 API endpoints (in development)
- 🔄 Admin middleware (ready for implementation)
- 🔄 Stripe integration (prepared)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

ISC

## 👤 Author

Style Decor Development Team

---

**Note**: This is a backend server for the Style Decor application. Make sure to configure your MongoDB connection string and other environment variables before running the server.

