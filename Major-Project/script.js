
const API_URL = "http://127.0.0.1:3000/api";
const CART_KEY = "novamart_cart";

const $ = id => document.getElementById(id);

let currentUser = null;
let products = [];
let editingProductId = null;
let cart = readCart();

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

async function api(path, options = {}) {
  const response = await fetch(API_URL + path, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

function setMessage(id, message, success = false) {
  $(id).textContent = message;
  $(id).style.color = success ? "#17865e" : "#c23c4b";
}

function showAuth(mode = "login") {
  $("authSection").classList.remove("hidden");
  $("dashboardSection").classList.add("hidden");
  $("manage").classList.add("hidden");
  $("cartSection").classList.add("hidden");
  $("ordersSection").classList.add("hidden");

  $("loginForm").classList.toggle("hidden", mode !== "login");
  $("registerForm").classList.toggle("hidden", mode !== "register");
  $("showLogin").classList.toggle("active", mode === "login");
  $("showRegister").classList.toggle("active", mode === "register");

  $("loginMessage").textContent = "";
  $("registerMessage").textContent = "";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderLayout() {
  const loggedIn = Boolean(currentUser);
  const role = currentUser?.role;
  const customer = role === "customer";
  const manager = ["reseller", "admin"].includes(role);

  $("authSection").classList.toggle("hidden", loggedIn);
  $("dashboardSection").classList.toggle("hidden", !loggedIn);
  $("loginNav").classList.toggle("hidden", loggedIn);
  $("registerNav").classList.toggle("hidden", loggedIn);
  $("logoutBtn").classList.toggle("hidden", !loggedIn);
  $("userBadge").classList.toggle("hidden", !loggedIn);

  $("manageNav").classList.toggle("hidden", !manager);
  $("manage").classList.toggle("hidden", !manager);

  $("cartNav").classList.toggle("hidden", !customer);
  $("cartSection").classList.toggle("hidden", !customer);

  $("ordersNav").classList.toggle("hidden", !customer);
  $("adminOrdersNav").classList.toggle("hidden", !manager);

  if (!loggedIn) {
    $("userBadge").textContent = "";
    $("ordersSection").classList.add("hidden");
    return;
  }

  $("userBadge").textContent = currentUser.name;
  $("welcomeTitle").textContent = `Welcome, ${currentUser.name}!`;
  $("roleBadge").textContent = role.toUpperCase();
  $("statRole").textContent = role;

  $("roleDescription").textContent = {
    customer: "Browse products, place orders and track deliveries.",
    reseller: "Manage products, inventory and customer orders.",
    admin: "Manage the product catalogue and customer orders."
  }[role] || "Welcome to NovaMart.";

  updateStats();
}

function updateStats() {
  $("statProducts").textContent = products.length;
  $("statCart").textContent = cart.reduce(
    (total, item) => total + item.quantity, 0
  );
}

function getEmoji(category) {
  const key = String(category || "").toLowerCase();

  const emojiMap = [
    ["electronics", "🎧"],
    ["fashion", "👕"],
    ["clothing", "👕"],
    ["accessories", "⌚"],
    ["home", "🏠"],
    ["furniture", "🪑"],
    ["books", "📚"],
    ["beauty", "🧴"],
    ["sports", "⚽"],
    ["grocery", "🥑"],
    ["food", "🍎"]
  ];

  return emojiMap.find(([name]) => key.includes(name))?.[1] || "🛍️";
}

function formatPrice(price) {
  return Number(price).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  });
}

async function loadProducts() {
  try {
    products = await api("/products");
    updateCategories();
    renderProducts();
    updateStats();
  } catch (error) {
    $("productList").textContent =
      "Cannot connect to backend. Please run node server.js.";
    setMessage("catalogMessage", error.message);
  }
}

function updateCategories() {
  const selected = $("categoryFilter").value;
  const categories = [...new Set(products.map(p => p.category))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  $("categoryFilter").replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All Categories";
  $("categoryFilter").appendChild(allOption);

  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    $("categoryFilter").appendChild(option);
  });

  if (categories.includes(selected)) {
    $("categoryFilter").value = selected;
  }
}

