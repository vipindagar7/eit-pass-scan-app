const express = require("express");
const { getTicket } = require("../controllers/registrationController");

const router = express.Router();

// public — for the mobile ticket page
router.get("/:ticketId", getTicket);

module.exports = router;
