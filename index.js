const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");
const { default: Stripe } = require('stripe');
const crypto = require("crypto");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Firebase Initialization
let isFirebaseInitialized = false;

// Initialize Firebase Admin SDK
// Ideally use environment variables for Vercel
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Option 1: Full JSON in env var
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    isFirebaseInitialized = true;
    console.log("Firebase initialized with FIREBASE_SERVICE_ACCOUNT");
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    // Option 2: Individual env vars
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    isFirebaseInitialized = true;
    console.log("Firebase initialized with Individual Env Vars");
  } else {
    // Option 3: Local file (fallback)
    // Check if serviceAccountKey.json exists and is not placeholder
    try {
      const serviceAccount = require("./serviceAccountKey.json");
      if (serviceAccount.project_id !== "YOUR_PROJECT_ID") {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        isFirebaseInitialized = true;
        console.log("Firebase initialized with local file");
      } else {
        console.warn("Firebase local file found but contains placeholders.");
      }
    } catch (err) {
      // File not found or invalid
      console.warn("Firebase credentials not found.");
    }
  }
} catch (error) {
  console.error("Firebase Initialization Error:", error.message);
}

// Stripe Initialization
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

function generateTrackingId() {
  const prefix = "PRCL"; // brand prefix
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const random = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6-char random hex
  return `${prefix}-${date}-${random}`;
}

// MongoDB Database Connection
const uri = process.env.MONGODB_URI;
let client;

if (uri) {
  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });
} else {
  console.error("MONGODB_URI is missing in environment variables.");
}

let db;

async function getDb() {
  if (db) return db;
  if (!client) throw new Error("MongoDB client is not initialized (check MONGODB_URI)");
  try {
    await client.connect();
    db = client.db("style_decor_DB");
    console.log("Connected to MongoDB successfully");
    return db;
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    throw err;
  }
}

// Helper middleware to attach collections to request
const withDB = async (req, res, next) => {
  try {
    const database = await getDb();
    req.userCollection = database.collection("users");
    req.serviceCollection = database.collection("services");
    req.bookingCollection = database.collection("bookings");
    req.paymentCollection = database.collection("payments");
    next();
  } catch (error) {
    console.error("Database middleware error:", error);
    res.status(500).send({ message: "Internal Database Error" });
  }
};

// Root route
app.get('/', (req, res) => {
  res.send('Style Decor Server is running bro!!!!');
});

// Apply DB middleware to all API routes
// Note: We can apply it globally or per route. Global is safer for consistency.
app.use(withDB);

// Auth Middlewares
const verifyFBToken = async (req, res, next) => {
  if (!isFirebaseInitialized) {
    return res.status(503).send({ message: 'Firebase authentication service unavailable. Check server logs.' });
  }
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }
  const token = req.headers.authorization.split(' ')[1];
  try {
    const decodedUser = await admin.auth().verifyIdToken(token);
    req.decode_email = decodedUser.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: 'Unauthorized access', error: error.message });
  }
};

const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.decode_email;
    const query = { email };
    const user = await req.userCollection.findOne(query);
    if (!user || user.role !== 'admin') {
      return res.status(403).send({ message: 'Forbidden access' });
    }
    next();
  } catch (error) {
    res.status(500).send({ message: 'Failed to verify admin', error: error.message });
  }
};

// ================= Routes =================

// Users
app.post('/users', async (req, res) => {
  try {
    const user = req.body;
    user.role = 'user';
    user.createdAt = new Date();
    const userEmail = user.email;
    const userExist = await req.userCollection.findOne({ email: userEmail });
    if (userExist) {
      return res.status(400).send({ message: 'User already exists' });
    }
    const result = await req.userCollection.insertOne(user);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to create user', error });
  }
});

app.get("/users", async (req, res) => {
  try {
    const searchText = req.query.searchText || "";
    const sortOrder = req.query.sortOrder || "asc";
    const filter = {
      $or: [
        { name: { $regex: searchText, $options: "i" } },
        { email: { $regex: searchText, $options: "i" } }
      ]
    };
    const sortQuery = sortOrder === "desc" ? { name: -1 } : { name: 1 };
    const users = await req.userCollection
      .find(filter)
      .sort(sortQuery)
      .toArray();
    res.send(users);
  } catch (error) {
    res.status(500).send({ message: "Error fetching users", error });
  }
});

