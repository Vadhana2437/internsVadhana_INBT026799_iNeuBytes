
const products = [
  {
    id: 1,
    name: "Wireless Headphones",
    category: "Electronics",
    price: 1499,
    oldPrice: 1999,
    emoji: "🎧",
    bg: "#eae5ff",
    tag: "25% OFF",
    rating: 4.6,
    reviews: 128,
    description: "Enjoy clear audio, comfortable ear cushions and a convenient wireless listening experience."
  },
  {
    id: 2,
    name: "Smart Watch",
    category: "Smart Gadgets",
    price: 2499,
    oldPrice: 2999,
    emoji: "⌚",
    bg: "#ffe6ef",
    tag: "BESTSELLER",
    rating: 4.5,
    reviews: 96,
    description: "A stylish everyday smartwatch concept with activity tracking and a modern design."
  },
  {
    id: 3,
    name: "Travel Backpack",
    category: "Accessories",
    price: 999,
    oldPrice: 1299,
    emoji: "🎒",
    bg: "#dcf8e8",
    tag: "23% OFF",
    rating: 4.4,
    reviews: 84,
    description: "A versatile backpack concept for carrying your daily essentials while travelling or studying."
  },
  {
    id: 4,
    name: "Bluetooth Speaker",
    category: "Electronics",
    price: 1199,
    oldPrice: 1499,
    emoji: "🔊",
    bg: "#fff0d9",
    tag: "NEW",
    rating: 4.3,
    reviews: 72,
    description: "A compact speaker concept for enjoying music at home or on the go."
  },
  {
    id: 5,
    name: "Wireless Mouse",
    category: "Electronics",
    price: 699,
    oldPrice: 899,
    emoji: "🖱️",
    bg: "#e1f0ff",
    tag: "22% OFF",
    rating: 4.5,
    reviews: 110,
    description: "A simple wireless mouse concept designed for everyday computer use."
  },
  {
    id: 6,
    name: "Fitness Band",
    category: "Smart Gadgets",
    price: 1799,
    oldPrice: 2199,
    emoji: "📟",
    bg: "#ffe9df",
    tag: "POPULAR",
    rating: 4.2,
    reviews: 65,
    description: "A fitness accessory concept for tracking daily activity and maintaining an active routine."
  },
  {
    id: 7,
    name: "Phone Stand",
    category: "Accessories",
    price: 299,
    oldPrice: 399,
    emoji: "📱",
    bg: "#e5f8ed",
    tag: "25% OFF",
    rating: 4.4,
    reviews: 54,
    description: "A convenient phone stand concept for hands-free viewing at your desk."
  },
  {
    id: 8,
    name: "Laptop Sleeve",
    category: "Accessories",
    price: 599,
    oldPrice: 799,
    emoji: "💻",
    bg: "#f0e7ff",
    tag: "VALUE PICK",
    rating: 4.6,
    reviews: 89,
    description: "A lightweight sleeve concept to help protect a laptop while carrying it around."
  }
];

const $ = (id) => document.getElementById(id);

const productGrid = $("productGrid");
const searchInput = $("searchInput");
const categoryFilter = $("categoryFilter");
const sortFilter = $("sortFilter");

const cartPanel = $("cartPanel");
const cartItemsContainer = $("cartItems");
const cartCount = $("cartCount");
const cartEmpty = $("cartEmpty");
const cartSummary = $("cartSummary");
const overlay = $("overlay");

const productDialog = $("productDialog");
const productDetails = $("productDetails");
const toast = $("toast");

let cart = loadCart();
let toastTimeout;

function formatPrice(amount) {
  return "₹" + amount.toLocaleString("en-IN");
}

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("novamart-cart"));
    if (!Array.isArray(saved)) return [];

    return saved
      .filter(item =>
        products.some(product => product.id === item.id) &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0
      )
      .map(item => ({
        id: item.id,
        quantity: Math.min(item.quantity, 99)
      }));
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem("novamart-cart", JSON.stringify(cart));
  } catch {
    showToast("Cart could not be saved in this browser.");
  }
}

