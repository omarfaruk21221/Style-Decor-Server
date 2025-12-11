const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

let isFirebaseInitialized = false;
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  isFirebaseInitialized = true;
  console.log("Firebase Admin Initialized successfully.");
} catch (error) {
  console.error("Firebase Admin Initialization Failed:", error.message);
  // Continue running without Firebase, but auth routes will fail gracefully.
}

// ----strip =---
// const stripe = require('stripe')(process.env.STRIPE);
/// middleware
app.use(express.json())
app.use(cors())

// ----mongo db data base connection start----
const uri = process.env.MONGODB_URI
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
// ---conection -----------
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // ====create Database =====
    const db = client.db("style_decor_DB");
    const userCollection = db.collection("users");
    const serviceCollection = db.collection("services");
    const bookingCollection = db.collection("bookings");

    //// middleware with database
    const verifyFBToken = async (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!isFirebaseInitialized) {
        return res.status(503).send({ message: 'Firebase authentication service unavailable. Check server logs.' });
      }
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      try {
        const decodedUser = await admin.auth().verifyIdToken(token);
        req.decode_email = decodedUser.email;
        next();
      } catch (error) {
        return res.status(401).send({ message: 'unauthorized access', error });
      }
    }

    const verifyAdmin = async (req, res, next) => {
      try {
        const email = req.decode_email;
        const query = { email }
        const user = await userCollection.findOne(query)
        if (!user || user.role !== 'admin') {
          return res.status(403).send({ massage: 'forbidden access' })
        }
        next()
      } catch (error) {
        res.status(500).send({ message: 'Failed to verify admin', error })
      }
    }

    // ======= user related Api =========

    // ---- created and send Database user Api ------
    app.post('/users', async (req, res) => {
      try {
        const user = req.body
        user.role = 'user'
        user.createdAt = new Date()
        const userEmail = user.email
        const userExist = await userCollection.findOne({ email: userEmail })
        if (userExist) {
          return res.status(400).send({ message: 'User already exists' })
        }
        const result = await userCollection.insertOne(user)
        res.send(result)
      } catch (error) {
        res.status(500).send({ message: 'Failed to create user', error })
      }
    })
    // --- Get users info and manage user Api -----
    app.get("/users", async (req, res) => {
      try {
        const searchText = req.query.searchText || "";
        const sortOrder = req.query.sortOrder || "asc";
        // Search by name or email
        const filter = {
          $or: [
            { name: { $regex: searchText, $options: "i" } },
            { email: { $regex: searchText, $options: "i" } }
          ]
        };

        // Sorting by name (ascending/descending)
        const sortQuery = sortOrder === "desc" ? { name: -1 } : { name: 1 };

        const users = await userCollection
          .find(filter)
          .sort(sortQuery)
          .toArray();

        res.send(users);

      } catch (error) {
        res.status(500).send({ message: "Error fetching users", error });
      }
    });


    // ============get user by email Api ============
    // app.get('/users?email', async (req, res) => {
    //   const email = req.query.email;
    //   const user = await userCollection.findOne({ email });
    //   res.send(user);

    // })
    // --- Get users info and manage user Api -----
    app.get('/users/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const user = await userCollection.findOne({ email });
        res.send(user);
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch user role', error });
      }
    });
    // ------------- updatd user Role -----------------
    app.patch('/users/:id/role', async (req, res) => {
      try {
        const id = req.params.id
        const roleInfo = req.body
        const query = { _id: new ObjectId(id) }
        const updatedDoc = {
          $set: {
            role: roleInfo.role
          }
        }
        const result = await userCollection.updateOne(query, updatedDoc)
        res.send(result)
      } catch (error) {
        res.status(500).send({ message: 'Failed to update user role', error })
      }
    })

    // =================== user deleted api ===========
    app.delete('/users/:id', async (req, res) => {
      try {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await userCollection.deleteOne(query)
        res.send(result)
      } catch (error) {
        res.status(500).send({ message: 'Failed to delete user', error })
      }
    })


    // ======= service related Api =========
    // ---- created and send Database service Api ------
    app.post('/services', async (req, res) => {
      try {
        const service = req.body
        service.createdAt = new Date()
        const result = await serviceCollection.insertOne(service)
        res.send(result)
      } catch (error) {
        res.status(500).send({ message: 'Failed to create service', error })
      }
    })
    // ==== get all service =====
    app.get('/services', async (req, res) => {
      try {
        let { page = 1, limit = 6, email } = req.query;
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 6;
        const query = {};
        if (email) {
          query.senderEmail = email;
        }
        const total = await serviceCollection.countDocuments(query);
        const services = await serviceCollection
          .find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray();
        res.send({
          success: true,
          data: services,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        });
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch services', error });
      }
    });
    // ===== update service Api =====
    app.patch('/services/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const updateData = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: updateData
        };
        const result = await serviceCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to update service', error });
      }
    });
    // =============== delete service Api ===============
    app.delete('/services/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const result = await serviceCollection.deleteOne(filter);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to delete service', error });
      }
    });

    //  ================ booking related Api ===============
    app.post('/bookings', async (req, res) => {
      try {
        const booking = req.body;
        const result = await bookingCollection.insertOne(booking);
        res.send(result);
      } catch (error) {
        console.error("Error creating booking:", error);
        res.status(500).send({ message: 'Failed to create booking', error });
      }
    })

    // ============== booking get Api =============
    app.get('/bookings', async (req, res) => {
      try {
        const { email } = req.query;
        let query = {};
        if (email) {
          query = {
            $or: [
              { userEmail: email },
            ]
          };
        }
        const bookings = await bookingCollection.find(query).toArray();
        res.send(bookings);
      } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).send({ message: 'Failed to fetch bookings', error });
      }
    });
    app.get('/bookings/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const bookings = await bookingCollection.find({ email }).toArray();
        res.send(bookings);
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch bookings', error });
      }
    });

    app.delete('/bookings/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await bookingCollection.deleteOne(query);
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

        const updateDoc = {
          $set: updatedBooking
        };
        const result = await bookingCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating booking:", error);
        res.status(500).send({ message: 'Failed to update booking', error });
      }
    });













    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
// ---- output Api ----
app.get('/', (req, res) => {
  res.send('Style Decor Server is runing bro!!!!')
})

// Export app for Vercel serverless functions
module.exports = app;

// Start server locally (not on Vercel)
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  })
}