function renderProducts() {
  const term = $("searchInput").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const sort = $("sortSelect").value;

  let filtered = products.filter(product =>
    (
      String(product.name).toLowerCase().includes(term) ||
      String(product.category).toLowerCase().includes(term)
    ) &&
    (category === "all" || product.category === category)
  );

  if (sort === "low") {
    filtered.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (sort === "high") {
    filtered.sort((a, b) => Number(b.price) - Number(a.price));
  } else if (sort === "name") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  $("productCount").textContent = `${filtered.length} products`;
  $("productList").replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = products.length
      ? "No matching products found."
      : "No products available yet.";
    $("productList").appendChild(empty);
    return;
  }

  filtered.forEach(product => {
    const card = document.createElement("article");
    card.className = "product-card";

    const art = document.createElement("div");
    art.className = "product-art";
    art.textContent = getEmoji(product.category);

    const details = document.createElement("div");
    details.className = "product-details";

    const categoryLabel = document.createElement("span");
    categoryLabel.className = "product-category";
    categoryLabel.textContent = product.category;

    const name = document.createElement("h3");
    name.textContent = product.name;

    const stock = document.createElement("span");
    stock.className = "stock-label";
    stock.textContent = Number(product.stock) > 0
      ? `${product.stock} in stock`
      : "Out of stock";

    if (Number(product.stock) <= 0) stock.classList.add("out");

    const bottom = document.createElement("div");
    bottom.className = "product-bottom";

    const price = document.createElement("span");
    price.className = "product-price";
    price.textContent = formatPrice(product.price);
    bottom.appendChild(price);

    if (currentUser?.role === "customer") {
      const addButton = document.createElement("button");
      addButton.className = "icon-btn";
      addButton.textContent = "Add to Cart";
      addButton.disabled = Number(product.stock) <= 0;
      addButton.addEventListener("click", () => addToCart(product));
      bottom.appendChild(addButton);
    }

    if (["reseller", "admin"].includes(currentUser?.role)) {
      const editButton = document.createElement("button");
      editButton.className = "icon-btn";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => startEdit(product));

      const deleteButton = document.createElement("button");
      deleteButton.className = "icon-btn";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => deleteProduct(product));

      bottom.append(editButton, deleteButton);
    }

    details.append(categoryLabel, name, stock, bottom);
    card.append(art, details);
    $("productList").appendChild(card);
  });
}

function addToCart(product) {
  if (!currentUser || currentUser.role !== "customer") {
    showAuth("login");
    return;
  }

  const existing = cart.find(item => Number(item.id) === Number(product.id));
  const quantity = existing ? existing.quantity : 0;

  if (quantity >= Number(product.stock)) {
    alert("You cannot add more than the available stock.");
    return;
  }

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      quantity: 1
    });
  }

  saveCart();
  renderCart();
  updateStats();
}

function renderCart() {
  $("cartItems").replaceChildren();

  if (!cart.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Your shopping cart is empty.";
    $("cartItems").appendChild(empty);
  }

  cart.forEach(item => {
    const row = document.createElement("div");
    row.className = "cart-item";

    const info = document.createElement("div");
    info.className = "cart-item-info";

    const name = document.createElement("h3");
    name.textContent = item.name;

    const price = document.createElement("p");
    price.textContent = `${formatPrice(item.price)} each`;

    info.append(name, price);

    const controls = document.createElement("div");
    controls.className = "quantity-controls";

    const minus = document.createElement("button");
    minus.textContent = "−";
    minus.addEventListener("click", () => changeQuantity(item.id, -1));

    const quantity = document.createElement("span");
    quantity.textContent = item.quantity;

    const plus = document.createElement("button");
    plus.textContent = "+";
    plus.addEventListener("click", () => changeQuantity(item.id, 1));

    const remove = document.createElement("button");
    remove.className = "icon-btn";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      cart = cart.filter(cartItem => Number(cartItem.id) !== Number(item.id));
      saveCart();
      renderCart();
      updateStats();
    });

    controls.append(minus, quantity, plus, remove);
    row.append(info, controls);
    $("cartItems").appendChild(row);
  });

  const total = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity, 0
  );

  $("cartTotal").textContent = formatPrice(total);
  $("checkoutBtn").disabled = cart.length === 0;
}

function changeQuantity(id, amount) {
  const item = cart.find(cartItem => Number(cartItem.id) === Number(id));
  const product = products.find(p => Number(p.id) === Number(id));

  if (!item) return;

  if (amount > 0 && (!product || item.quantity >= Number(product.stock))) {
    alert("Maximum available stock reached.");
    return;
  }

  item.quantity += amount;

  if (item.quantity <= 0) {
    cart = cart.filter(cartItem => Number(cartItem.id) !== Number(id));
  }

  saveCart();
  renderCart();
  updateStats();
}

