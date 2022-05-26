const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lk1qu.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if(!authHeader) {
        return res.status(401).send({message: 'UnAuthorized Access'})
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
        if(err) {
            return res.status(403).send({message: 'Forbidden Access'}) 
        }
        req.decoded = decoded
        next()
    })
}


async function run() {
    try {
        await client.connect();
        const productCollection = client.db('bicycle_zen').collection('products');
        const orderCollection = client.db('bicycle_zen').collection('orders');
        const userCollection = client.db('bicycle_zen').collection('users');
        const reviewCollection = client.db('bicycle_zen').collection('reviews');
        const profileCollection = client.db('bicycle_zen').collection('profiles');
        const paymentCollection = client.db('bicycle_zen').collection('payments');

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({email: requester})
            if(requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({message: 'Forbidden Access'})
            }
        }

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const order = req.body;
            const price = order.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types:['card']
            });
            res.send({clientSecret: paymentIntent.client_secret})
        });

        app.get('/product', async (req, res) => {
            const products = await productCollection.find().toArray();
            res.send(products);
        });

        app.get('/product/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await productCollection.findOne(query);
            res.send(result);
        });

        app.post('/product', verifyJWT, verifyAdmin, async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        });

        app.delete('/product/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = {_id: ObjectId(id)};
            const result = await productCollection.deleteOne(filter);
            res.send(result)
        });

        app.post('/order', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send({success: true, result})
        });

        app.get('/order', verifyJWT, async (req, res) => {
            const order = await orderCollection.find().toArray();
            res.send(order);
        });

        app.get('/order', verifyJWT, async (req, res) => {
            const email = req.query?.email;
            const decodedEmail = req.decoded?.email;            
            if(email === decodedEmail) {
                const query = {email: email};
                const orders = await orderCollection.find(query).toArray();
                return res.send(orders);
            }
            else {
                return res.status(403).send({message: 'Forbidden Access'})
            }
            
        });

        app.patch('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params?.id;
            const payment = req.body;
            const filter = {_id: ObjectId(id)}
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updateOrder = await orderCollection.updateOne(filter, updateDoc);
            res.send(updateOrder);
        })

        app.get('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params?.id;
            const query = {_id: ObjectId(id)}
            const result = await orderCollection.findOne(query);
            res.send(result);
        });

        app.put('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const shipped = req.body?.shipped;
            const filter = {_id: ObjectId(id)};
            const options = {upsert: true};
            const updateDoc = {
                $set: {
                    shipped: shipped,
                }
            }
            const result = await orderCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        });

        app.delete('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        });

        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({email: email});
            const isAdmin = user.role === 'admin';
            res.send({admin: isAdmin});
        });

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = {email: email};
            const updateDoc = {
                $set: {role: 'admin'},
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send({result});
        });

        // don't use jwt here
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = {email: email};
            const options = {upsert: true};
            const updateDoc = {
                $set: user,
            }
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({email: email}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1d'})
            res.send({result, token});
        });

        app.post('/review', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send({success: true, result})            
        });

        app.put('/profile/:email', async (req, res) => {
            const email = req.params.email;
            const profile = req.body;
            const filter = {email: email};
            const options = {upsert: true};
            const updateDoc = {
                $set: profile,
            }
            const result = await profileCollection.updateOne(filter, updateDoc, options);
            res.send({success: true, result})
        });

        app.get('/review', async (req, res) => {
            const reviews = await reviewCollection.find().toArray();
            res.send(reviews);
        });

    }
    finally {}
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Bicyclezen is Running On Server...')
});

app.listen(port, () => console.log('Bicyclezen running this port: ', port));
