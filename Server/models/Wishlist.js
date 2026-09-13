import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    userPhone: {
      type: String,
      default: ""
    },
    items: [
      {
        type: String
      }
    ],
    products: [
      {
        type: mongoose.Schema.Types.Mixed
      }
    ]
  },
  {
    timestamps: true
  }
);

export default mongoose.model("Wishlist", wishlistSchema);
