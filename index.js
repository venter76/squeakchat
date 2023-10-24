// Basic setup with login and session setup


const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const mongoose = require("mongoose");

require('dotenv').config();
const MongoStore = require('connect-mongo');
const checkAuthenticated = require('./authenticate.js');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const findOrCreate = require('mongoose-findorcreate');
const cron = require('node-cron');
const bcrypt = require('bcryptjs');
const redirectToDashboardIfAuthenticated = require('./redirectToDashboardIfAuthenticated');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment-timezone');



 

const app = express();
const PORT = process.env.PORT || 3000

app.set('view engine', 'ejs');

app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));
app.use(flash());


//Nodemailer setup for email verification:


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD
  }
});


transporter.verify(function (error, success) {
  if(error) {
      console.log(error);
  } else {
      console.log('Server validation done and ready for messages.')
  }
});






const db_username = process.env.DB_USERNAME;
const db_password = process.env.DB_PASSWORD;
const db_cluster_url = process.env.DB_CLUSTER_URL;
const db_name = process.env.DB_NAME;


const connectDB = async () => {
  try {
    const conn = await mongoose.connect(`mongodb+srv://${db_username}:${db_password}@${db_cluster_url}/${db_name}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB Atlas:', conn.connection.host);
  } catch (error) {
    console.error('Error connecting to MongoDB Atlas:', error);
    process.exit(1);
  }
};


const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  verificationToken: String, // New field for verification token
  resetPasswordToken: String, // Field for password reset token
  resetPasswordExpires: Date, // Field for token expiration time
  firstname: String,
  surname: String,
  date: {
    type: Date,
    default: Date.now
  },
  role: {
    type: String,
    default: "user" 
  },
  active: {  // Adding the 'active' field
    type: Boolean,
    default: false
  }
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

module.exports = User;



// Define your message schema
const messageSchema = new mongoose.Schema({
  sender: String,
  timestamp: Date,
  content: String,
  messageColour: String
});

// Create a model for the messages collection
const Message = mongoose.model('Message', messageSchema);






//Session cookie setup:


app.set('trust proxy', 1);

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: `mongodb+srv://${db_username}:${db_password}@${db_cluster_url}/${db_name}?retryWrites=true&w=majority`,
    }),
    cookie: { 
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // must be 'none' to enable cross-site delivery
      httpOnly: true, // prevents JavaScript from making changes
       // Set maxAge to 2 weeks (in milliseconds)
       maxAge: 2 * 7 * 24 * 60 * 60 * 1000, // 2 weeks
    }
  }));


  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flash());
  
  passport.use(User.createStrategy());
  
  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});




  




  const rateLimit = require('express-rate-limit');

  // Define a limiter middleware for login attempts
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // limit each IP to 5 requests per windowMs
    message: 'Too many login attempts, please try again in 15 minutes.'
  });
  
  // Apply the rate limiter middleware to your login route
  app.use('/login', loginLimiter);












  


 





  app.get('/checkOnline', (req, res) => {
    console.log('Entered checkOnline route');
    res.status(200).send('Online');
});


// Authentication Route code************:


app.get('/', redirectToDashboardIfAuthenticated, (req, res) => {
  res.render('home', { 
      success: req.flash('success'),
      error: req.flash('error')
  });
});







app.get('/login', (req, res) => {
  res.render('login', { 
    success: req.flash('success'),
    error: req.flash('error') 
  });
});



app.post("/login", loginLimiter, function(req, res, next) {
  passport.authenticate("local", function(err, user, info) {

    if (err) {
      console.log(err);
      return next(err); // Pass the error to the next middleware
    }

    if (!user) {
      // Authentication failed, set flash error message
      req.flash('error', 'Incorrect username or password');
      return res.redirect("/login");
    }


    if (!user.active) {  // User exists but hasn't verified their email
      console.log("User email not verified");
      req.flash('error', 'Please verify your email to complete registration. If you cannot find the email, then register again as a new user.');
      return res.redirect("/verifytoken");
    }

    // if (user.verificationToken !== null) {
    //   console.log("No user found");
    //   req.flash('error', 'Email not verified');
    //   return res.redirect("/login");
    // }
    

    req.login(user, function(err) {
      if (err) {
        console.log(err);
        return next(err); // Pass the error to the next middleware
      }

      // At this point, the user is successfully authenticated. Mark them as logged in.
      console.log("User logged in, setting session.isLoggedIn to true");
      req.session.isLoggedIn = true;

      // If it's the user's first login (indicated by no firstname), redirect to the welcome page.
      if (!user.firstname) {
        return res.redirect("/welcome");
      }

      // If it's not the user's first login, redirect to their main page.
      return res.redirect("/dashboard");
    });   
  })(req, res, next);
});



app.get('/verifytoken', (req, res) => {
  res.render('verifytoken', { 
    success: req.flash('success'),
    error: req.flash('error') 
  });
});








app.get("/welcome", function(req, res){
  res.render("welcome");
});




