import express from "express";
import { getKits, getKitById } from "../controllers/kitController.js";

const router = express.Router();

// Public Kit Browsing Endpoints
router.get("/", getKits);
router.get("/:id", getKitById);

export default router;
