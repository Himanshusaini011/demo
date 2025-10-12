// /home/pacman/Desktop/divine_art_gallary/art/backend/server.js

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = express();
const port = 4000;

// A secret key for signing JWTs. In a real app, use an environment variable!
const JWT_SECRET = 'your-super-secret-key-that-is-long-and-secure';

app.use(cors());
app.use(express.json());

// --- 1. DATABASE CONNECTION ---
// Make sure this is your actual connection string from MongoDB Atlas
const MONGO_URI = "mongodb+srv://divine_art_gallary:3tvt4WDlZhmT486v@cluster0.a2smtxe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('Successfully connected to MongoDB Atlas!');
        seedDatabase(); // Optional: Add initial data if DB is empty
    })
    .catch(err => console.error('Error connecting to MongoDB:', err));

// --- 2. DATABASE SCHEMAS & MODELS ---
const PaintingSchema = new mongoose.Schema({
    title: String,
    artist: String,
    price: String,
    image: String,
});
const Painting = mongoose.model('Painting', PaintingSchema);

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' } // Add role field
});
const User = mongoose.model('User', UserSchema);


// --- 3. AUTHENTICATION MIDDLEWARE ---
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password'); // Attach user to request
            next();
        } catch (error) {
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }
    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as an admin' });
    }
};

// --- Paintings API Endpoints ---
app.get('/api/paintings', async (req, res) => {
    try {
        const paintings = await Painting.find();
        res.json(paintings);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching paintings' });
    }
});

app.get('/api/paintings/:id', async (req, res) => {
    try {
        const painting = await Painting.findById(req.params.id);
        if (painting) {
            res.json(painting);
        } else {
            res.status(404).json({ message: 'Painting not found' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Error fetching painting' });
    }
});

// POST a new painting (Protected for Admins)
app.post('/api/paintings', protect, admin, async (req, res) => {
    const { title, artist, price, image } = req.body;
    if (!title || !artist || !price || !image) {
        return res.status(400).json({ message: 'Please provide all painting details.' });
    }
    try {
        const newPainting = new Painting({ title, artist, price, image });
        const savedPainting = await newPainting.save();
        res.status(201).json(savedPainting);
    } catch (err) {
        res.status(500).json({ message: 'Server error while creating painting.' });
    }
});

// DELETE a painting (Protected for Admins)
app.delete('/api/paintings/:id', protect, admin, async (req, res) => {
    try {
        const painting = await Painting.findById(req.params.id);
        if (!painting) {
            return res.status(404).json({ message: 'Painting not found' });
        }
        await painting.deleteOne();
        res.json({ message: 'Painting removed' });
    } catch (err) {
        res.status(500).json({ message: 'Server error while deleting painting.' });
    }
});

// --- Authentication API Endpoints ---

// SIGNUP Endpoint
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Please provide name, email, and password.' });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'User with this email already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({ name, email, password: hashedPassword });

        await newUser.save();
        res.status(201).json({ message: 'User created successfully!' });

    } catch (err) {
        res.status(500).json({ message: 'Server error during signup.' });
    }
});

// LOGIN Endpoint
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password.' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Add role to the JWT payload
        const token = jwt.sign({ id: user._id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

        res.json({ message: 'Login successful!', token });

    } catch (err) {
        res.status(500).json({ message: 'Server error during login.' });
    }
});


app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
});

// --- DATABASE SEEDING (Optional) ---
async function seedDatabase() {
    const count = await Painting.countDocuments();
    if (count === 0) {
        console.log('No paintings found. Seeding database...');
        const initialPaintings = [
            { title: "Sunset Dreams", artist: "Emma Wilson", price: "299", image: "https://picsum.photos/seed/painting1/800/600.jpg" },
            { title: "Ocean Waves", artist: "Michael Chen", price: "349", image: "https://picsum.photos/seed/painting2/800/600.jpg" },
            { title: "City Lights", artist: "Sophia Martinez", price: "275", image: "https://picsum.photos/seed/painting3/800/600.jpg" },
            { title: "Forest Serenity", artist: "James Rodriguez", price: "315", image: "https://picsum.photos/seed/painting4/800/600.jpg" },
            { title: "Abstract Emotions", artist: "Olivia Taylor", price: "265", image: "https://picsum.photos/seed/painting5/800/600.jpg" },
            { title: "Mountain Majesty", artist: "David Kim", price: "385", image: "https://picsum.photos/seed/painting6/800/600.jpg" },
            { title: "Golden Hour", artist: "Ava Garcia", price: "320", image: "https://picsum.photos/seed/painting7/800/600.jpg" },
            { title: "Urban Jungle", artist: "Noah Brown", price: "290", image: "https://picsum.photos/seed/painting8/800/600.jpg" },
            { title: "Coastal Calm", artist: "Isabella Lee", price: "355", image: "https://picsum.photos/seed/painting9/800/600.jpg" },
        ];
        await Painting.insertMany(initialPaintings);
        console.log('Database seeded!');
    }
}
