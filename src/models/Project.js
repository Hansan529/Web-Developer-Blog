import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
  url: { type: String, required: true },
  name: { type: String, required: true },
  date: { type: Date, dafult: Date.now },
  thumbnail: { type: String, required: true },
  languages: [{ type: String, trim: true }],
  description: { type: String, required: true },
});

projectSchema.static("formatLanguage", function (languages) {
  return languages.split(",").map((word) => word.trim());
});

const Project = mongoose.model("Project", projectSchema);

export default Project;
