import bcrypt from "bcrypt";
import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  socialLogin: { type: Boolean, default: false },
  id: { type: String },
  pw: {
    type: String,
    required: function () {
      return !this.socialLogin;
    },
  },
  email: { type: String },
});

adminSchema.pre("save", async function (next) {
  if (this.isNew && this.pw) {
    this.pw = await bcrypt.hash(this.pw, 5);
  } else if (this.isModified("pw")) {
    this.pw = await bcrypt.hash(this.pw, 5);
  }
  next();
});

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;