function renderProducts() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  const sort = sortFilter.value;

  let filtered = products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm) ||
      product.category.toLowerCase().includes(searchTerm) ||
      product.description.toLowerCase().includes(searchTerm);

    const matchesCategory =
      category === "All" || product.category === category;

    return matchesSearch && matchesCategory;
  });

  if (sort === "low") {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sort === "high") {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sort === "name") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  $("resultCount").textContent =
    `Showing ${filtered.length} of ${products.length} products`;

  $("noProducts").classList.toggle("hidden", filtered.length !== 0);

  productGrid.innerHTML = filtered.map(product => `
    <article class="product-card">
      <div
        class="product-art"
        style="--art-bg:${product.bg}"
        data-details="${product.id}"
        role="button"
        tabindex="0"
        aria-label="View ${product.name} details"
      >
        <span class="product-tag">${product.tag}</span>
        <span class="product-emoji">${product.emoji}</span>
      </div>

      <div class="product-info">
        <p class="product-category">${product.category}</p>
        <h3 class="product-name">${product.name}</h3>

        <p class="product-rating">
          ★★★★★ <span class="rating-count">${product.rating} (${product.reviews})</span>
        </p>

        <div class="product-price-row">
          <span class="product-price">${formatPrice(product.price)}</span>
          <span class="old-price">${formatPrice(product.oldPrice)}</span>
        </div>

        <div class="product-actions">
          <button class="add-button" data-add="${product.id}">
            + Add to Cart
          </button>
          <button
            class="details-button"
            data-details="${product.id}"
            aria-label="Details for ${product.name}"
            title="View details"
          >ⓘ</button>
        </div>
      </div>
    </article>
  `).join("");
}

function getProduct(id) {
  return products.find(product => product.id === Number(id));
}

function addToCart(id) {
  const product = getProduct(id);
  if (!product) return;

  const existing = cart.find(item => item.id === product.id);

  if (existing) {
    if (existing.quantity >= 99) {
      showToast("Maximum quantity is 99.");
      return;
    }
    existing.quantity++;
  } else {
    cart.push({ id: product.id, quantity: 1 });
  }

  saveCart();
  renderCart();
  showToast(`${product.name} added to cart!`);
}

function changeQuantity(id, amount) {
  const item = cart.find(entry => entry.id === Number(id));
  if (!item) return;

  const nextQuantity = item.quantity + amount;

  if (nextQuantity <= 0) {
    removeFromCart(id);
    return;
  }

  if (nextQuantity > 99) {
    showToast("Maximum quantity is 99.");
    return;
  }

  item.quantity = nextQuantity;
  saveCart();
  renderCart();
}

function removeFromCart(id) {
  const item = cart.find(entry => entry.id === Number(id));
  const product = item ? getProduct(item.id) : null;

  cart = cart.filter(entry => entry.id !== Number(id));

  saveCart();
  renderCart();

  if (product) {
    showToast(`${product.name} removed from cart.`);
  }
}

