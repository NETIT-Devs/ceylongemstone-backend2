const express = require("express");

const {
  createEnquiry,
  getEnquiries,
  updateEnquiryStatus,
  deleteEnquiry
} = require("../controllers/enquiryController");

const router = express.Router();

router.post("/", createEnquiry);
router.get("/", getEnquiries);
router.put("/:id/status", updateEnquiryStatus);
router.delete("/:id", deleteEnquiry);

module.exports = router;