app.get('/users/active-decorators', async (req, res) => {
  try {
    const query = { role: 'decorator', status: 'active' };
    const decorators = await req.userCollection.find(query).toArray();
    res.send(decorators);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch active decorators", error });
  }
});

app.get('/users/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const user = await req.userCollection.findOne({ email });
    res.send(user);
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch user role', error });
  }
});

app.patch('/users/:id/role', async (req, res) => {
  try {
    const id = req.params.id;
    const roleInfo = req.body;
    const query = { _id: new ObjectId(id) };
    const updatedDoc = {
      $set: {
        role: roleInfo.role,
        status: "active"
      }
    };
    const result = await req.userCollection.updateOne(query, updatedDoc);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to update user role', error });
  }
});

app.delete('/users/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await req.userCollection.deleteOne(query);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to delete user', error });
  }
});

// Services
app.post('/services', async (req, res) => {
  try {
    const service = req.body;
    service.createdAt = new Date();
    const result = await req.serviceCollection.insertOne(service);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to create service', error });
  }
});

app.get('/services', async (req, res) => {
  try {
    // Simple get all sorted by createdAt
    const services = await req.serviceCollection.find().sort({ createdAt: -1 }).toArray();
    res.send(services);
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch services', error });
  }
});

app.patch('/services/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = { $set: updateData };
    const result = await req.serviceCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to update service', error });
  }
});

app.delete('/services/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const result = await req.serviceCollection.deleteOne(filter);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to delete service', error });
  }
});

// Bookings
app.post('/bookings', async (req, res) => {
  try {
    const booking = req.body;
    const result = await req.bookingCollection.insertOne(booking);
    res.send(result);
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).send({ message: 'Failed to create booking', error });
  }
});

app.get('/bookings', async (req, res) => {
  try {
    const { email, paymentStatus, deliveryStatus } = req.query;
    let query = {};

    if (email) query.userEmail = email;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (deliveryStatus) query.deliveryStatus = deliveryStatus;

    const bookings = await req.bookingCollection.find(query).toArray();
    res.send(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).send({ message: 'Failed to fetch bookings', error });
  }
});







app.get('/bookings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const booking = await req.bookingCollection.findOne(query);
    res.send(booking);
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch booking', error });
  }
});

app.delete('/bookings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await req.bookingCollection.deleteOne(query);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to delete booking', error });
  }
});

app.patch('/bookings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updatedBooking = req.body;
    delete updatedBooking._id;

    const updateDoc = { $set: updatedBooking };
    const result = await req.bookingCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).send({ message: 'Failed to update booking', error });
  }
});

app.patch('/bookings/:id/assign-decorator', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { decoratorId, decoratorName, decoratorEmail, deliveryStatus } = req.body;

    if (!decoratorId || !decoratorName || !decoratorEmail) {
      return res.status(400).send({ message: 'Decorator info missing' });
    }

    const bookingQuery = { _id: new ObjectId(bookingId) };
    const bookingUpdateDoc = {
      $set: {
        decoratorId,
        decoratorName,
        decoratorEmail,
        assignedAt: new Date(),

        deliveryStatus: deliveryStatus || 'assigned',
      },
    };
    const bookingResult = await req.bookingCollection.updateOne(bookingQuery, bookingUpdateDoc);

    const decoratorQuery = { _id: new ObjectId(decoratorId) };
    const decoratorUpdateDoc = { $set: { status: 'assigned' } };
    const decoratorResult = await req.userCollection.updateOne(decoratorQuery, decoratorUpdateDoc);

    res.send({ success: true, bookingResult, decoratorResult });
  } catch (error) {
    res.status(500).send({ message: 'Failed to assign decorator', error });
  }
});
// -------------- action decorator --------------
app.patch('/bookings/:id/decorator-action', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { action } = req.query;

    if (!ObjectId.isValid(bookingId)) {
      return res.status(400).send({ message: 'Invalid booking ID format' });
    }

    const query = { _id: new ObjectId(bookingId) };

    const booking = await req.bookingCollection.findOne(query);
    if (!booking) {
      return res.status(404).send({ message: 'Booking not found' });
    }

    const decoratorId = booking?.decoratorId;
    if (!decoratorId) {
      return res.status(400).send({ message: 'No decorator assigned to this booking' });
    }

    if (!ObjectId.isValid(decoratorId)) {
      return res.status(400).send({ message: 'Invalid decorator ID associated with booking' });
    }

    const decoratorQuery = { _id: new ObjectId(decoratorId) };
    let bookingUpdateDoc = {};
    let decoratorUpdateDoc = {};

    if (action === 'accept') {
      bookingUpdateDoc = {
        $set: {
          deliveryStatus: 'accepted-decorator',
          acceptedAt: new Date()
        }
      };
      decoratorUpdateDoc = {
        $set: { status: 'accepted-service' }
      };
    } else if (action === 'completed') {
      const price = parseFloat(booking.price);
      const safePrice = isNaN(price) ? 0 : price;
      const decoratorCost = safePrice * 0.10;

      bookingUpdateDoc = {
        $set: {
          deliveryStatus: 'completed',
          completedAt: new Date(),
          decoratorCost: decoratorCost
        }
      };
      decoratorUpdateDoc = {
        $set: { status: 'active' }
      };
    } else {
      return res.status(400).send({ message: 'Invalid action. Supported actions: accept, completed' });
    }

    const bookingResult = await req.bookingCollection.updateOne(query, bookingUpdateDoc);
    const decoratorResult = await req.userCollection.updateOne(decoratorQuery, decoratorUpdateDoc);

    res.send({ success: true, bookingResult, decoratorResult });
  } catch (error) {
    console.error("Decorator action error:", error);
    res.status(500).send({ success: false, message: 'Failed to update booking', error: error.message });
  }
});

