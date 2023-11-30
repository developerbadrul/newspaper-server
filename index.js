const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_UserName}:${process.env.DB_PassWord}@cluster0.zyvfoih.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const userCollection = client.db("newspaperDB").collection("users")
    const articlesCollection = client.db("newspaperDB").collection("articles")

    //create jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;
      // console.log("user in ganerate token", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });
      // console.log({ token });
      res.send({ token })
    })

    // middlewares 
    const verifyToken = (req, res, next) => {
      // console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        // console.log("inside verify jwt", "decoded :", decoded, "req.decoded :" req.decoded);
        req.decoded = decoded;
        next()
      })
    }

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next()
    }

    //get  all users
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.find().toArray()
      res.send(users)
    })
    // new users
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const query = { email: newUser.email };
      const exitingUser = await userCollection.findOne(query);
      if (exitingUser) {
        return res.send({ message: "user already exit", insertedId: null })
      }
      const result = await userCollection.insertOne(newUser)
      res.send(result);
    })

    // add publisher 
    app.post("/users/publisher", async (req, res) => {
      const newPublisher = req.body;
      const result = await userCollection.insertOne(newPublisher)
      res.send(result)
    })

    // make admin
    app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: "admin"
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    //get  all publisher
    app.get("/publisher", async (req, res) => {
      const query = { role: "publisher" }
      const users = await userCollection.find(query).toArray()
      res.send(users)
    })

    // get general user
    app.get("/general/user", async (req, res) => {
      const query = { type: { $ne: "premium" } }
      const result = await userCollection.find(query).toArray()
      res.send(result);
    })

    // send user control
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log("check email param", email);
      // console.log("check decode Email", req.decoded.email);
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query)
      let admin = false;
      if (user) {
        admin = user?.role === "admin"
      }
      res.send({ admin });
    })

    // all user Count
    app.get("/users/count", async (req, res) => {
      const userCount = await userCollection.countDocuments();
      res.send({ userCount })
    })
    // count all premium user
    app.get("/users/premium", async (req, res) => {
      const premiumUserCount = await userCollection.countDocuments({ type: "premium" });
      res.send({ premiumUserCount });
    });

    // get all artical
    app.get("/allartical", async (req, res) => {
      try {
          const result = await articlesCollection.find().toArray();
          res.send(result);
      } catch (error) {
          console.error('Error fetching all articles:', error);
          res.status(500).send({ error: 'Internal Server Error' });
      }
  });

    //add Artical
    app.post("/addartical", async(req,res)=>{
      const newArticle = req.body;
      const result = articlesCollection.insertOne(newArticle);
      res.send(result)
    })
    

    // delete user

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get("/", (req, res) => {
  res.send("News Server is Running")
})

app.listen(port, () => {
  console.log(`Server is Running port ${port}`);
})