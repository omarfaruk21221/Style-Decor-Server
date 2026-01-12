const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 3000;

const admin = require("firebase-admin");
const decoded = Buffer.from(
  process.env.FIREBASE_SERVICE_ACCOUNT,
  "base64"
).toString("utf8");
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const crypto = require("crypto");
function generateTrackingId() {
  const prefix = "PRCL"; // your brand prefix
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const random = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6-char random hex
  return `${prefix}-${date}-${random}`;
}

/// middleware
app.use(cors());
app.use(express.json());

//// Firebase token verification
const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res
      .status(401)
      .send({ message: "Unauthorized access: No token provided" });
  }
  try {
    const idToken = token.split(" ")[1];
    if (!idToken) throw new Error("Token missing after Bearer");

    const decode = await admin.auth().verifyIdToken(idToken);
    req.decode_email = decode.email;
    next();
  } catch (err) {
    console.error("Firebase token verification error:", err);
    return res.status(401).send({
      message: "Unauthorized access: Invalid token",
      error: err.message,
    });
  }
};
// ----- mongodb----
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
// ---connection -----
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // ====create Database =====
    const db = client.db("style_decor_DB");
    const userCollection = db.collection("users");
    const serviceCollection = db.collection("services");
    const bookingCollection = db.collection("bookings");
    const paymentCollection = db.collection("payments");

    //// Admin verification middleware
    const verifyAdmin = async (req, res, next) => {
      try {
        const email = req.decode_email;
        if (!email)
          return res
            .status(401)
            .send({ message: "Unauthorized access: No email found" });

        const user = await userCollection.findOne({ email });
        if (!user || user.role !== "admin")
          return res
            .status(403)
            .send({ message: "Forbidden access: Admins only" });

        next();
      } catch (error) {
        console.error("verifyAdmin error:", error);
        res.status(500).send({
          message: "Server error verifying admin",
          error: error.message,
        });
      }
    };

    // ================ Api =================
    // ================= Routes =================

    // Users
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        user.role = "user";
        user.createdAt = new Date();
        const userEmail = user.email;
        const userExist = await userCollection.findOne({ email: userEmail });
        if (userExist) {
          return res.status(400).send({ message: "User already exists" });
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to create user", error });
      }
    });
    // verifyFBToken,verifyAdmin,
    app.get("/users", verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const searchText = req.query.searchText || "";
        const sortOrder = req.query.sortOrder || "asc";
        const filter = {
          $or: [
            { name: { $regex: searchText, $options: "i" } },
            { email: { $regex: searchText, $options: "i" } },
          ],
        };
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

    app.get("/users/active-decorators", verifyFBToken, async (req, res) => {
      try {
        const query = { role: "decorator", status: "active" };
        const decorators = await userCollection.find(query).toArray();
        res.send(decorators);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Failed to fetch active decorators", error });
      }
    });

    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await userCollection.findOne({ email });
        res.send(user);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch user role", error });
      }
    });

    app.patch(
      "/users/:id/role",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.params.id;
          const roleInfo = req.body;
          const query = { _id: new ObjectId(id) };
          const updatedDoc = {
            $set: {
              role: roleInfo.role,
              status: "active",
            },
          };
          const result = await userCollection.updateOne(query, updatedDoc);
          res.send(result);
        } catch (error) {
          res
            .status(500)
            .send({ message: "Failed to update user role", error });
        }
      }
    );

    app.delete("/users/:id", verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete user", error });
      }
    });

    // Services
    app.post("/services", verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const service = req.body;
        service.createdAt = new Date();
        const result = await serviceCollection.insertOne(service);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to create service", error });
      }
    });

    app.get("/services", async (req, res) => {
      try {
        // Simple get all sorted by createdAt
        const limit = parseInt(req.query.limit);
        const services = await serviceCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(limit)
          .toArray();
        res.send(services);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch services", error });
      }
    });

    app.patch("/services/:id", verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const updateData = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: updateData };
        const result = await serviceCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update service", error });
      }
    });

    app.delete(
      "/services/:id",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.params.id;
          const filter = { _id: new ObjectId(id) };
          const result = await serviceCollection.deleteOne(filter);
          res.send(result);
        } catch (error) {
          res.status(500).send({ message: "Failed to delete service", error });
        }
      }
    );

    // ============ Bookings related APIS==========================
    // --------create booking -------------
    app.post("/bookings", verifyFBToken, async (req, res) => {
      try {
        const booking = req.body;
        const result = await bookingCollection.insertOne(booking);
        res.send(result);
      } catch (error) {
        console.error("Error creating booking:", error);
        res.status(500).send({ message: "Failed to create booking", error });
      }
    });
    // --------get booking by email ans quert--------------------
    app.get("/bookings", verifyFBToken, async (req, res) => {
      try {
        const { email, paymentStatus, deliveryStatus } = req.query;
        let query = {};

        if (email) query.userEmail = email;
        if (paymentStatus) query.paymentStatus = paymentStatus;
        if (deliveryStatus) query.deliveryStatus = deliveryStatus;

        const bookings = await bookingCollection.find(query).toArray();
        res.send(bookings);
      } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).send({ message: "Failed to fetch bookings", error });
      }
    });
    // ==-----get booking just delivary complated for admin --------------
    // --------get booking by email and query--------------------
    app.get("/bookings", verifyFBToken, async (req, res) => {
      try {
        const { deliveryStatus } = req.query;
        let query = {};
        if (deliveryStatus) query.deliveryStatus = deliveryStatus;
        const bookings = await bookingCollection.find(query).toArray();
        res.send(bookings);
      } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).send({ message: "Failed to fetch bookings", error });
      }
    });

    // --------get booking by id for t--------------------
    app.get("/bookings/:id", verifyFBToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const booking = await bookingCollection.findOne(query);
        res.send(booking);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch booking", error });
      }
    });
    // GET /bookings/decorator/:email
    app.get("/bookings/decorator/:email", async (req, res) => {
      const decoratorEmail = req.params.email;
      try {
        if (!decoratorEmail) {
          return res
            .status(400)
            .send({ message: "Decorator email is required" });
        }
        const query = { decoratorEmail };
        const bookings = await bookingCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();
        res.send(bookings);
      } catch (error) {
        console.error("Error fetching decorator bookings:", error);
        res.status(500).send({
          message: "Failed to fetch assigned bookings",
          error: error.message,
        });
      }
    });

    // GET /decorator-earnings?email=user@example.com
    app.get("/bookings/decorator-earnings/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { decoratorEmail: email, deliveryStatus: "completed" };
        const bookings = await bookingCollection
          .find(query)
          .sort({ completedAt: -1 })
          .toArray();
        res.send(bookings);
      } catch (error) {
        console.error("Failed to fetch bookings:", error);
        res.status(500).send({ message: "Failed to fetch bookings", error });
      }
    });

    // --------deleted booking ------
    app.delete("/bookings/:id", verifyFBToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await bookingCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete booking", error });
      }
    });
    // ------------update booking by id -------------
    app.patch("/bookings/:id", verifyFBToken, async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedBooking = req.body;
        delete updatedBooking._id;
        const updateDoc = { $set: updatedBooking };
        const result = await bookingCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating booking:", error);
        res.status(500).send({ message: "Failed to update booking", error });
      }
    });
    // ----------------- updated booking added decorato assign status ------------
    app.patch("/bookings/:id/assign-decorator", async (req, res) => {
      try {
        const bookingId = req.params.id;
        const { decoratorId, decoratorName, decoratorEmail, deliveryStatus } =
          req.body;
        if (!decoratorId || !decoratorName || !decoratorEmail) {
          return res.status(400).send({ message: "Decorator info missing" });
        }
        const bookingQuery = { _id: new ObjectId(bookingId) };
        const bookingUpdateDoc = {
          $set: {
            decoratorId,
            decoratorName,
            decoratorEmail,
            assignedAt: new Date(),

            deliveryStatus: deliveryStatus || "assigned",
          },
        };
        const bookingResult = await bookingCollection.updateOne(
          bookingQuery,
          bookingUpdateDoc
        );

        const decoratorQuery = { _id: new ObjectId(decoratorId) };
        const decoratorUpdateDoc = { $set: { status: "assigned" } };
        const decoratorResult = await userCollection.updateOne(
          decoratorQuery,
          decoratorUpdateDoc
        );

        res.send({ success: true, bookingResult, decoratorResult });
      } catch (error) {
        res.status(500).send({ message: "Failed to assign decorator", error });
      }
    });
    // -------------- action decorator --------------
    app.patch("/bookings/:id/decorator-action", async (req, res) => {
      try {
        const bookingId = req.params.id;
        const { action } = req.query;

        if (!ObjectId.isValid(bookingId)) {
          return res.status(400).send({ message: "Invalid booking ID format" });
        }

        const query = { _id: new ObjectId(bookingId) };

        const booking = await bookingCollection.findOne(query);
        if (!booking) {
          return res.status(404).send({ message: "Booking not found" });
        }

        const decoratorId = booking?.decoratorId;
        if (!decoratorId) {
          return res
            .status(400)
            .send({ message: "No decorator assigned to this booking" });
        }

        if (!ObjectId.isValid(decoratorId)) {
          return res
            .status(400)
            .send({ message: "Invalid decorator ID associated with booking" });
        }

        const decoratorQuery = { _id: new ObjectId(decoratorId) };
        let bookingUpdateDoc = {};
        let decoratorUpdateDoc = {};

        if (action === "accept") {
          bookingUpdateDoc = {
            $set: {
              deliveryStatus: "accepted-decorator",
              acceptedAt: new Date(),
            },
          };
          decoratorUpdateDoc = {
            $set: { status: "accepted-service" },
          };
        } else if (action === "completed") {
          const price = parseFloat(booking.price);
          const safePrice = isNaN(price) ? 0 : price;
          const decoratorCost = safePrice * 0.1;

          bookingUpdateDoc = {
            $set: {
              deliveryStatus: "completed",
              completedAt: new Date(),
              decoratorCost: decoratorCost,
            },
          };
          decoratorUpdateDoc = {
            $set: { status: "active" },
          };
        } else {
          return res.status(400).send({
            message: "Invalid action. Supported actions: accept, completed",
          });
        }

        const bookingResult = await bookingCollection.updateOne(
          query,
          bookingUpdateDoc
        );
        const decoratorResult = await userCollection.updateOne(
          decoratorQuery,
          decoratorUpdateDoc
        );

        res.send({ success: true, bookingResult, decoratorResult });
      } catch (error) {
        console.error("Decorator action error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to update booking",
          error: error.message,
        });
      }
    });

    // Payment
    app.post("/create-checkout-session", async (req, res) => {
      try {
        const {
          price,
          bookingId,
          serviceId,
          serviceName,
          userEmail,
          serviceImage,
        } = req.body;
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
                  metadata: {
                    bookingId,
                    serviceId,
                    serviceName,
                    serviceImage,
                    userEmail,
                  },
                },
                unit_amount: amountInCents,
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${process.env.CLIENT_URL}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.CLIENT_URL}/dashboard/payment-cancel`,
          metadata: {
            bookingId,
            serviceId,
            serviceName,
            serviceImage,
            userEmail,
          },
        });

        console.log("Stripe session created:", session.url);
        res.status(200).json({ url: session.url });
      } catch (error) {
        console.error("Stripe session creation error:", error);
        res.status(500).json({ message: error.message });
      }
    });

    app.patch("/payment-success", async (req, res) => {
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
            paidAt: new Date().toLocaleDateString(),
          },
        };

        const options = { upsert: true, returnDocument: "after" };
        const paymentResult = await paymentCollection.findOneAndUpdate(
          filter,
          update,
          options
        );

        if (!paymentResult.lastErrorObject?.updatedExisting) {
          const bookingId = session.metadata.bookingId;
          await bookingCollection.updateOne(
            { _id: new ObjectId(bookingId) },
            {
              $set: {
                paymentStatus: "paid",
                deliveryStatus: "pending-pickup",
                trackingId,
              },
            }
          );

          return res.send({
            success: true,
            trackingId,
            transactionalId,
            paymentInfo: paymentResult.value,
          });
        } else {
          return res.send({
            success: false,
            message: "Payment already exists",
            trackingId: paymentResult.value.trackingId,
            transactionalId,
          });
        }
      } catch (error) {
        res
          .status(500)
          .send({ message: "Payment success handling failed", error });
      }
    });

    app.get("/payments", async (req, res) => {
      try {
        const { email } = req.query;
        const query = email ? { customerEmail: email } : {};
        const payments = await paymentCollection
          .find(query)
          .sort({ paidAt: -1 })
          .toArray();
        res.send(payments);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch payments", error });
      }
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
// ---- output Api ----
app.get("/", (req, res) => {
  res.send("stude-decor Server is runing bro!!!!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
