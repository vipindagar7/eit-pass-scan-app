const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { listUsers, createUser, updateUser, resetPassword, deleteUser, sendCredentials } = require("../controllers/userController");

const router = express.Router();
router.use(requireAuth, requireRole("SUPER_ADMIN"));

router.get("/", listUsers);
router.post("/", createUser);
router.patch("/:id", updateUser);
router.post("/:id/reset-password", resetPassword);
router.post("/:id/send-credentials", sendCredentials);
router.delete("/:id", deleteUser);

module.exports = router;