// Payment
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { price, bookingId, serviceId, serviceName, userEmail, serviceImage } = req.body;
    console.log("Received payment info:", req.body);
    const amountInCents = Math.round(price * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: serviceName,
            metadata: { bookingId, serviceId, serviceName, serviceImage, userEmail },
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/dashboard/payment-cancel`,
      metadata: { bookingId, serviceId, serviceName, serviceImage, userEmail },
    });

    console.log("Stripe session created:", session.url);
    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Stripe session creation error:", error);
    res.status(500).json({ message: error.message });
  }
});

app.patch('/payment-success', async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const trackingId = generateTrackingId();
    const transactionalId = session.payment_intent;

    const filter = { transactionalId };
    const update = {
      $setOnInsert: {
        customerEmail: session.metadata.userEmail,
        currency: session.currency,
        amount: session.amount_total / 100,
        paymentStatus: session.payment_status,
        bookingId: session.metadata.bookingId,
        serviceId: session.metadata.serviceId,
        serviceName: session.metadata.serviceName,
        serviceImage: session.metadata.serviceImage,
        transactionalId,
        trackingId,
        paidAt: new Date().toLocaleDateString()
      }
    };

    const options = { upsert: true, returnDocument: 'after' };
    const paymentResult = await req.paymentCollection.findOneAndUpdate(filter, update, options);

    if (!paymentResult.lastErrorObject?.updatedExisting) {
      const bookingId = session.metadata.bookingId;
      await req.bookingCollection.updateOne(
        { _id: new ObjectId(bookingId) },
        { $set: { paymentStatus: 'paid', deliveryStatus: 'pending-pickup', trackingId } }
      );

      return res.send({
        success: true,
        trackingId,
        transactionalId,
        paymentInfo: paymentResult.value
      });
    } else {
      return res.send({
        success: false,
        message: 'Payment already exists',
        trackingId: paymentResult.value.trackingId,
        transactionalId
      });
    }
  } catch (error) {
    res.status(500).send({ message: 'Payment success handling failed', error });
  }
});

app.get('/payments', async (req, res) => {
  try {
    const { email } = req.query;
    const query = email ? { customerEmail: email } : {};
    const payments = await req.paymentCollection.find(query).sort({ paidAt: -1 }).toArray();
    res.send(payments);
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch payments', error });
  }
});

// Admin Ping
app.get('/health', async (req, res) => {
  try {
    await client.db("admin").command({ ping: 1 });
    res.send("MongoDB is healthy");
  } catch (e) {
    res.status(500).send("MongoDB is down");
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).send({
    success: false,
    message: "Route Not Found",
    status: 404
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Global Error:", err);
  res.status(err.status || 500).send({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === 'production' ? null : err
  });
});

// Start local server if not in Vercel/Lambda
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
}

module.exports = app;