const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const RibeiroUser = require("../models/user-ribeiro");
const DateSelection = require("../models/date-selection");
const checkAuth = require('../middleware/ribeiro-auth');
const { trustedOrigin } = require('../services/password-recovery');
const { registrationEmail } = require('../services/registration-mail');

// Check before saving accounts; jwt.sign otherwise fails after the insert succeeds.
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!process.env.JWT_SECRET?.trim()) {
    return res.status(503).json({ message: 'Sign-in is temporarily unavailable. Server authentication needs configuration.' });
  }
  next();
});
router.use(require('./password-recovery'));

const BCRYPT_ROUNDS = 12;
const TOKEN_LIFETIME_SECONDS = 3600;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const googleClient = new OAuth2Client();

const userInformation = (user) => ({
  userId: user._id,
  email: user.email,
  name: user.name,
  surname: user.surname ?? null,
  phone: user.phone ?? null,
  picture: user.picture ?? null,
  authProviders: user.authProviders,
});

// Same token shape and lifetime as the other sign-in routes on this backend
const signInResponse = (user) => ({
  token: jwt.sign({ email: user.email, userId: user._id, authVersion: user.authVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn: TOKEN_LIFETIME_SECONDS }),
  expiresIn: TOKEN_LIFETIME_SECONDS,
  userInformationOnSignIn: userInformation(user),
});

const normaliseEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

router.post("/signup", async (req, res, next) => {
  const email = normaliseEmail(req.body.email);
  const { password, name, surname } = req.body;
  const rawPhone = req.body.phone;
  const phone = typeof rawPhone === 'string' ? rawPhone.trim().replace(/[\s().-]/g, '') : undefined;

  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: "A valid email address is required" });
  }
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    // bcrypt silently ignores everything past 72 bytes, so reject rather than truncate
    return res.status(400).json({ message: "Password must have at least 8 characters and fit within 72 UTF-8 bytes" });
  }
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: "Name is required" });
  }
  if ((rawPhone != null && typeof rawPhone !== 'string') ||
    (typeof rawPhone === 'string' && rawPhone.length > 40) ||
    (typeof rawPhone === 'string' && rawPhone.trim() && !/^\+?\d{7,15}$/.test(phone))) {
    return res.status(400).json({ message: 'Enter a valid cellphone number with 7–15 digits, or leave it blank.' });
  }

  try {
    if (await RibeiroUser.exists({ email })) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const user = new RibeiroUser({
      email,
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      name,
      surname: typeof surname === 'string' ? surname : undefined,
      phone: phone || undefined,
      authProviders: ['password'],
      registrationEmail: registrationEmail(trustedOrigin(req)),
    });
    await user.save();

    res.status(201).json({ message: "User Created", ...signInResponse(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists' });
    res.status(500).json({ message: "Unable to create your account. Please try again." });
  }
});

router.post("/signin", async (req, res, next) => {
  const email = normaliseEmail(req.body.email);
  const { password } = req.body;

  if (!email || typeof password !== 'string') {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await RibeiroUser.findOne({ email });
    // One message for every failure so the response doesn't reveal which emails are registered
    const passwordMatches = user?.password ? await bcrypt.compare(password, user.password) : false;
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.status(200).json(signInResponse(user));
  } catch (error) {
    res.status(500).json({ message: "Authentication failed. Please try again." });
  }
});

// Sign in with Google: the browser sends the ID token from Google Identity Services,
// we verify it server-side and exchange it for this backend's own JWT.
router.post("/google", async (req, res, next) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ message: "Google sign-in is not configured on the server" });
  }

  const { credential } = req.body;
  if (typeof credential !== 'string' || !credential) {
    return res.status(400).json({ message: "Google credential is required" });
  }

  let payload;
  try {
    // Checks the signature against Google's public keys, plus aud, iss and exp
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload();
  } catch (error) {
    return res.status(401).json({ message: "Google credential could not be verified" });
  }

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    return res.status(401).json({ message: "Your Google account email address is not verified" });
  }

  const email = normaliseEmail(payload.email);
  // Google only vouches for ownership of gmail.com addresses and Workspace (hd) addresses;
  // anything else must not be linked to an existing account on the email match alone.
  const googleIsAuthoritative = email.endsWith('@gmail.com') || Boolean(payload.hd);

  try {
    let user = await RibeiroUser.findOne({ googleId: payload.sub });

    if (!user) {
      user = await RibeiroUser.findOne({ email });

      if (user && !googleIsAuthoritative) {
        return res.status(409).json({
          message: "An account with this email already exists. Sign in with your password instead.",
        });
      }

      if (user) {
        user.googleId = payload.sub;
        user.picture = user.picture ?? payload.picture;
        user.authProviders = [...new Set([...user.authProviders, 'google'])];
      } else {
        user = new RibeiroUser({
          email,
          name: payload.given_name || payload.name || email.split('@')[0],
          surname: payload.family_name,
          googleId: payload.sub,
          picture: payload.picture,
          authProviders: ['google'],
          registrationEmail: registrationEmail(trustedOrigin(req)),
        });
      }
      await user.save();
    }

    res.status(200).json(signInResponse(user));
  } catch (error) {
    res.status(500).json({ message: "Google sign-in failed", error: error.message });
  }
});

router.get("/me", checkAuth, async (req, res, next) => {
  try {
    const user = await RibeiroUser.findById(req.userData.userId);
    if (!user) {
      return res.status(404).json({ message: "User Not Found" });
    }
    res.status(200).json({ user: userInformation(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Deletes the account and everything stored against it, as promised in the privacy policy
router.delete("/me", checkAuth, async (req, res, next) => {
  try {
    const user = await RibeiroUser.findByIdAndDelete(req.userData.userId);
    if (!user) {
      return res.status(404).json({ message: "User Not Found" });
    }
    await DateSelection.deleteMany({ user: user._id });
    await require('../models/lift-booking').deleteMany({ user: user._id });
    res.status(200).json({ message: "Account deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
