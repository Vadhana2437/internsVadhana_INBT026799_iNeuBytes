
const express = require("express");
const cors = require("cors");
const initSqlJs = require("sql.js");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, "novamart.db");
let db;

app.use(cors({
  origin: ["http://127.0.0.1:5500", "http://localhost:5500"],
  credentials: true
}));

app.use(express.json());

app.use(session({
  name: "novamart.sid",
  secret: process.env.SESSION_SECRET || "novamart-local-development-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 2 * 60 * 60 * 1000
  }
}));

function saveDatabase() {
  const temp = dbPath + ".tmp";
  fs.writeFileSync(temp, Buffer.from(db.export()));
  fs.renameSync(temp, dbPath);
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

function one(sql, params = []) {
  return all(sql, params)[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      message: "Please log in first."
    });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({
        message: "Please log in first."
      });
    }

    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({
        message: "You do not have permission."
      });
    }

    next();
  };
}

function validProduct(p) {
  return p &&
    typeof p.name === "string" &&
    p.name.trim().length > 0 &&
    p.name.trim().length <= 100 &&
    typeof p.category === "string" &&
    p.category.trim().length > 0 &&
    p.category.trim().length <= 60 &&
    p.price !== "" &&
    Number.isFinite(Number(p.price)) &&
    Number(p.price) >= 0 &&
    p.stock !== "" &&
    Number.isInteger(Number(p.stock)) &&
    Number(p.stock) >= 0;
}

function getProduct(id) {
  return one("SELECT * FROM products WHERE id = ?", [Number(id)]);
}

function getProducts() {
  return all("SELECT * FROM products ORDER BY id DESC");
}

app.get("/", (req, res) => {
  res.send("NovaMart backend is running.");
});

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role = "customer" } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 72
    ) {
      return res.status(400).json({
        message: "Enter valid details. Password must be 8–72 characters."
      });
    }

    if (!["customer", "reseller"].includes(role)) {
      return res.status(400).json({
        message: "Choose customer or reseller."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (one("SELECT id FROM users WHERE email = ?", [normalizedEmail])) {
      return res.status(409).json({
        message: "Email already registered."
      });
    }

    const hash = await bcrypt.hash(password, 12);

    run(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [name.trim(), normalizedEmail, hash, role]
    );

    saveDatabase();

    res.status(201).json({
      message: "Registration successful. Please log in."
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Registration failed."
    });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = req.body.password;

    const user = one("SELECT * FROM users WHERE email = ?", [email]);

    if (
      !user ||
      typeof password !== "string" ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    req.session.regenerate(err => {
      if (err) {
        return res.status(500).json({
          message: "Unable to create session."
        });
      }

      req.session.user = publicUser(user);

      req.session.save(saveErr => {
        if (saveErr) {
          return res.status(500).json({
            message: "Unable to save session."
          });
        }

        res.json({
          message: "Login successful!",
          user: publicUser(user)
        });
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Login failed."
    });
  }
});

// CURRENT USER
app.get("/api/auth/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      message: "Not logged in."
    });
  }

  res.json({ user: req.session.user });
});

// LOGOUT
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({
        message: "Logout failed."
      });
    }

    res.clearCookie("novamart.sid", { path: "/" });
    res.json({ message: "Logout successful." });
  });
});

// GET ALL PRODUCTS
app.get("/api/products", (req, res) => {
  res.json(getProducts());
});

// GET ONE PRODUCT
app.get("/api/products/:id", (req, res) => {
  const product = getProduct(req.params.id);

  if (!product) {
    return res.status(404).json({
      message: "Product not found."
    });
  }

  res.json(product);
});

// ADD PRODUCT
app.post("/api/products", requireRole("reseller", "admin"), (req, res) => {
  if (!validProduct(req.body)) {
    return res.status(400).json({
      message: "Enter valid product details."
    });
  }

  const { name, category, price, stock } = req.body;

  run(
    "INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)",
    [name.trim(), category.trim(), Number(price), Number(stock)]
  );

  const product = one(
    "SELECT * FROM products WHERE id = last_insert_rowid()"
  );

  saveDatabase();

  res.status(201).json({
    message: "Product added successfully!",
    product
  });
});

// UPDATE PRODUCT
app.put("/api/products/:id", requireRole("reseller", "admin"), (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1 || !getProduct(id)) {
    return res.status(404).json({
      message: "Product not found."
    });
  }

  if (!validProduct(req.body)) {
    return res.status(400).json({
      message: "Enter valid product details."
    });
  }

  const { name, category, price, stock } = req.body;

  run(
    "UPDATE products SET name = ?, category = ?, price = ?, stock = ? WHERE id = ?",
    [name.trim(), category.trim(), Number(price), Number(stock), id]
  );

  saveDatabase();

  res.json({
    message: "Product updated successfully!",
    product: getProduct(id)
  });
});

// DELETE PRODUCT
app.delete("/api/products/:id", requireRole("reseller", "admin"), (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1 || !getProduct(id)) {
    return res.status(404).json({
      message: "Product not found."
    });
  }

  if (one("SELECT id FROM order_items WHERE product_id = ?", [id])) {
    return res.status(409).json({
      message: "This product is in an order and cannot be deleted."
    });
  }

  run("DELETE FROM products WHERE id = ?", [id]);
  saveDatabase();

  res.json({
    message: "Product deleted successfully!"
  });
});

