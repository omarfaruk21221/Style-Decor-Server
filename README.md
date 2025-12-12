async function run() {
  try {
    await client.connect();

    const db = client.db("style_decor_DB");
    const userCollection = db.collection("users");
    const serviceCollection = db.collection("services");
    const bookingCollection = db.collection("bookings");
    const paymentCollection = db.collection("payments");


    // ====================== USERS API ======================
    app.post('/users', async (req, res) => {
      try {
        const user = req.body;
        user.role = "user";
        user.createdAt = new Date();

        const exists = await userCollection.findOne({ email: user.email });
        if (exists) return res.status(400).send({ message: "User Exists" });

        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to create user", error });
      }
    });

    app.get('/users', async (req, res) => {
      try {
        const users = await userCollection.find().toArray();
        res.send(users);
      } catch (error) {
        res.status(500).send({ message: "Error fetching users", error });
      }
    });

    app.get('/users/:email', async (req, res) => {
      try {
        const user = await userCollection.findOne({ email: req.params.email });
        res.send(user);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch user role", error });
      }
    });

    // ====================== SERVICES API ======================
    app.post('/services', async (req, res) => {
      try {
        const service = req.body;
        service.createdAt = new Date();
        const result = await serviceCollection.insertOne(service);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to create service", error });
      }
    });

    app.get('/services', async (req, res) => {
      try {
        const services = await serviceCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        res.send({ success: true, data: services });
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch services", error });
      }
    });

    // ====================== BOOKINGS API ======================
    // ============== Create Booking ===============
    app.post('/bookings', async (req, res) => {
      try {
        const booking = req.body;
        const result = await bookingCollection.insertOne(booking);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to create booking", error });
      }
    });
    //  ================ get data booking by email =================
    app.get("/bookings", async (req, res) => {
      const email = req.query.email;
      if (!email) return res.status(400).send({ message: "Email required" });
      const bookings = await bookingCollection.find().toArray();
      res.send(bookings);
    });


    app.get('/booking/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const booking = await bookingCollection.findOne(query);
      res.send(booking);
    });

    // ====================== STRIPE PAYMENT API ======================
    app.post('/create-checkout-session', async (req, res) => {
      if (!stripe) {
        return res.status(500).send({ message: "Stripe is not configured on the server." });
      }

      try {
        const paymentInfo = req.body;
        const amountInCents = Number(paymentInfo.price) * 100;

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",
          customer_email: paymentInfo.userEmail,
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: amountInCents,
                product_data: {
                  name: paymentInfo.serviceName,
                }
              },
              quantity: 1
            }
          ],
          metadata: {
            bookingId: paymentInfo.bookingId,
            userEmail: paymentInfo.userEmail,
            serviceName: paymentInfo.serviceName
          },
          success_url: `${process.env.SITE_DOMAIN}/payment/payment-history?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.SITE_DOMAIN}/payment/payment-cancel`
        });

        res.send({ url: session.url });
      } catch (error) {
        console.error("Stripe Error:", error);
        res.status(500).send({ message: "Stripe Session Creation Failed", error });
      }
    });

    // MongoDB Ping
    await client.db("admin").command({ ping: 1 });
    console.log("✅ MongoDB Connected Successfully");

    // 404 Error Handler (Handle all unhandled routes)
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

  } catch (error) {
    console.error("MongoDB Error:", error);
  }
}