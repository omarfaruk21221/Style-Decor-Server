# ✨ Style Decor - Premium Interior & Event Decoration Platform

![Style Decor Banner](https://raw.githubusercontent.com/omarfaruk21221/Style-Decor-Server/main/banner.png)
*Note: Replace the banner link with your actual hosted image if needed.*

**Style Decor** is a comprehensive platform designed to connect clients with professional decorators. Whether it's for luxury interior design or grand event decorations, our platform provides a seamless experience for booking, management, and secure payments.

---

## 🚀 Project Links & Credentials

| Type | Link / Detail |
| :--- | :--- |
| **🌐 Live Client** | [style-decor-client.vercel.app](https://style-decor-client.vercel.app/) |
| **💻 Client Repository** | [GitHub (Client)](https://github.com/omarfaruk21221/Style-Decor-Client) |
| **🛡️ Server Repository** | [GitHub (Server)](https://github.com/omarfaruk21221/Style-Decor-Server) |
| **🔑 Admin Email** | `admin@gmail.com` |
| **🔒 Admin Password** | `Aa1234` |

---

## 🌟 Key Features

### 👤 User (Client) Experience
- **Service Browsing**: Explore a wide range of decoration and interior design services.
- **Easy Booking**: Quick and simple booking process for any service.
- **Secure Payments**: Integrated with **Stripe** for safe and hassle-free transactions.
- **Order Tracking**: Track your booking status and view transaction history.
- **Authentication**: Secure login and registration using **Firebase Authentication**.

### 🎨 Decorator Experience
- **Managed Assignments**: Decorators can view and accept assigned decoration projects.
- **Project Workflow**: Update project status from "Accepted" to "Completed".
- **Earning System**: Automatic calculation of earnings (10% commission per project).
- **Status Management**: Real-time status updates (Active, Assigned, Accepted).

### 🛡️ Admin Dashboard
- **User Management**: View, search, and manage all users. Promote users to Admin or Decorator roles.
- **Service Management**: Full CRUD (Create, Read, Update, Delete) operations for platform services.
- **Booking Oversight**: Assign decorators to new bookings and monitor progress.
- **Analytics & Stats**: Comprehensive overview of payments, active services, and user engagement.

---

## 🛠️ Technologies Used

- **Frontend**: React.js, Tailwind CSS (Client-side)
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Authentication**: Firebase Admin SDK & Client SDK
- **Payments**: Stripe API
- **Others**: JWT, JSON, CORS, Dotenv

---

## ⚙️ Local Development Setup

Follow these steps to get the server running locally:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/omarfaruk21221/Style-Decor-Server.git
   cd Style-Decor-Server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Create a `.env` file in the root directory and add the following:
   ```env
   PORT=3000
   MONGODB_URI=your_mongodb_connection_string
   STRIPE_SECRET_KEY=your_stripe_secret_key
   FIREBASE_SERVICE_ACCOUNT=your_base64_encoded_service_account_json
   CLIENT_URL=http://localhost:5173
   ```

4. **Start the server:**
   ```bash
   npm run dev
   ```

---

## 📄 License
This project is licensed under the ISC License.

---
Created with ❤️ by **Omar Faruk**
