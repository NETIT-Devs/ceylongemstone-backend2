// 1. Environment variables load කිරීම (db.js also loads .env - handled there)
const express = require('express');
const cors = require('cors');

// Config Import කිරීම
const db = require('./src/config/db');

// Routes Imports කිරීම
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


const app = express();
app.set('strict routing', false); // Allow optional trailing slashes

// 2. Middlewares (CORS සහ Body Parser)
app.use(cors());
app.use(express.json()); // Frontend එකෙන් එවන JSON data parse කර ගැනීමට
app.use(express.urlencoded({ extended: true }));
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is healthy',
        database: 'Connected'
    });
});


app.use("/uploads", express.static("uploads")); // Static files for uploaded images

// 3. API Routes Connect කිරීම
app.use('/api/auth', authRoutes);             // e.g. POST /api/auth/login, POST /api/auth/register
app.use('/api/categories', categoryRoutes);   // e.g. GET/POST /api/categories
app.use('/api/gemstones', gemstoneRoutes);    // e.g. GET/POST /api/gemstones
app.use('/api/certificates', certificateRoutes); // e.g. GET/POST /api/certificates
app.use('/api/gemstone-images', gemstoneImageRoutes); // e.g. POST /api/gemstone-images/upload
app.use('/api/wishlist', wishlistRoutes); // e.g. POST /api/wishlist
app.use('/api/cart', cartRoutes); // e.g. POST /api/cart
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/reviews", reviewRoutes); // e.g. POST /api/reviews
app.use("/api/orders", orderRoutes);
app.use("/api/order-items", orderItemRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/currency", currencyRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/seo", seoRoutes);
app.use("/api/shipping", shippingRoutes);


// Test Route (Server එක වැඩදැයි පරීක්ෂා කිරීමට)
app.get('/', (req, res) => {
    res.send('API is running successfully!');
});

// 4. Global Error Handling Middleware (ඕනෑම unhandled error එකක් ආවොත් සර්වර් එක crash නොවී ලස්සනට response එකක් යැවීමට)
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: err.message
    });
});

// 5. 404 Handler - Unknown route
app.use((req, res) => {
    console.warn(`[404] Unmatched route: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
});

// 6. Port එක set කර සර්වර් එක start කිරීම
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    // Verify DB connection on startup
    try {
        await db.query('SELECT 1');
        console.log(`Database connected successfully (${process.env.DB_NAME || 'srilankan_gemstone'})`);
    } catch (err) {
        console.error('Database connection FAILED:', err.message);
    }
});