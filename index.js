const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000
// ----strip =---
// const stripe = require('stripe')(process.env.STRIPE);
/// middleware
app.use(express.json())
app.use(cors())

// ----mongo db data base connection start----
const uri = process.env.MONGODB_URI

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
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

    //// middleware with database
    // const verifyAdmin = async (req, res, next) => {
    //     const email = req.decode_email;
    //     const query = { email }
    //     const user = await userCollection.findOne(query)
    //     if (!user || user.role !== 'admin') {
    //         return res.status(403).send({ massage: 'forbidden access' })
    //     }
    //     next()
    // }

    // ======= user related Api =========

    // ---- created and send Database user Api ------
    app.post('/users', async (req, res) => {
      const user = req.body
      user.role = 'user'
      user.creatAt = new Date()
      const userEmail = user.email
      const userExist = await userCollection.findOne({email: userEmail})
      if (userExist) {
        return res.status(400).send({message: 'User already exists'})
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })



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