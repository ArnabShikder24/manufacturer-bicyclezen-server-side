const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
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

        app.post('/order', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send({success: true, result})
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
    }
    finally {}
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Bicyclezen is Running On Server...')
});

app.listen(port, () => console.log('Bicyclezen running this port: ', port));
