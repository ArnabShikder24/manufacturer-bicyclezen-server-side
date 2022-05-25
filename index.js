const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lk1qu.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const productCollection = client.db('bicycle_zen').collection('products');
        const orderCollection = client.db('bicycle_zen').collection('orders');

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

        app.get('/order', async (req, res) => {
            const email = req.query?.email;
            const query = {email: email};
            const orders = await orderCollection.find(query).toArray();
            res.send(orders);
        });

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
        });
    }
    finally {}
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Bicyclezen is Running On Server...')
});

app.listen(port, () => console.log('Bicyclezen running this port: ', port));
