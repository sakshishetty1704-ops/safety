const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*"
    }
});

app.use(express.json());
app.use(cors());
io.on("connection", (socket) => {
    console.log("Device connected:", socket.id);

    socket.on("join-receivers", () => {
        socket.join("receivers");
        console.log("Receiver dashboard connected");
    });
});

// Serve your frontend files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// 1. Connect to MongoDB
const MONGO_URI = 'mongodb+srv://prathishtasunil_db_user:a94hW7H5pNK2WXoq@cluster0.hj4gtjs.mongodb.net/tranaDB?retryWrites=true&w=majority';
 // Or your MongoDB Atlas URI
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// 2. Define User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    emergencyContact: { type: String }
});

const User = mongoose.model('User', userSchema);

// 3. Register Route
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, emergencyContact } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword, emergencyContact });
        await newUser.save();

        res.status(201).json({ message: 'Account created successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// 4. Login Route
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        res.json({ 
            message: 'Login successful', 
            user: { id: user._id, name: user.name, email: user.email, emergencyContact: user.emergencyContact } 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error during login' });
    }
});
// ==========================================================
//  LOCATION & FEATURE 1: AUTOMATED POLICE SMS ROUTER
// ==========================================================
const alertSchema = new mongoose.Schema({
    userId: { type: String },
    name: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    emergencyContact: { type: String },
    status: { type: String, default: 'ACTIVE_SOS' },
    createdAt: { type: Date, default: Date.now }
});

const SOSAlert = mongoose.model('SOSAlert', alertSchema);

// Route to save live coordinates & trigger outbound SMS dispatch
app.post('/api/sos', async (req, res) => {
    try {
        const { userId, name, lat, lng } = req.body;

        // Look up user's emergency contact from MongoDB if logged in
        let contact = 'Not provided';
        if (userId) {
            const user = await User.findById(userId).catch(() => null);
            if (user && user.emergencyContact) {
                contact = user.emergencyContact;
            }
        }

        // Save location & incident to MongoDB
        const newAlert = new SOSAlert({
            userId,
            name: name || 'Prototype User',
            lat,
            lng,
            emergencyContact: contact
        });
        await newAlert.save();
        io.to("receivers").emit("new-sos", {
    id: newAlert._id,
    name: newAlert.name,
    lat: newAlert.lat,
    lng: newAlert.lng,
    status: newAlert.status,
    createdAt: newAlert.createdAt
});

        // Count active incidents in DB for Feature 2 (Dynamic Risk Ring)
        const totalIncidents = await SOSAlert.countDocuments({ status: 'ACTIVE_SOS' });

        // Simulate Automated Police & Emergency Contact SMS
        const mapUrl = `${lat},${lng}`;
        const smsMessage = ` TRANA SOS | Victim: ${newAlert.name} | GPS: ${lat.toFixed(5)} , ${lng.toFixed(5)} | Map: ${mapUrl}`;

        console.log('\n=========================================');
        console.log(' LOCATION SAVED TO MONGODB (sosalerts)');
        console.log(' OUTBOUND SMS TO POLICE (112):', smsMessage);
        console.log(` OUTBOUND SMS TO CONTACT (${contact}):`, smsMessage);
        console.log('=========================================\n');

        res.status(201).json({
            message: 'SOS Location logged & dispatched!',
            incidentCount: totalIncidents,
            alert: newAlert
        });
    } catch (error) {
        console.error('SOS Route Error:', error);
        res.status(500).json({ message: 'Failed to log SOS location' });
    }
});

httpServer.listen(3000, () => {
    console.log("Trana server running at http://localhost:3000");
});