// CUSTOMER CHECKOUT
app.post("/api/orders", requireRole("customer"), (req, res) => {
  const items = req.body.items;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      message: "Your cart is empty."
    });
  }

  const quantities = new Map();

  for (const item of items) {
    const id = Number(item.id);
    const quantity = Number(item.quantity);

    if (
      !Number.isInteger(id) || id < 1 ||
      !Number.isInteger(quantity) || quantity < 1 ||
      quantity > 1000
    ) {
      return res.status(400).json({
        message: "Invalid order items."
      });
    }

    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }

  let total = 0;
  const orderItems = [];

  for (const [id, quantity] of quantities) {
    const product = getProduct(id);

    if (!product) {
      return res.status(400).json({
        message: `Product ${id} not found.`
      });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        message: `Insufficient stock for ${product.name}.`
      });
    }

    orderItems.push({ product, quantity });
    total += Number(product.price) * quantity;
  }

  try {
    run("BEGIN TRANSACTION");

    run(
      "INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, 'Pending')",
      [req.session.user.id, total]
    );

    const orderId = one("SELECT last_insert_rowid() AS id").id;

    for (const item of orderItems) {
      run(
        `INSERT INTO order_items
        (order_id, product_id, product_name, quantity, price)
        VALUES (?, ?, ?, ?, ?)`,
        [
          orderId,
          item.product.id,
          item.product.name,
          item.quantity,
          item.product.price
        ]
      );

      run(
        "UPDATE products SET stock = stock - ? WHERE id = ?",
        [item.quantity, item.product.id]
      );
    }

    run("COMMIT");
    saveDatabase();

    res.status(201).json({
      message: "Order placed successfully!",
      order: one("SELECT * FROM orders WHERE id = ?", [orderId])
    });
  } catch (err) {
    try {
      run("ROLLBACK");
    } catch (_) {}

    console.error(err);

    res.status(500).json({
      message: "Could not place order."
    });
  }
});

// CUSTOMER ORDER HISTORY
app.get("/api/orders/my", requireRole("customer"), (req, res) => {
  const orders = all(
    "SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC",
    [req.session.user.id]
  );

  for (const order of orders) {
    order.items = all(
      "SELECT * FROM order_items WHERE order_id = ?",
      [order.id]
    );
  }

  res.json(orders);
});

// RESELLER / ADMIN ORDER LIST
app.get("/api/orders", requireRole("reseller", "admin"), (req, res) => {
  const orders = all(`
    SELECT orders.*,
           users.name AS customer_name,
           users.email AS customer_email
    FROM orders
    JOIN users ON users.id = orders.user_id
    ORDER BY orders.id DESC
  `);

  for (const order of orders) {
    order.items = all(
      "SELECT * FROM order_items WHERE order_id = ?",
      [order.id]
    );
  }

  res.json(orders);
});

// UPDATE ORDER STATUS
app.put("/api/orders/:id/status", requireRole("reseller", "admin"), (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  const allowed = [
    "Pending",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled"
  ];

  const order = one("SELECT * FROM orders WHERE id = ?", [id]);

  if (!order) {
    return res.status(404).json({
      message: "Order not found."
    });
  }

  if (!allowed.includes(status)) {
    return res.status(400).json({
      message: "Invalid order status."
    });
  }

  if (order.status === "Cancelled" || order.status === "Delivered") {
    return res.status(400).json({
      message: "This order can no longer be changed."
    });
  }

  try {
    run("BEGIN TRANSACTION");

    if (status === "Cancelled") {
      const items = all(
        "SELECT * FROM order_items WHERE order_id = ?",
        [id]
      );

      for (const item of items) {
        run(
          "UPDATE products SET stock = stock + ? WHERE id = ?",
          [item.quantity, item.product_id]
        );
      }
    }

    run("UPDATE orders SET status = ? WHERE id = ?", [status, id]);

    run("COMMIT");
    saveDatabase();

    res.json({
      message: "Order status updated.",
      order: one("SELECT * FROM orders WHERE id = ?", [id])
    });
  } catch (err) {
    try {
      run("ROLLBACK");
    } catch (_) {}

    console.error(err);

    res.status(500).json({
      message: "Could not update order status."
    });
  }
});

// INITIALIZE DATABASE AND START SERVER
async function startServer() {
  const SQL = await initSqlJs();

  db = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();

  run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL CHECK(price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0)
  )`);

  run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('customer', 'reseller', 'admin')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_amount REAL NOT NULL CHECK(total_amount >= 0),
    status TEXT NOT NULL DEFAULT 'Pending'
      CHECK(status IN ('Pending','Processing','Shipped','Delivered','Cancelled')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    price REAL NOT NULL CHECK(price >= 0),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`);

  saveDatabase();

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const email = process.env.ADMIN_EMAIL.trim().toLowerCase();

    if (!one("SELECT id FROM users WHERE email = ?", [email])) {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);

      run(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
        ["NovaMart Admin", email, hash]
      );

      saveDatabase();
      console.log("Initial admin account created.");
    }
  }

  app.listen(PORT, () => {
    console.log(`NovaMart backend running at http://127.0.0.1:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