app.post('/welcome', async (req, res) => {
  // Log req.session and req.user
  // console.log('req.session:', req.session);
  // console.log('req.user:', req.user);

  const { firstName, surname } = req.body;

  console.log(req.body);


  if (!req.user) {
      return res.status(400).send("You must be logged in to access this route.");
  }

  const userId = req.user._id;

  try {
      // Update the user and fetch the updated document
      const user = await User.findByIdAndUpdate(
          userId,
          {
              firstname: firstName,
              surname: surname
          },
          { new: true }
      );

      // User information has been updated successfully
      // Redirect or render the next page here
      res.redirect('/dashboard');

  } catch (err) {
      console.error(err);
      res.status(500).send("An error occurred while updating user information.");
  }
});


app.get('/register', function(req, res) {

  console.log('Entered register GET route');
  res.render('register', { 
    success: req.flash('success'),
    error: req.flash('error') 
  });
  });




app.post('/register', async function(req, res) {
  console.log('Entered register POST route');
  // Check if passwords match
  if (req.body.password !== req.body.passwordConfirm) {
      console.log('Passwords do not match');
      req.flash('error', 'Passwords do not match.');
      return res.redirect('/register');
  }

  const passwordPattern = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{7,}$/;
    if (!passwordPattern.test(req.body.password)) {
        console.log('Password does not meet requirements.');
        req.flash('error', 'Password must be minimum 7 characters with at least 1 capital letter and 1 number.');
        return res.redirect("/register");
    }

    try {
      const existingUser = await User.findOne({ username: req.body.username });
      if (existingUser) {
          if (!existingUser.active) {
              // The user exists but hasn't been verified yet, remove them and allow re-registration
              await User.deleteOne({ username: req.body.username });
          } else {
              // The user is active and verified, redirect them to login
              req.flash('error', 'User already exists. Please login.');
              return res.redirect('/login');
          }
      }

  

      const user = await User.register({ username: req.body.username, active: false }, req.body.password);

      // Generate a verification token
      const verificationToken = uuidv4();
      user.verificationToken = verificationToken;

      await user.save();

      // Send verification email
      // const verificationLink = `${process.env.APP_URL}/verify?token=${verificationToken}`;
      const email = {
          from: 'brayroadapps@gmail.com',
          to: user.username,
          subject: 'Email Verification',
          text: `Please copy and paste this code into text box:    ${verificationToken}`,
          // text: `Please click the following link to verify your email address: ${verificationLink}`,
      };

      try {
          await transporter.sendMail(email);
          console.log('Verification email sent');
          req.flash('success', 'Verification email has been sent - check your email inbox');
          res.redirect('/verifytoken');
      } catch (mailError) {
          console.log('Error sending email:', mailError);
          req.flash('error', 'Failed to send verification email.');
          res.redirect('/register');
      }
  } catch (err) {
      console.log(err);
      req.flash('error', 'An unexpected error occurred.');
      return res.redirect('/home');
  }
});




app.post('/verify', async function(req, res) {
  console.log('Verification route entered');

  // Get the verification token from the form data
  const verificationToken = req.body.verificationToken;

  try {
      // Find the user with the matching verification token
      const user = await User.findOne({ verificationToken: verificationToken });

// Below is origional link code for clickable link from email:


// app.get('/verify', async function(req, res) {
//   console.log('Vefification route entered');
//   const verificationToken = req.query.token;

//   try {
//       // Find the user with the matching verification token
//       const user = await User.findOne({ verificationToken: verificationToken });

      if (!user) {
          // Invalid or expired token
          console.log('Token not found or expired');
          res.send('Unauthorized login');
          return res.redirect('/'); // Use 'return' to exit the function early
      }

      // Update the user's verification status
      user.active = true;
      user.verificationToken = null; // Clear the verification token

      try {
          await user.save();
          console.log('Email verified for user2555555555555');

          // Add the success message using flash
          req.flash('success', 'Email verified for user. Please login.');
          console.log('Redirecting to login page');
          res.redirect('/login');
      } catch (saveErr) {
          console.log('Error saving user:', saveErr);
          res.redirect('/');
      }
  } catch (err) {
      console.log(err);
      res.send('Unauthorized login');
      res.redirect('/');
  }
});



app.get('/forgotpassword', function(req, res) {
  let message = req.query.message;  // Extract message from the URL parameters.
  res.render('forgotpassword', { message: message });  // Pass message to the view.
});



app.post('/forgotpassword', async function(req, res, next) {
  try {
      const buf = await crypto.randomBytes(20);
      const token = buf.toString('hex');

      const user = await User.findOne({ username: req.body.username });

      if (!user) {
          console.log('No user with this email address');
          return res.redirect('/forgotpassword?message=No%20user%20registered%20with%20this%20email%20address');
      }

      user.resetPasswordToken = token;
      user.resetPasswordExpires = Date.now() + 10800000; // 3 hours
      console.log(new Date(user.resetPasswordExpires));

      await user.save(); // Use await here instead of the callback

      const mailOptions = {
          to: user.username,
          from: 'brayroadapps@gmail.com',
          subject: 'Node.js Password Reset',
          text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };

      // Convert sendMail to Promise
      const info = await new Promise((resolve, reject) => {
          transporter.sendMail(mailOptions, (error, result) => {
              if (error) reject(error);
              else resolve(result);
          });
      });

      console.log('Email sent: ' + info.response);
      return res.redirect('/forgotpassword?message=Email%20has%20been%20sent%20with%20further%20instructions');
  
  } catch (error) {
      console.error("Error occurred:", error);
      return res.redirect('/forgotpassword?message=An%20error%20occurred');
  }
});

    

