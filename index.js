const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Connect to the SQLite database
const db = new sqlite3.Database('./example.db');

// Initialize the database with tables
const initializeDatabase = () => {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE
    )`);

    // Products table
    db.run(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL
    )`);

    // Orders table
    db.run(`CREATE TABLE IF NOT EXISTS orders (
      orderNo INTEGER PRIMARY KEY AUTOINCREMENT,
      customerId INTEGER NOT NULL,
      totalAmount REAL NOT NULL,
      FOREIGN KEY (customerId) REFERENCES users(id)
    )`);

    // Order Items table
    db.run(`CREATE TABLE IF NOT EXISTS order_items (
      orderId INTEGER,
      productId INTEGER,
      quantity INTEGER,
      FOREIGN KEY (orderId) REFERENCES orders(orderNo),
      FOREIGN KEY (productId) REFERENCES products(id)
    )`);
  });
};

// Initialize the database on startup
initializeDatabase();

// Define API endpoints

// Get all orders
app.get('/orders', (req, res) => {
  db.all(`SELECT * FROM orders`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/products', (req, res) => {
    const { name, price } = req.body;
    db.run(`INSERT INTO products (name, price) VALUES (?, ?)`, [name, price], function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ productId: this.lastID });
    });
  });
  
// Get a single order by orderNo
app.get('/orders/:orderNo', (req, res) => {
  const orderNo = req.params.orderNo;
  db.get(`SELECT * FROM orders WHERE orderNo = ?`, [orderNo], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Retrieve all products linked to this order
    db.all(`SELECT p.id, p.name, oi.quantity, p.price
      FROM order_items oi
      JOIN products p ON oi.productId = p.id
      WHERE oi.orderId = ?`, [orderNo], (err, products) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      row.products = products;
      res.json(row);
    });
  });
});

// Create a new order
app.post('/orders', (req, res) => {
  const { customerId, items } = req.body;
  let totalAmount = 0;

  // Calculate the total amount
  items.forEach(item => {
    totalAmount += item.price * item.quantity;
  });

  // Insert the order
  db.run(`INSERT INTO orders (customerId, totalAmount) VALUES (?, ?)`, [customerId, totalAmount], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const orderId = this.lastID;

    // Insert each item into the order_items table
    const stmt = db.prepare(`INSERT INTO order_items (orderId, productId, quantity) VALUES (?, ?, ?)`);
    items.forEach(item => {
      stmt.run(orderId, item.productId, item.quantity);
    });
    stmt.finalize();

    res.status(201).json({ orderNo: orderId });
  });
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