function renderCart() {
  const totalQuantity = cart.reduce(
    (sum, item) => sum + item.quantity, 0
  );

  cartCount.textContent = totalQuantity;
  cartCount.setAttribute(
    "aria-label", `${totalQuantity} items in cart`
  );

  cartEmpty.classList.toggle("show", cart.length === 0);
  cartSummary.classList.toggle("is-empty", cart.length === 0);
  cartItemsContainer.classList.toggle("hidden", cart.length === 0);

  cartItemsContainer.innerHTML = cart.map(item => {
    const product = getProduct(item.id);
    if (!product) return "";

    return `
      <div class="cart-item">
        <div class="cart-item-art" style="--art-bg:${product.bg}">
          ${product.emoji}
        </div>

        <div class="cart-item-info">
          <h3>${product.name}</h3>
          <p class="cart-item-price">${formatPrice(product.price)}</p>

          <div class="cart-item-bottom">
            <div class="quantity-control" aria-label="Quantity controls">
              <button data-minus="${product.id}" aria-label="Decrease quantity">−</button>
              <span>${item.quantity}</span>
              <button data-plus="${product.id}" aria-label="Increase quantity">+</button>
            </div>

            <button class="remove-button" data-remove="${product.id}">
              Remove
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  const subtotal = cart.reduce((sum, item) => {
    const product = getProduct(item.id);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);

  $("cartSubtotal").textContent = formatPrice(subtotal);
  $("deliveryCost").textContent = "Free";
  $("cartTotal").textContent = formatPrice(subtotal);
}

function openCart() {
  cartPanel.classList.add("open");
  cartPanel.setAttribute("aria-hidden", "false");
  overlay.classList.remove("hidden");
  document.body.classList.add("no-scroll");
  $("closeCart").focus();
}

function closeCart() {
  cartPanel.classList.remove("open");
  cartPanel.setAttribute("aria-hidden", "true");
  overlay.classList.add("hidden");
  document.body.classList.remove("no-scroll");
}

function showProductDetails(id) {
  const product = getProduct(id);
  if (!product) return;

  productDetails.innerHTML = `
    <div class="dialog-product-art" style="--art-bg:${product.bg}">
      ${product.emoji}
    </div>

    <div class="dialog-product-info">
      <p class="eyebrow">${product.category}</p>
      <h2>${product.name}</h2>
      <p class="product-rating">
        ★★★★★ <span class="rating-count">${product.rating} (${product.reviews} sample reviews)</span>
      </p>
      <div class="dialog-price">${formatPrice(product.price)}
        <span class="old-price">${formatPrice(product.oldPrice)}</span>
      </div>
      <p>${product.description}</p>
      <button class="add-button" data-add="${product.id}">
        + Add to Cart
      </button>
    </div>
  `;

  if (!productDialog.open) {
    productDialog.showModal();
  }
}

function showToast(message) {
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add("show");

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2400);
}

// Product catalog actions
productGrid.addEventListener("click", event => {
  const addButton = event.target.closest("[data-add]");
  const detailsButton = event.target.closest("[data-details]");

  if (addButton) {
    addToCart(addButton.dataset.add);
  } else if (detailsButton) {
    showProductDetails(detailsButton.dataset.details);
  }
});

productGrid.addEventListener("keydown", event => {
  const detailsButton = event.target.closest("[data-details]");

  if (
    detailsButton &&
    (event.key === "Enter" || event.key === " ")
  ) {
    event.preventDefault();
    showProductDetails(detailsButton.dataset.details);
  }
});

// Shopping cart actions
cartItemsContainer.addEventListener("click", event => {
  const plus = event.target.closest("[data-plus]");
  const minus = event.target.closest("[data-minus]");
  const remove = event.target.closest("[data-remove]");

  if (plus) {
    changeQuantity(plus.dataset.plus, 1);
  } else if (minus) {
    changeQuantity(minus.dataset.minus, -1);
  } else if (remove) {
    removeFromCart(remove.dataset.remove);
  }
});

// Search and filters
searchInput.addEventListener("input", renderProducts);
categoryFilter.addEventListener("change", renderProducts);
sortFilter.addEventListener("change", renderProducts);

// Cart panel
$("cartToggle").addEventListener("click", openCart);
$("closeCart").addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);
$("continueShopping").addEventListener("click", closeCart);

// Product details popup
$("closeDialog").addEventListener("click", () => {
  productDialog.close();
});

productDetails.addEventListener("click", event => {
  const addButton = event.target.closest("[data-add]");
  if (!addButton) return;

  addToCart(addButton.dataset.add);
  productDialog.close();
});

// Demo checkout
$("checkoutButton").addEventListener("click", () => {
  if (cart.length === 0) {
    showToast("Your cart is empty.");
    return;
  }

  const subtotal = cart.reduce((sum, item) => {
    const product = getProduct(item.id);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);

  alert(
    "Demo Checkout\n\n" +
    "Items: " + cart.reduce((sum, item) => sum + item.quantity, 0) +
    "\nTotal: " + formatPrice(subtotal) +
    "\n\nThis is a demo. No payment or real order was created."
  );
});

// Mobile navigation
$("menuToggle").addEventListener("click", () => {
  $("navLinks").classList.toggle("open");
});

$("navLinks").addEventListener("click", event => {
  if (event.target.closest("a")) {
    $("navLinks").classList.remove("open");
  }
});

// Escape key closes open panels
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeCart();
  }
});

// Initial setup
$("currentYear").textContent = new Date().getFullYear();

renderProducts();
renderCart();
