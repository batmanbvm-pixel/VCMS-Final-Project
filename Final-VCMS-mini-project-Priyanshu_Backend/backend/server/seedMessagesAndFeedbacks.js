const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function seedMessagesAndFeedbacks() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
    });

    console.log('✅ Connected to MongoDB\n');

    // Get users
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const preet = await User.findOne({ email: 'preetp2412@gmail.com' });
    const rudra = await User.findOne({ email: 'rudra12@gmail.com' });
    const admin = await User.findOne({ email: 'admin@gmail.com' });

    if (!preet || !rudra || !admin) {
      console.error('❌ Required users not found');
      process.exit(1);
    }

    // Create ChatMessage collection
    const ChatMessage = mongoose.model('ChatMessage', new mongoose.Schema({
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      senderName: String,
      receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      receiverName: String,
      message: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      read: { type: Boolean, default: false },
      readAt: Date,
    }, { timestamps: true }));

    // Create Contact collection
    const Contact = mongoose.model('Contact', new mongoose.Schema({
      name: { type: String, required: true },
      email: { type: String, required: true },
      subject: { type: String, required: true },
      message: { type: String, required: true },
      status: { type: String, enum: ['open', 'in-progress', 'resolved', 'closed'], default: 'open' },
      priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
      assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      response: String,
      respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      respondedAt: Date,
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    }, { timestamps: true }));

    // Clear existing messages and contacts for test users
    await ChatMessage.deleteMany({
      $or: [
        { senderId: { $in: [preet._id, rudra._id] } },
        { receiverId: { $in: [preet._id, rudra._id] } }
      ]
    });
    await Contact.deleteMany({ email: { $in: [preet.email, rudra.email] } });

    console.log('🗑️  Cleared existing messages and contacts\n');

    // ===== CHAT MESSAGES =====
    console.log('💬 Creating Chat Messages...');

    const messages = [];
    const now = new Date();

    // Conversation between Preet and Rudra
    const timestamps = [
      new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000), // +5 mins
      new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000), // +10 mins
      new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
      new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
      new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // Yesterday
      new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
      new Date(now.getTime() - 30 * 60 * 1000), // 30 mins ago
    ];

    const conversation = [
      { from: preet, to: rudra, msg: 'Hello Dr. Rudra, I wanted to ask about my blood pressure medication.' },
      { from: rudra, to: preet, msg: 'Hi Preet! Of course, what would you like to know?' },
      { from: preet, to: rudra, msg: 'I\'ve been experiencing some dizziness. Is this normal?' },
      { from: rudra, to: preet, msg: 'That can be a side effect. When did you start noticing this?' },
      { from: preet, to: rudra, msg: 'About 3 days ago, usually in the morning.' },
      { from: rudra, to: preet, msg: 'I see. Are you taking your medication on an empty stomach?' },
      { from: preet, to: rudra, msg: 'Yes, usually right after I wake up.' },
      { from: rudra, to: preet, msg: 'Try taking it with breakfast instead. Also, avoid standing up too quickly.' },
      { from: preet, to: rudra, msg: 'Okay, I\'ll try that. Should I be concerned?' },
      { from: rudra, to: preet, msg: 'It\'s likely just orthostatic hypotension. If it persists after adjusting, let me know.' },
      { from: preet, to: rudra, msg: 'Thank you Doctor! One more thing - is it okay to exercise?' },
      { from: rudra, to: preet, msg: 'Yes, light to moderate exercise is good. Avoid heavy lifting initially.' },
      { from: preet, to: rudra, msg: 'Perfect! Thank you so much for your help 🙏' },
    ];

    conversation.forEach((conv, index) => {
      messages.push({
        senderId: conv.from._id,
        senderName: conv.from.name,
        receiverId: conv.to._id,
        receiverName: conv.to.name,
        message: conv.msg,
        timestamp: timestamps[index],
        read: index < 10, // First 10 are read
        readAt: index < 10 ? new Date(timestamps[index].getTime() + 2 * 60 * 1000) : null,
        createdAt: timestamps[index],
        updatedAt: timestamps[index],
      });
    });

    await ChatMessage.insertMany(messages);
    console.log(`✅ Created ${messages.length} chat messages\n`);

    // ===== CONTACT/FEEDBACK MESSAGES =====
    console.log('📧 Creating Contact/Feedback Messages...');

    const contacts = [
      {
        name: preet.name,
        email: preet.email,
        subject: 'Issue with appointment booking',
        message: 'Hi, I tried to book an appointment for next Monday but the system showed all slots as unavailable even though they should be open. Can you please check?',
        status: 'resolved',
        priority: 'medium',
        assignedTo: admin._id,
        response: 'Thank you for reporting this. We\'ve identified and fixed the issue with the availability checker. You should now be able to book appointments normally.',
        respondedBy: admin._id,
        respondedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        name: preet.name,
        email: preet.email,
        subject: 'Prescription not available for download',
        message: 'Hello, I completed my consultation yesterday but I cannot download my prescription. The download button is not working. Please help!',
        status: 'in-progress',
        priority: 'high',
        assignedTo: admin._id,
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        name: preet.name,
        email: preet.email,
        subject: 'Great experience!',
        message: 'I just wanted to say thank you for this wonderful platform. Dr. Rudra was very helpful and the video consultation worked perfectly. The interface is user-friendly too!',
        status: 'closed',
        priority: 'low',
        assignedTo: admin._id,
        response: 'Thank you so much for your positive feedback! We\'re delighted to hear about your great experience with Dr. Rudra. We strive to provide the best healthcare services.',
        respondedBy: admin._id,
        respondedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
        createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      },
      {
        name: rudra.name,
        email: rudra.email,
        subject: 'Request for feature enhancement',
        message: 'As a doctor, I would love to have the ability to set custom availability for specific dates, especially for holidays. Currently, I have to manually cancel appointments.',
        status: 'open',
        priority: 'medium',
        createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      },
      {
        name: 'Sarah Patient',
        email: 'sarah.patient@gmail.com',
        subject: 'Payment issue',
        message: 'My payment went through but my appointment still shows as unpaid. Can you please check? Transaction ID: TXN123456789',
        status: 'in-progress',
        priority: 'urgent',
        assignedTo: admin._id,
        createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      },
      {
        name: 'John Patient',
        email: 'john.patient@gmail.com',
        subject: 'Feedback on platform',
        message: 'Overall good experience, but I think the appointment reminder should come earlier - maybe 24 hours before instead of just 2 hours before.',
        status: 'open',
        priority: 'low',
        createdAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      }
    ];

    await Contact.insertMany(contacts);
    console.log(`✅ Created ${contacts.length} contact/feedback messages\n`);

    // ===== SUMMARY =====
    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 MESSAGES & FEEDBACKS CREATED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════\n');
    
    console.log('📊 SUMMARY:');
    console.log(`   └─ Chat Messages: ${messages.length}`);
    console.log(`   └─ Contact/Feedback Messages: ${contacts.length}`);
    console.log(`      ├─ Open: ${contacts.filter(c => c.status === 'open').length}`);
    console.log(`      ├─ In Progress: ${contacts.filter(c => c.status === 'in-progress').length}`);
    console.log(`      ├─ Resolved: ${contacts.filter(c => c.status === 'resolved').length}`);
    console.log(`      └─ Closed: ${contacts.filter(c => c.status === 'closed').length}\n`);

    console.log('✅ Test data ready for messaging and feedback features!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

seedMessagesAndFeedbacks();
