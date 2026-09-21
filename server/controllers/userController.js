import User from "../models/User.js";
import { escapeRegex } from "../utils/text.js";

/** Lists registered users for assignee / share pickers and the team directory. */
export const searchUsers = async (req, res) => {
  const search = String(req.query.search ?? "").trim().slice(0, 100);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);

  const filter = {};
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const users = await User.find(filter).select("name email").sort({ name: 1 }).limit(limit).lean();
  res.json({
    success: true,
    users: users.map((user) => ({ ...user, isMe: String(user._id) === String(req.user._id) })),
  });
};