app.get('/reset/:token', async function(req, res, next) {
  try {
    const user = await User.findOne({ 
      resetPasswordToken: req.params.token, 
      resetPasswordExpires: { $gt: Date.now() } 
    });

    if (!user) {
      // handle error: no user with this token, or token expired
      console.log('Password reset token is invalid or has expired.');
      return res.redirect('/forgotpassword?message=Password%20reset%20token%20is%20invalid%20or%20has%20expired');
    }

    // if user found, render a password reset form
    res.render('reset', {
      token: req.params.token,
      error: req.flash('error')
    });
  } catch (err) {
    console.error("Error occurred:", err);
    next(err); // pass the error to your error-handling middleware, if you have one
  }
});



app.post('/reset/:token', async function(req, res, next) {
  try {
    const user = await User.findOne({ 
      resetPasswordToken: req.params.token, 
      resetPasswordExpires: { $gt: Date.now() } 
    });

    if (!user) {
      console.log('Password reset token is invalid or has expired.');
      return res.redirect('/forgotpassword?message=Password%20reset%20token%20is%20invalid%20or%20has%20expired');
    }

    const passwordPattern = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{7,}$/;
    if (!passwordPattern.test(req.body.password)) {
        console.log('Password does not meet requirements.');
        req.flash('error', 'Password must be minimum 7 characters with at least 1 capital letter and 1 number.');
        return res.redirect("/reset");
    }

    // Check if passwords match
    if (req.body.password !== req.body.passwordConfirm) {
      console.log('Passwords do not match');
      req.flash('error', 'Passwords do not match');
      return res.redirect("/reset");
    }

    // Assuming you have an asynchronous setPassword function. 
    await user.setPassword(req.body.password);

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    // Wrap req.logIn in a promise
    await new Promise((resolve, reject) => {
      req.logIn(user, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.redirect('/');

  } catch (err) {
    console.error("Error occurred:", err);
    next(err); 
  }
});




app.get('/dashboard', checkAuthenticated, async (req, res) => {
  try {
    // Fetch messages from the database
    const messages = await Message.find();

    // Render the messages using EJS template
    res.render('dashboard', { messages });
  } catch (error) {
    // Handle errors
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});




app.post('/messagesend', async (req, res) => {
  try {
    // Assuming you have user authentication and the user's first name is available in req.user.firstname
    const senderName = req.user.firstname;

    // Get the current timestamp in Johannesburg time zone
    const timestamp = moment().tz('Africa/Johannesburg').toDate();

    // Get the message content from the request body
    const content = req.body.messageContent;

    // Determine the messageColour based on the first letter of the sender's first name
    let messageColour;

    if (senderName && typeof senderName === 'string' && senderName.length > 0) {
      const firstLetter = senderName[0].toUpperCase();

      if (firstLetter === 'S') {
        messageColour = 'card text-bg-success mb-3';
      } else if (firstLetter === 'P') {
        messageColour = 'card text-bg-warning mb-3';
      } else {
        messageColour = 'card text-bg-info mb-3';
      }
    } else {
      // Default to 'bs-primary-bg-subtle' if senderName is missing or empty
      messageColour = 'bs-primary-bg-subtle';
    }

    // Create a new message document
    const newMessage = new Message({
      sender: senderName,
      timestamp: timestamp,
      content: content,
      messageColour: messageColour
    });

    // Save the message to the database
    await newMessage.save();

    // Message saved successfully
    res.redirect('/dashboard'); // Redirect to the messages page or handle the response as needed
  } catch (error) {
    console.error(error);
    // Handle the error appropriately, e.g., send an error response
    res.status(500).send('Internal Server Error');
  }
});


app.post('/messagedelete', async (req, res) => {
  try {
    // Retrieve the messageId from the form data
    const messageId = req.body.messageId;

    // Implement the code to delete the message from your MongoDB collection
    // Example:
    await Message.findByIdAndDelete(messageId);

    // Handle the success response or redirect to a different page
    res.redirect('/dashboard'); // Redirect to the dashboard or handle the response as needed
  } catch (error) {
    // Handle errors
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});





app.get('/manifest.json', (req, res) => {
  res.sendFile(`${__dirname}/manifest.json`);
});

app.get('/service-worker.js', (req, res) => {
  res.sendFile(`${__dirname}/service-worker.js`);
});





app.get('/logo', (req, res) => {
  res.render('logo');
});






    
  



connectDB().then(() => {
  app.listen(PORT, () => {
      console.log("listening for requests");
  })
})






