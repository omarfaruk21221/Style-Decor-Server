const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000
const admin = require("firebase-admin");
const { default: Stripe } = require('stripe');



// ----strip =---
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


// ------ firebase admin ---------
// const serviceAccount = require("./zap-shift-c9e57-firebase.json");
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// --genared tokon ---
// / ---- crypto for tracking id ----
const crypto = require("crypto");

function generateTrackingId() {
  const prefix = "PRCL"; // brand prefix
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const random = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6-char random hex
  return `${prefix}-${date}-${random}`;
}

/// middleware
app.use(express.json())
app.use(cors())


// const verifyFBToken = async (req, res, next) => {
//   const token = req.headers.authorization
//   // console.log('headers in the middleware', token)
//   if (!token) {
//     return res.status(401).send({ massage: 'unauthorization access' })
//   }
//   try {
//     const idToken = token.split(" ")[1]
//     const decode = await admin.auth().verifyIdToken(idToken)
//     console.log({ decode })
//     req.decode_email = decode.email
//     next()
//   }
//   catch (err) {
//     return res.status(401).send({ massage: "unathorized access!!" })
//   }
//   // const tol


// }

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
    const paymentCollection = db.collection("payments");

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
// app.get('/services', async (req, res) => {
//   try {
//     let { page = 1, limit = 6, email } = req.query;

//     page = parseInt(page);
//     limit = parseInt(limit);

//     const query = {};
//     if (email) {
//       query.createdByEmail = email;
//     }

//     const total = await serviceCollection.countDocuments(query);

//     const services = await serviceCollection
//       .find(query)
//       .sort({ createdAt: -1 })
//       .skip((page - 1) * limit)
//       .limit(limit)
//       .toArray();

//     res.send({
//       success: true,
//       data: services,
//       meta: {
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit),
//       },
//     });
//   } catch (error) {
//     res.status(500).send({
//       success: false,
//       message: 'Failed to fetch services',
//       error,
//     });
//   }
// });
app.get('/services', async (req, res) => {
  try {
    const cursor = serviceCollection.find().sort({ createdAt: -1 })
    const services = await cursor.toArray();
    res.send(services);
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

    // ======== booking get email query use ============
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
    app.get('/bookings/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const bookings = await bookingCollection.findOne(query);
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

    // ==================== payment   apis ================
    // post payment data into database and create checkout session
    app.post("/create-checkout-session", async (req, res) => {
      try {
        const { price, bookingId, serviceId, serviceName, userEmail, serviceImage } = req.body;
        console.log("Received payment info:", req.body);

        const amountInCents = Math.round(price * 100);

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: serviceName,
                  metadata: { bookingId, serviceId, serviceName, serviceImage, userEmail },
                },
                unit_amount: amountInCents,
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${process.env.CLIENT_URL}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.CLIENT_URL}/dashboard/payment-cancel`,
          metadata: { bookingId, serviceId, serviceName, serviceName, serviceImage, userEmail },
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

        // --- Atomic check and insert for payment ---
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
        const paymentResult = await paymentCollection.findOneAndUpdate(filter, update, options);

        // --- Check if payment was already inserted ---
        if (!paymentResult.lastErrorObject?.updatedExisting) {
          // Payment was inserted now, update booking
          const bookingId = session.metadata.bookingId;
          await bookingCollection.updateOne(
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
          // Payment already exists
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
    const payments = await paymentCollection.find(query).sort({ paidAt: -1 }).toArray();
    res.send(payments);
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch payments', error });
  }
});










    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // 404 Error Handler to ensure no 404 errors are returned blindly (Handle all unhandled routes)
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
        error: err
      });
    });
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