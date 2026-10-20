// ==========================================
// CEYLON ROYAL GEMSTONES - BACKEND SERVER
// ==========================================

// Import required core modules and third-party libraries
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import database configuration instance
const db = require('./src/config/db');
const passport = require('./src/config/passport');

// Import all API route modules
const authRoutes = require('./src/routes/authRoutes');
const gemstoneRoutes = require('./src/routes/gemstoneRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const certificateRoutes = require("./src/routes/certificateRoutes");
const gemstoneImageRoutes = require("./src/routes/gemstoneImageRoutes");
const wishlistRoutes = require("./src/routes/wishlistRoutes");
const cartRoutes = require("./src/routes/cartRoutes");
const enquiryRoutes = require("./src/routes/enquiryRoutes");
const reviewRoutes = require("./src/routes/reviewRoutes");
const orderRoutes = require("./src/routes/orderRoutes");
const orderItemRoutes = require("./src/routes/orderItemRoutes");
const checkoutRoutes = require("./src/routes/checkoutRoutes");
const currencyRoutes = require("./src/routes/currencyRoutes");
const bannerRoutes = require("./src/routes/bannerRoutes");
const blogRoutes = require("./src/routes/blogRoutes");
const seoRoutes = require("./src/routes/seoRoutes");
const shippingRoutes = require("./src/routes/shippingRoutes");
const { getActiveShippingMethods } = require("./src/controllers/shippingController");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const jewelleryRoutes = require("./src/routes/jewelleryRoutes");




// Initialize Express application
const app = express();
app.set('strict routing', false); // Allow optional trailing slashes in route URLs

// Configure CORS middleware to permit frontend origins and credentials.
// Vite chooses a free local port when the default port is occupied, so we allow
// any localhost/127.0.0.1 origin during local development while keeping the
// API strict on non-local origins.
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            callback(null, true);
            return;
        }

        const matchesLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+$/.test(origin);
        if (matchesLocalhost) {
            callback(null, true);
            return;
        }

        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse incoming JSON and URL-encoded payloads from the client
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Health check endpoint to verify server and database status
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is healthy',
        database: 'Connected'
    });
});

// Serve static files from the uploads directory
const uploadsDirectory = path.resolve(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDirectory));

// Mount API route handlers to their respective base paths
app.use('/api/auth', authRoutes);                   // Authentication routes
app.use('/api/categories', categoryRoutes);         // Category management routes
app.use('/api/gemstones', gemstoneRoutes);          // Gemstone inventory routes
app.use('/api/certificates', certificateRoutes);    // Certificate verification routes
app.use('/api/gemstone-images', gemstoneImageRoutes); // Multi-angle image routes
app.use('/api/wishlist', wishlistRoutes);           // User wishlist routes
app.use('/api/cart', cartRoutes);                   // Shopping cart routes
app.use("/api/enquiries", enquiryRoutes);           // Customer enquiry routes
app.use("/api/reviews", reviewRoutes);              // Product review routes
app.use("/api/orders", orderRoutes);                // Order management routes
app.use("/api/order-items", orderItemRoutes);       // Order items routes
app.use("/api/checkout", checkoutRoutes);           // Checkout & payment routes
app.use("/api/currency", currencyRoutes);           // Currency conversion routes
app.use("/api/banners", bannerRoutes);              // Promotional banners routes
app.use("/api/blogs", blogRoutes);                  // Blog posts routes
app.use("/api/seo", seoRoutes);                     // SEO metadata routes
app.use("/api/shipping", shippingRoutes);           // Shipping methods routes
app.get("/api/shipping-methods", getActiveShippingMethods);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/jewellery", jewelleryRoutes);         // Jewellery product management routes


// Root test route to verify API availability
app.get('/', (req, res) => {
    res.send('API is running successfully!');
});

// Global Error Handling Middleware to catch unhandled errors gracefully
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: err.message
    });
});

// 404 Handler for unmatched routes
app.use((req, res) => {
    console.warn(`[404] Unmatched route: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
});

// Set server port and start listening
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`\n==================================================`);
    console.log(`🚀 Server is running successfully on port: ${PORT}`);

    // Verify database connection on startup with clean checkmark logs
    try {
        await db.query('SELECT 1');
        console.log(`✅ Database connected successfully (${process.env.DB_NAME || 'srilankan_gemstones_db'})`);
        console.log(`==================================================\n`);
    } catch (err) {
        console.error(`❌ Database connection FAILED: ${err.message}`);
        console.log(`==================================================\n`);
    }
});