// CHECKOUT / PLACE ORDER
$("checkoutBtn").addEventListener("click", async () => {
  if (!currentUser || currentUser.role !== "customer") {
    setMessage("checkoutMessage", "Please log in as a customer.");
    return;
  }

  if (!cart.length) {
    setMessage("checkoutMessage", "Your cart is empty.");
    return;
  }

  const confirmed = confirm(
    `Place your order for ${$("cartTotal").textContent}?`
  );

  if (!confirmed) return;

  $("checkoutBtn").disabled = true;
  setMessage("checkoutMessage", "Placing your order...", true);

  try {
    const result = await api("/orders", {
      method: "POST",
      body: JSON.stringify({
        items: cart.map(item => ({
          id: item.id,
          quantity: item.quantity
        }))
      })
    });

    cart = [];
    saveCart();

    setMessage("checkoutMessage", result.message, true);

    await loadProducts();
    renderCart();
    updateStats();
    await loadOrders();

    $("ordersSection").classList.remove("hidden");
    $("ordersSection").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    setMessage("checkoutMessage", error.message);
  } finally {
    $("checkoutBtn").disabled = cart.length === 0;
  }
});

// ORDER HISTORY AND ORDER MANAGEMENT
function addTextElement(parent, tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

async function loadOrders() {
  if (!currentUser) return;

  const manager = ["reseller", "admin"].includes(currentUser.role);

  $("ordersTitle").textContent = manager ? "Customer Orders" : "My Orders";
  $("ordersEyebrow").textContent = manager ? "ORDER MANAGEMENT" : "ORDER HISTORY";
  $("ordersDescription").textContent = manager
    ? "View customer purchases and update order status."
    : "View your purchases and track their status.";

  $("ordersList").replaceChildren();
  setMessage("ordersMessage", "Loading orders...", true);

  try {
    const orders = await api(manager ? "/orders" : "/orders/my");

    $("ordersList").replaceChildren();

    if (!orders.length) {
      addTextElement(
        $("ordersList"),
        "div",
        manager ? "No customer orders yet." : "You have not placed any orders yet.",
        "empty-state"
      );
      setMessage("ordersMessage", "", true);
      return;
    }

    orders.forEach(order => {
      const card = document.createElement("article");
      card.className = "cart-item";
      card.style.display = "block";
      card.style.marginBottom = "16px";

      addTextElement(card, "h3", `Order #${order.id}`);

      if (manager) {
        addTextElement(
          card,
          "p",
          `Customer: ${order.customer_name || "Customer"} (${order.customer_email || ""})`
        );
      }

      addTextElement(card, "p", `Date: ${order.created_at || "N/A"}`);
      addTextElement(card, "p", `Total: ${formatPrice(order.total_amount)}`);
      addTextElement(card, "p", `Status: ${order.status}`, "stock-label");

      const itemList = document.createElement("ul");

      (order.items || []).forEach(item => {
        addTextElement(
          itemList,
          "li",
          `${item.product_name} × ${item.quantity} — ${formatPrice(Number(item.price) * Number(item.quantity))}`
        );
      });

      card.appendChild(itemList);

      if (manager && !["Delivered", "Cancelled"].includes(order.status)) {
        const statusLabel = document.createElement("label");
        statusLabel.textContent = "Update order status";

        const statusSelect = document.createElement("select");

        ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"]
          .forEach(status => {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = status;
            option.selected = status === order.status;
            statusSelect.appendChild(option);
          });

        const updateButton = document.createElement("button");
        updateButton.className = "primary-btn";
        updateButton.textContent = "Update Status";

        updateButton.addEventListener("click", async () => {
          updateButton.disabled = true;

          try {
            const result = await api(`/orders/${order.id}/status`, {
              method: "PUT",
              body: JSON.stringify({ status: statusSelect.value })
            });

            setMessage("ordersMessage", result.message, true);
            await loadOrders();
            await loadProducts();
          } catch (error) {
            setMessage("ordersMessage", error.message);
          } finally {
            updateButton.disabled = false;
          }
        });

        card.append(statusLabel, statusSelect, updateButton);
      }

      $("ordersList").appendChild(card);
    });

    setMessage("ordersMessage", "", true);
  } catch (error) {
    setMessage("ordersMessage", error.message);
  }
}

// PRODUCT MANAGEMENT
function startEdit(product) {
  editingProductId = product.id;

  $("productName").value = product.name;
  $("productCategory").value = product.category;
  $("productPrice").value = product.price;
  $("productStock").value = product.stock;

  $("productFormTitle").textContent = "Edit Product";
  $("productSubmit").textContent = "Save Changes";
  $("cancelEdit").classList.remove("hidden");
  $("productMessage").textContent = "";

  $("manage").scrollIntoView({ behavior: "smooth" });
}

function resetProductForm() {
  $("productForm").reset();
  editingProductId = null;
  $("productFormTitle").textContent = "Add New Product";
  $("productSubmit").textContent = "Add Product";
  $("cancelEdit").classList.add("hidden");
}

$("cancelEdit").addEventListener("click", resetProductForm);

async function deleteProduct(product) {
  if (!confirm(`Delete "${product.name}"?`)) return;

  try {
    const result = await api(`/products/${product.id}`, {
      method: "DELETE"
    });

    if (editingProductId === product.id) resetProductForm();

    setMessage("catalogMessage", result.message, true);
    await loadProducts();
  } catch (error) {
    setMessage("catalogMessage", error.message);
  }
}

$("productForm").addEventListener("submit", async event => {
  event.preventDefault();

  const name = $("productName").value.trim();
  const category = $("productCategory").value.trim();
  const priceText = $("productPrice").value;
  const stockText = $("productStock").value;
  const price = Number(priceText);
  const stock = Number(stockText);

  if (
    !name || name.length > 100 ||
    !category || category.length > 60 ||
    priceText === "" || !Number.isFinite(price) || price < 0 ||
    stockText === "" || !Number.isInteger(stock) || stock < 0
  ) {
    setMessage("productMessage", "Enter valid product details.");
    return;
  }

  const isEditing = editingProductId !== null;
  $("productSubmit").disabled = true;

  try {
    const result = await api(
      isEditing ? `/products/${editingProductId}` : "/products",
      {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify({ name, category, price, stock })
      }
    );

    resetProductForm();
    setMessage("productMessage", result.message, true);
    await loadProducts();
  } catch (error) {
    setMessage("productMessage", error.message);
  } finally {
    $("productSubmit").disabled = false;
  }
});

// LOGIN
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  $("loginSubmit").disabled = true;
  setMessage("loginMessage", "Logging in...", true);

  try {
    const result = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: $("loginEmail").value.trim(),
        password: $("loginPassword").value
      })
    });

    currentUser = result.user;
    $("loginForm").reset();

    renderLayout();
    renderProducts();
    renderCart();

    if (["reseller", "admin"].includes(currentUser.role)) {
      await loadOrders();
    }

    $("authSection").classList.add("hidden");
    $("dashboardSection").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    setMessage("loginMessage", error.message);
  } finally {
    $("loginSubmit").disabled = false;
  }
});

