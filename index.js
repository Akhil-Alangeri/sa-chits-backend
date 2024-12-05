const express = require("express");
const jwt = require("jsonwebtoken");
const { google } = require("googleapis");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Environment Variables
const SHEET_ID = process.env.SHEET_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const CLIENT_EMAIL = process.env.CLIENT_EMAIL;
const PRIVATE_KEY = process.env.PRIVATE_KEY.replace(/\\n/g, "\n");

// Google Sheets Authentication
const Auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: CLIENT_EMAIL,
    private_key: PRIVATE_KEY,
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// Utility Functions
async function fetchSheetData(auth, spreadsheetId, range) {
  const sheets = google.sheets({ version: "v4", auth: Auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return response.data.values;
}

async function updateSheetData(auth, spreadsheetId, range, values) {
  const sheets = google.sheets({ version: "v4", auth: Auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

// Routes
app.post("/login", async (req, res) => {
  const { userId, mobileNmbr } = req.body;

  try {
    // ok
    const auth = await Auth.getClient();

    const rows = await fetchSheetData(auth, SHEET_ID, "Members Details!B2:C21");

    //ok
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "No user data found." });
    }

    const isValidUser = rows.some(
      ([sheetUserId, sheetMobileNmbr]) =>
        sheetUserId === userId && sheetMobileNmbr === mobileNmbr
    );

    if (isValidUser) {
      //ok
      await updateSheetData(auth, SHEET_ID, "Receipt!C4", [[userId]]);
      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1h" });
      return res.status(200).json({ message: "Login successful", token });
    } else {
      return res
        .status(401)
        .json({ error: "Invalid user ID or mobile number." });
    }
  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({ error: "Server error during login" });
  }
  //ook
});

app.get("/sheets", async (req, res) => {
  try {
    const auth = await Auth.getClient();
    const sheetsData = await fetchSheetData(auth, SHEET_ID, "Receipt!B4:F30");
    res.status(200).json(sheetsData);
  } catch (error) {
    console.error("Error accessing Google Sheets:", error.message);
    res.status(500).json({ error: "Failed to access Google Sheets" });
  }
});

// Start Server
app.listen(port, () => console.log(`Server is running on port ${port}`));