// REGISTER
$("registerForm").addEventListener("submit", async event => {
  event.preventDefault();

  $("registerSubmit").disabled = true;
  setMessage("registerMessage", "Creating account...", true);

  try {
    const result = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: $("registerName").value.trim(),
        email: $("registerEmail").value.trim(),
        password: $("registerPassword").value,
        role: $("registerRole").value
      })
    });

    $("registerForm").reset();
    showAuth("login");
    setMessage("loginMessage", result.message, true);
  } catch (error) {
    setMessage("registerMessage", error.message);
  } finally {
    $("registerSubmit").disabled = false;
  }
});

// LOGOUT
$("logoutBtn").addEventListener("click", async () => {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch (error) {
    console.error("Logout error:", error.message);
  }

  currentUser = null;
  renderLayout();
  renderProducts();
  showAuth("login");
});

// NAVIGATION
$("showLogin").addEventListener("click", () => showAuth("login"));
$("showRegister").addEventListener("click", () => showAuth("register"));
$("loginNav").addEventListener("click", () => showAuth("login"));
$("registerNav").addEventListener("click", () => showAuth("register"));

$("homeLink").addEventListener("click", event => {
  event.preventDefault();

  if (currentUser) {
    $("dashboardSection").scrollIntoView({ behavior: "smooth" });
  } else {
    showAuth("login");
  }
});

$("storeNav").addEventListener("click", event => {
  event.preventDefault();
  $("store").scrollIntoView({ behavior: "smooth" });
});

$("cartNav").addEventListener("click", event => {
  event.preventDefault();
  $("cartSection").classList.remove("hidden");
  $("cartSection").scrollIntoView({ behavior: "smooth" });
});

$("ordersNav").addEventListener("click", async event => {
  event.preventDefault();
  $("ordersSection").classList.remove("hidden");
  await loadOrders();
  $("ordersSection").scrollIntoView({ behavior: "smooth" });
});

$("adminOrdersNav").addEventListener("click", async event => {
  event.preventDefault();
  $("ordersSection").classList.remove("hidden");
  await loadOrders();
  $("ordersSection").scrollIntoView({ behavior: "smooth" });
});

$("manageNav").addEventListener("click", event => {
  event.preventDefault();
  $("manage").scrollIntoView({ behavior: "smooth" });
});

$("refreshOrdersBtn").addEventListener("click", loadOrders);

$("searchInput").addEventListener("input", renderProducts);
$("categoryFilter").addEventListener("change", renderProducts);
$("sortSelect").addEventListener("change", renderProducts);

// INITIALIZE
async function initialize() {
  await loadProducts();
  renderCart();

  try {
    const result = await api("/auth/me");
    currentUser = result.user;

    renderLayout();
    renderProducts();
    renderCart();

    if (["reseller", "admin"].includes(currentUser.role)) {
      await loadOrders();
    }
  } catch {
    currentUser = null;
    renderLayout();
    renderProducts();
  }
}

initialize();
